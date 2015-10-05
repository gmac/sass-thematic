var fs = require('fs');
var path = require('path');
var async = require('async');
var AST = require('./ast');
var Thematic = require('./thematic');

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
var threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
var parseSyntaxTree = async.queue(AST.parse, threadPoolSize - 1);

/**
* Formats error objects with SassThematic headers and messaging.
*/
function formatError(err, message) {
  var error = new Error('SassThematicPlugin\n-> '+ (message || '') +'\n-> '+ err.message);
  error.line = err.line || null;
  return error;
}

/**
* Sass Thematic Plugin
* Hooks into Webpack compiler to live-compile theme assets.
*/
function SassThematicPlugin(opts) {
  var self = this;

  // Normalize current working directory reference:
  opts.cwd = opts.cwd || process.cwd();

  // Resolve variables file path:
  if (opts.varsFile && !opts.varsData) {
    opts.varsData = fs.readFileSync(path.resolve(opts.cwd, opts.varsFile), 'utf-8');
  } else if (!opts.varsData) {
    throw 'No variables file or data specified.';
  }

  // Resolve theme data files:
  if (opts.themeFile && !opts.themeData) {
    opts.themeData = fs.readFileSync(path.resolve(opts.cwd, opts.themeFile), 'utf-8');
  } else if (!opts.themeData) {
    opts.themeFile = opts.varsFile;
    opts.themeData = opts.varsData;
  }

  // Resolve includes array:
  if (!opts.output) {
    throw 'No theme output specified.';
  } else if (!Array.isArray(opts.output)) {
    opts.output = [opts.output];
  }

  AST.cache = {};

  // Map all build includes into normalized paths.
  // In the process, also seed the cache with references
  // to what files we'll need to maintain builds of.
  opts.output.forEach(function(output) {
    output.includeFiles = output.includeFiles.map(function(filepath) {
      filepath = path.resolve(opts.cwd, filepath);
      AST.cache[filepath] = null;
      return filepath;
    });
  });

  // Store options and output specs:
  this.options = opts;
  this.output = opts.output;

  // Remove the "output" field from the options object
  // so that it can be cleanly extended onto other objects.
  delete this.options.output;
}

/**
* Applies plugin configuration to Webpack.
* @param {Object<Webpack Compiler>} compiler instance provided by Webpack
* @ref http://webpack.github.io/docs/plugins.html
*/
SassThematicPlugin.prototype.apply = function(compiler) {
  var self = this;
  this.compiler = compiler;

  compiler.plugin('emit', function(compilation, callback) {
    self.compilation = compilation;

    // Abort if the cache still validates against this set of changes.
    if (self.validateCache(self.compiler.fileTimestamps))
      return callback();

    // Parse all changed files.
    self.loadCache(function(err) {
      if (err) compilation.errors.push(err);
      self.addDependencies();

      var pendingBuilds = 0;
      var completedBuilds = 0;
      var finish = function() {
        if (pendingBuilds === completedBuilds) callback();
      };

      // Generate all build outputs.
      self.output.forEach(function(opts) {
        pendingBuilds++;

        // No errors returned from build operations:
        // builds will handle their own errors,
        // and take responsibility for reporting them to webpack.
        self.build(AST.extend(opts, self.options), function() {
          completedBuilds++;
          finish();
        });
      });

      finish();
    });
  });
};

/**
* Validates the integrity of all files in the cache.
* Changed files will be purged from the cache.
* @param {Object} changed absolute file paths as object keys.
* @returns {Boolean} true if cycled cache still has all valid files.
*/
SassThematicPlugin.prototype.validateCache = function(timestamps) {
  var isMissingFiles = false;

  // Loop through all cached files:
  for (var filepath in AST.cache) {
    var cachedFile = AST.cache[filepath];

    // Invalidate top-level cache files with changed dependencies:
    if (cachedFile && cachedFile.timestamp) {
      var includedFiles = cachedFile.includedFiles;

      if (cachedFile.timestamp < timestamps[filepath]) {
        AST.cache[filepath] = cachedFile = null;
      }

      for (var i=0; i < includedFiles.length; i++) {
        var childPath = includedFiles[i];
        var childFile = AST.cache[childPath];
        if (!childFile || childFile.timestamp < timestamps[childPath]) {
          AST.cache[filepath] = cachedFile = null;
          AST.cache[childPath] = null;
        }
      }
    }

    // Track status of one or more missing files:
    isMissingFiles = isMissingFiles || !cachedFile;
  }
  return !isMissingFiles;
};

