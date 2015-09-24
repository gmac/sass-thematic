var fs = require('fs');
var os = require('os');
var path = require('path');
var sass = require('node-sass');
var utils = require('loader-utils');
var async = require('async');
var AST = require('./ast');
var SassThematic = require('./thematic');

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
var threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;

SassThematic.options = SassThematic.options || {};
SassThematic.cache = SassThematic.cache || {};
SassThematic.queue = async.queue(compileThematic, threadPoolSize - 1);

/**
 * SassThematic Async compiler.
 *
 */
function compileThematic(opts, done) {
  AST.parse(opts, function(err, result) {
    if (err) return done(formatError.call(opts.loaderContext, err));
    sass.render({data: formatASTResult(result, opts)}, done);
  });
}

/**
 * Formats the results of AST parsing before rendering Sass.
 * - Loads parsed SassThematic theme into the cache.
 * - Configures imported files as loader dependencies.
 * - Returns full Sass for rendering down the main Webpack pipe.
 * @param {LoaderContext} context of the Webpack loader to interface with.
 * @param {ASTResult} result from parsing an abstract syntax tree.
 * @returns {String} complete Sass string for main-pipe parsing.
 */
function formatASTResult(result, opts) {
  // Render full Sass, and then prune the Sass tree.
  var sassString = result.ast.toString();
  var theme = new SassThematic(result.ast, opts).prune(opts);

  // Cache the pruned theme Sass on Thematic (plugin will handle compiling it).
  SassThematic.cache[result.file] = theme.ast.toString();

  // Add all imports as loader dependencies.
  result.includedFiles.forEach(function(importFile) {
    opts.loaderContext.dependency(importFile);
  });

  // Return the full Sass string to the loader.
  return sassString;
}

/**
 * Enhances the sass error with additional information about what actually went wrong.
 * @param {SassError} err
 * @returns {Error} formatted error object.
 */
function formatError(err) {
  if (!err.file) return err;
  var msg = err.message;

  if (err.file === 'stdin') {
    err.file = this.resourcePath;
  }
  // node-sass returns UNIX-style paths
  err.file = path.normalize(err.file);
  this.dependency(err.file);

  // The 'Current dir' hint of node-sass does not help us, we're providing
  // additional information by reading the err.file property
  msg = msg.replace(/\s*Current dir:\s*/, '');

  err.message = getFileExcerptForError(err) +
    msg.charAt(0).toUpperCase() + msg.slice(1) + os.EOL +
    '      in ' + err.file + ' (line ' + err.line + ', column ' + err.column + ')';

  // Instruct webpack to hide the JS stack from the console
  // Usually you're only interested in the SASS stack in this case.
  err.hideStack = true;
  return err;
}

/**
 * Tries to get an excerpt of the file where the error happened.
 * Uses err.line and err.column.
 * Returns an empty string if the excerpt could not be retrieved.
 *
 * @param {SassError} err
 * @returns {String} formatted file excerpt.
 */
function getFileExcerptForError(err) {
  try {
    var content = fs.readFileSync(err.file, 'utf8');

    return [os.EOL, content.split(os.EOL)[err.line - 1],
      os.EOL, new Array(err.column - 1).join(' '), '^',
      os.EOL, '      '].join('');
  } catch (err) {
    return '';
  }
}

module.exports = function(content) {
  this.cacheable();
  var callback = this.async();
  var isSync = typeof callback !== 'function';
  var self = this;

  /**
   * Setup options
   */
  var opts = AST.extend(utils.parseQuery(this.query), SassThematic.options || {}, {
    loaderContext: this,
    file: this.resourcePath,
    data: content,
    importer: function(filepath) {
      self.dependency(filepath);
    }
  });

  // Minimize output
  if (!opts.outputStyle && this.minimize) {
    opts.outputStyle = 'compressed';
  }

  // Source Maps
  // Not using the `this.sourceMap` flag because css source maps are different
  // @see https://github.com/webpack/css-loader/pull/40
  if (opts.sourceMap) {
    // deliberately overriding the sourceMap option
    // this value is (currently) ignored by libsass when using the data input instead of file input
    // however, it is still necessary for correct relative paths in result.map.sources
    opts.sourceMap = this.options.output.path + '/sass.map';
    opts.omitSourceMapUrl = true;

    // If sourceMapContents option is not set, set it to true otherwise maps will be empty/null
    // when exported by webpack-extract-text-plugin.
    if (opts.sourceMapContents === undefined) {
      opts.sourceMapContents = true;
    }
  }

  // Coerce indentedSyntax flag into a boolean
  opts.indentedSyntax = Boolean(opts.indentedSyntax);

  /**
   * Render it!
   */
  if (isSync) {
    try {
      var result = AST.parseSync(opts);
      result = sass.renderSync({data: formatASTResult(result, opts)});
      return result.css.toString();
    } catch (err) {
      throw formatError.call(this, err);
    }
  }

  SassThematic.queue.push(opts, function(err, result) {
    if (err) return callback(formatError.call(self, err));

    if (result.map && result.map !== '{}') {
      result.map = JSON.parse(result.map);
      result.map.file = self.resourcePath;
      result.map.sources[0] = path.relative(self.options.output.path, self.resourcePath);
    } else {
      result.map = null;
    }

    callback(null, result.css.toString(), result.map);
  });
};
