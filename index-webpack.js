var fs = require('fs');
var os = require('os');
var path = require('path');
var sass = require('node-sass');
var utils = require('loader-utils');
var async = require('async');
var AST = require('./lib/ast');
var SassThematic = require('./lib/thematic');

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
var threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;

SassThematic.sass = async.queue(sass.render, threadPoolSize - 1);
SassThematic.cache = {};

module.exports = function(content) {
  this.cacheable();
  var callback = this.async();
  var isSync = typeof callback !== 'function';
  var resourcePath = this.resourcePath;
  var self = this;
  var result;

  /**
   * Enhances the sass error with additional information about what actually went wrong.
   * @param {SassError} err
   */
  function formatError(err) {
    err.file && self.addDependency(err.file);
    var msg = err.message;

    if (err.file === 'stdin') {
      err.file = resourcePath;
    }
    // node-sass returns UNIX-style paths
    err.file = path.normalize(err.file);

    // The 'Current dir' hint of node-sass does not help us, we're providing
    // additional information by reading the err.file property
    msg = msg.replace(/\s*Current dir:\s*/, '');

    err.message = getFileExcerptIfPossible(err) +
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
   * @returns {string}
   */
  function getFileExcerptIfPossible(err) {
    var content;

    try {
      content = fs.readFileSync(err.file, 'utf8');

      return os.EOL +
        content.split(os.EOL)[err.line - 1] + os.EOL +
        new Array(err.column - 1).join(' ') + '^' + os.EOL +
        '      ';
    } catch (err) {
      // If anything goes wrong here, we don't want any errors to be reported to the user
      return '';
    }
  }

  /**
   *
   *
   */
  function sassFromASTResult(result) {
    // Render full Sass, and then prune the Sass tree.
    var sassString = result.ast.toString();
    var theme = new SassThematic(result.ast, opts).prune();

    // Cache the pruned Sass on Thematic (plugin will handle compiling it).
    SassThematic.cache[result.file] = theme.ast.toString();

    // Add all imports as loader dependencies.
    result.imports.forEach(function(importFile) {
      loader.addDependency(importFile);
    });

    // Return the full Sass string to the loader.
    return sassString;
  }

  /**
   * Render it!
   */
  var opts = AST.extend(utils.parseQuery(this.query), {
    file: resourcePath,
    data: content
  });

  if (isSync) {
    try {
      result = AST.parseSync(opts);
    } catch (err) {
      throw formatError(err);
    }

    try {
      result = sass.renderSync({data: sassFromASTResult(result)});
      return result.css.toString();
    } catch (err) {
      throw formatError(err);
    }
  }

  AST.parse(opts, function(err, result) {
    if (err) return callback(formatError(err));

    SassThematic.sass.push({data: sassFromASTResult(result)}, function(err, result) {
      if (err) return callback(formatError(err));

      if (result.map && result.map !== '{}') {
        result.map = JSON.parse(result.map);
        result.map.file = resourcePath;
        result.map.sources[0] = path.relative(self.options.output.path, resourcePath);
      } else {
        result.map = null;
      }

      //addIncludedFilesToWebpack(result.stats.includedFiles);
      callback(null, result.css.toString(), result.map);
    });
  });
};