/**
* Loads all build files into the SassThematic cache.
* @param {Object} preloaded files, formatted as a filepath key with file data value.
* @param {Function} callback.
*/
SassThematicPlugin.prototype.loadCache = function(done) {
  var self = this;

  // Call done when the queue finishes all jobs.
  parseSyntaxTree.kill();
  parseSyntaxTree.drain = done;

  function queueFileParsingJob(filepath) {
    var opts = AST.extend({}, self.options, {file: filepath});
    parseSyntaxTree.push(opts, function(err, file) {
      if (err) self.compilation.errors.push(formatError(err, 'Could not compile syntax tree for:\n '+ filepath));
    });
  }

  // Add included changed files into the parsing queue...
  // File references are read from the changes table,
  // and are compared against the contents of the includes table.
  for (var filepath in AST.cache) {
    if (AST.cache.hasOwnProperty(filepath) && !AST.cache[filepath]) {
      queueFileParsingJob(filepath);
    }
  }

  // Manually call render if the queue is never started.
  if (!parseSyntaxTree.started) done();
};

/**
* Adds all file dependencies into the Webpack watch.
*/
SassThematicPlugin.prototype.addDependencies = function() {
  var currentDeps = this.compilation.fileDependencies.reduce(function(memo, filepath) {
    memo[filepath] = 1;
    return memo;
  }, {});

  // Loop through all cached files:
  for (var filepath in AST.cache) {
    if (AST.cache.hasOwnProperty(filepath) && !currentDeps[filepath]) {
      this.compilation.fileDependencies.push(filepath);
      currentDeps[filepath] = 1;
    }
  }
};

/**
* Performs a single output build.
* Each build has its own list of includeFiles,
* and may generate a CSS and a template file.
*/
SassThematicPlugin.prototype.build = function(opts, done) {
  var self = this;
  var pendingRenders = 0;
  var completedRenders = 0;
  var missingFiles = [];

  // Create renderer instances:
  var cssRenderer = new Thematic({}, AST.extend(opts.css || {}, opts));
  var templateRenderer = new Thematic({}, AST.extend(opts.template || {}, opts));
  cssRenderer.sass = templateRenderer.sass = '';

  // Call to conclude the build cycle,
  // Callback will fire when all pending operations resolve.
  function finish() {
    if (pendingRenders === completedRenders) done();
  }

  // Renders file output.
  // @params {Object} options for file output (detailing css/template)
  // @param {SassThematic} renderer object for generating output.
  // @param {String} method name to call on the renderer.
  function renderOutput(outputOpts, renderer, methodName) {
    if (!outputOpts) {
      return;
    }
    else if (missingFiles.length) {
      publishFile(outputOpts, 'Output could not be generated due to errors with the following files:\n'
        + missingFiles.map(function(filename) { return ' - '+ filename }).join('\n') +'\n\n'
        + self.getRelevantErrorMessages());
    }
    else {
      pendingRenders++;
      renderer[methodName](function(err, content) {
        if (err) {
          err = formatError(err, 'Could not render output file:\n'+ outputOpts.filename);
          self.compilation.errors.push(err);
        }
        if (!err && outputOpts.header) content = outputOpts.header +'\n'+ content;
        if (!err && outputOpts.footer) content += outputOpts.footer;

        publishFile(outputOpts, err ? err.message : content);
        completedRenders++;
        finish();
      });
    }
  }

  // Publishes file output.
  // @params {Object} options for file output (detailing css/template)
  // @param {String} contents for the output of the file.
  function publishFile(outputOpts, content) {
    self.compilation.assets[outputOpts.filename] = {
      source: function() {
        return content;
      },
      size: function() {
        return content.length;
      }
    };

    if (outputOpts.writePath) {
      var outputPath = path.resolve(opts.cwd, outputOpts.writePath, outputOpts.filename);
      fs.writeFileSync(outputPath, content);
    }
  }

  // Add just included build files for this output:
  opts.includeFiles.forEach(function(filepath) {
    var file = AST.cache[filepath];
    if (file) {
      if (!file.themeSass || !file.templateSass) {
        var reducer = new Thematic(JSON.parse(file.ast.toJson()), opts);
        file.themeSass = reducer.prune().toString();
        file.templateSass = reducer.prune({template: true}).toString();
      }

      cssRenderer.sass += file.themeSass || '';
      templateRenderer.sass += file.templateSass || '';
    } else {
      missingFiles.push(filepath);
    }
  });

  renderOutput(opts.css, cssRenderer, 'renderCSS');
  renderOutput(opts.template, templateRenderer, 'renderTemplate');
  finish();
};

/**
* Gets error messages from the build that pertain to SassThematic output.
*/
SassThematicPlugin.prototype.getRelevantErrorMessages = function() {
  return this.compilation.errors
    .filter(function(e) { return /SassThematic/.test(e.message) })
    .map(function(e) { return e.message })
    .join('\n\n');
};

module.exports = SassThematicPlugin;
