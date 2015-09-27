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
* Renders all parsed theme snippets.
*/
function formatError(err, message) {
  err.message = 'SassThematicPlugin: '+ (message || '') +'\n'+ err.message;
  return err;
}

/**
* Renders all parsed theme snippets.
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
*
*/
SassThematicPlugin.prototype.apply = function(compiler) {
  var self = this;

  compiler.plugin('this-compilation', function(compilation) {
    compilation.plugin('additional-assets', function(callback) {
      var changedFiles = compilation.sassThematic;

      // Abort if:
      // - there are no changes from the SassThematic loader.
      // - the cache still validates against this set of changes.
      if (!changedFiles || self.validateCache(changedFiles))
        return callback();

      // Parse all changed files.
      self.loadCache(changedFiles, compilation, function(err) {
        if (err) return compilation.errors.push(err);

        var pendingBuilds = 0;
        var completedBuilds = 0;

        function finish() {
          if (pendingBuilds === completedBuilds) {
            console.log('done');
            callback();
          }
        }

        // Generate all build outputs.
        self.output.forEach(function(opts) {
          opts = AST.extend(opts, self.options);
          pendingBuilds++;

          self.build(opts, compilation, function(err) {
            if (err) compilation.errors.push(err);
            completedBuilds++;
            finish();
          });
        });

        finish();
      });
    });
  });
};

/**
* Invalidates cached files for reloading.
* All cached files that include changes will be purged.
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
*
*/
SassThematicPlugin.prototype.loadCache = function(preloadedFiles, compilation, done) {
  var self = this;
  var deps = compilation.fileDependencies.reduce(function(memo, filepath) {
    memo[filepath] = 1;
    return memo;
  }, {});

  // Call done when the queue finishes all jobs.
  parseSyntaxTree.kill();
  parseSyntaxTree.drain = done;

  // Adds a file dependency to the compilation.
  // New dependencies will be added to the Webpack watch.
  function addDependency(filepath) {
    if (!deps.hasOwnProperty(filepath)) {
      compilation.fileDependencies.push(filepath);
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
      if (err) return compilation.errors.push(formatError(err, 'could not parse syntax tree for '+ filepath));

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
*
*/
SassThematicPlugin.prototype.build = function(opts, compilation, done) {
  var pendingRenders = 0;
  var completedRenders = 0;
  var renderErrors = [];
  var css = new SassThematic({}, AST.extend(opts.css || {}, opts));
  var template = new SassThematic({}, AST.extend(opts.template || {}, opts));
  css.sass = template.sass = '';

  function publishFile(outputOpts, content) {
    if (outputOpts.banner) {
      content = outputOpts.banner +'\n'+ content;
    }

    if (outputOpts.footer) {
      content += outputOpts.footer;
    }

    compilation.assets[outputOpts.filename] = {
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

  function finish(err) {
    renderErrors.push(err);
    if (pendingRenders === completedRenders) {
      done(renderErrors[0]);
    }
  }

  // Add just included build files:
  opts.includeFiles.forEach(function(filename) {
    if (cache.hasOwnProperty(filename)) {
      css.sass += cache[filename].themeSass;
      template.sass += cache[filename].templateSass;
    }
  });

  // Render CSS output:
  if (opts.css) {
    pendingRenders++;

    css.renderCSS(function(err, css) {
      if (err) formatError(err, 'could not render Sass to theme stylesheet "'+ opts.css.filename +'"');
      publishFile(opts.css, err ? err.message : css);
      completedRenders++;
      finish(err);
    });
  }

  // Render template output:
  if (opts.template) {
    pendingRenders++;

    template.renderTemplate(function(err, template) {
      if (err) formatError(err, 'could not render Sass to theme template "'+ opts.template.filename +'"');
      publishFile(opts.template, err ? err.message : template);
      completedRenders++;
      finish(err);
    });
  }

  finish();
};

module.exports = SassThematicPlugin;
