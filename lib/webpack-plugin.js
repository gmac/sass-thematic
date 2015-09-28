var fs = require('fs');
var path = require('path');
var async = require('async');
var AST = require('./ast');
var SassThematic = require('./thematic');

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
var threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
var parseSyntaxTree = async.queue(AST.parse, threadPoolSize - 1);
var cache = {};

SassThematic.prototype.toString = function() {
  return (typeof this.sass === 'string') ? this.sass : this.ast.toString();
};

/**
* Formats error objects with SassThematic headers and messaging.
*/
function formatError(err, message) {
  err.message = 'SassThematicPlugin: '+ (message || '') +'\n'+ err.message;
  return err;
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
    opts.varsData = fs.readFileSync(path.resolve(opts.varsFile), 'utf-8');
  } else if (!opts.varsData) {
    throw 'No variables file or data specified.';
  }

  // Resolve theme data files:
  if (opts.themeFile && !opts.themeData) {
    opts.themeData = fs.readFileSync(path.resolve(opts.themeFile), 'utf-8');
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

  // Map all build includes into normalized paths.
  // In the process, also seed the cache with references
  // to what files we'll need to maintain builds of.
  opts.output.forEach(function(output) {
    output.includeFiles = output.includeFiles.map(function(filepath) {
      filepath = path.resolve(opts.cwd, filepath);
      cache[filepath] = null;
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

  // Compiler hooks:
  // Follows hook pattern in ExtractTextPlugin.
  // @ref https://github.com/webpack/extract-text-webpack-plugin/blob/master/index.js
  compiler.plugin('emit', function(compilation, callback) {
    self.compilation = compilation;
    var changedFiles = compilation.sassThematic;

    // Abort if:
    // - there are no changes from the SassThematic loader.
    // - the cache still validates against this set of changes.
    if (!changedFiles || self.validateCache(changedFiles))
      return callback();

    // Parse all changed files.
    self.loadCache(changedFiles, function(err) {
      if (err) compilation.errors.push(err);

      var pendingBuilds = 0;
      var completedBuilds = 0;
      var finish = function() {
        if (pendingBuilds === completedBuilds) callback();
      };

      // Generate all build outputs.
      self.output.forEach(function(opts) {
        opts = AST.extend(opts, self.options);
        pendingBuilds++;

        self.build(opts, function(err) {
          if (err) compilation.errors.push(err);
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
SassThematicPlugin.prototype.validateCache = function(changedFiles) {
  var isMissingFiles = false;

  // Loop through all cached files:
  for (var filename in cache) {
    if (!cache.hasOwnProperty(filename)) continue;
    var cachedFile = cache[filename];

    // Invalidate top-level cached files with changes:
    if (changedFiles.hasOwnProperty(filename)) {
      cache[filename] = cachedFile = null;
    }
    // Invalidate top-level cache files with changed dependencies:
    else if (cachedFile && cachedFile.includedFiles) {
      for (var i=0; i < cachedFile.includedFiles.length; i++) {
        if (changedFiles.hasOwnProperty(cachedFile.includedFiles[i])) {
          cache[filename] = cachedFile = null;
          break;
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
SassThematicPlugin.prototype.loadCache = function(preloadedFiles, done) {
  var self = this;
  var deps = this.compilation.fileDependencies.reduce(function(memo, filepath) {
    memo[filepath] = 1;
    return memo;
  }, {});

  // Call done when the queue finishes all jobs.
  parseSyntaxTree.kill();
  parseSyntaxTree.drain = done;

  // Adds a file dependency to the compilation.
  // New dependencies will be added to the Webpack watch.
  function addDependency(filepath) {
    filepath = path.normalize(filepath);
    if (!deps.hasOwnProperty(filepath)) {
      self.compilation.fileDependencies.push(filepath);
      deps[filepath] = 1;
    }
  }

  function queueFileParsingJob(filepath) {
    addDependency(filepath);

    var opts = AST.extend({}, self.options, {
      data: preloadedFiles[filepath],
      file: filepath
    });

    parseSyntaxTree.push(opts, function(err, result) {
      if (err) return self.compilation.errors.push(formatError(err, 'could not parse syntax tree for '+ filepath));

      var reducer = new SassThematic(result.ast, opts);
      result.themeSass = reducer.prune().ast.toString();
      result.templateSass = reducer.prune({template: true}).ast.toString();
      result.includedFiles.forEach(addDependency);
      cache[result.file] = result;
    });
  }

  // Add included changed files into the parsing queue...
  // File references are read from the changes table,
  // and are compared against the contents of the includes table.
  for (var filename in cache) {
    if (cache.hasOwnProperty(filename) && !cache[filename]) {
      queueFileParsingJob(filename);
    }
  }

  // Manually call render if the queue is never started.
  if (!parseSyntaxTree.started) done();
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
  var renderErrors = [];

  // Create renderer instances:
  var cssRenderer = new SassThematic({}, AST.extend(opts.css || {}, opts));
  var templateRenderer = new SassThematic({}, AST.extend(opts.template || {}, opts));
  cssRenderer.sass = templateRenderer.sass = '';

  // Call to conclude the build cycle,
  // Callback will fire when all pending operations resolve.
  function finish(err) {
    renderErrors.push(err);
    if (pendingRenders === completedRenders) {
      done(renderErrors[0]);
    }
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
        + missingFiles.map(function(filename) { return '  - '+ filename +'\n' }));
    }
    else {
      pendingRenders++;
      renderer[methodName](function(err, content) {
        if (err) formatError(err, 'could not render Sass output for "'+ outputOpts.filename +'"');
        if (!err && outputOpts.header) content = outputOpts.header +'\n'+ content;
        if (!err && outputOpts.footer) content += outputOpts.footer;

        publishFile(outputOpts, err ? err.message : content);
        completedRenders++;
        finish(err);
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
  opts.includeFiles.forEach(function(filename) {
    if (cache[filename]) {
      cssRenderer.sass += cache[filename].themeSass || '';
      templateRenderer.sass += cache[filename].templateSass || '';
    } else {
      missingFiles.push(filename);
    }
  });

  renderOutput(opts.css, cssRenderer, 'renderCSS');
  renderOutput(opts.template, templateRenderer, 'renderTemplate');
  finish();
};

module.exports = SassThematicPlugin;
