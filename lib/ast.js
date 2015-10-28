var fs = require('fs');
var path = require('path');
var gonzales = require('gonzales-pe');
var EventEmitter = require('events').EventEmitter;

/**
* Importer Utilities
* Misc methods that don't need to be on the primary tooling objects.
*/
_ = {
  /**
  * Merge properties from one or more objects onto a base object.
  * @param {Object} base object to receive merged properties.
  * @param {...Object} mixin objects to extend onto base.
  */
  extend: function(base) {
    for (var i=1; i < arguments.length; i++) {
      var ext = arguments[i];
      for (var key in ext) {
        if (ext.hasOwnProperty(key)) base[key] = ext[key];
      }
    }
    return base;
  },

  /**
  * Creates a new empty Gonzales stylesheet node.
  * @param {Object} options to extend onto the new node.
  */
  createNode: function(opts) {
    return this.extend(gonzales.createNode({
      type: 'stylesheet',
      syntax: 'scss',
      content: [],
      start: {line: 1, column: 1},
      end: {line: 1, column: 1}
    }), opts || {});
  },

  /**
  * Maps an AST node to a resolved file.
  * Applies standard meta data to imported nodes:
  * - contents: applies the imported file contents as the node tree.
  * - uri: the original (probably relative) reference used to import the file.
  * - file: the resolved (definitely absolute) file path that the import loaded.
  */
  mapNodeToFile: function(node, file) {
    node.content = file.ast.content;
    node.uri = node.uri || file.file;
    node.file = file.file;
  },

  /**
  * Maps included files from an import onto its parent.
  */
  mapIncludedFiles: function(parentFile, importedFile) {
    if (parentFile.includedFiles.indexOf(importedFile.file) < 0) {
      // Add imported file reference:
      parentFile.includedFiles.push(importedFile.file);

      // Add all of imported file's imports:
      for (var i=0; i < importedFile.includedFiles.length; i++) {
        var includeFile = importedFile.includedFiles[i];
        if (parentFile.includedFiles.indexOf(includeFile) < 0) {
          parentFile.includedFiles.push(includeFile);
        }
      }
    }
  },

  /**
  * Writes a file into the cache of parsed files.
  * File paths may be submitted to expand the file graph,
  * even if we don't have a valid file yet to fill the node.
  */
  cacheFile: function(file) {
    if (!AST.cache) {
      return;
    }
    else if (typeof file === 'string') {
      if (!AST.cache[file]) AST.cache[file] = null;
    }
    else if (file.isParsed() && !file.timestamp) {
      file.timestamp = Date.now();
      AST.cache[file.file] = file;
    }
  }
};


/**
* File Importer
* Primary engine for managing and resolving file imports.
* Manages options and serves as a central cache for resolved files.
* Also the primary event bus for messaging file import actions.
*/
function Importer(opts) {
  var self = this;
  opts = opts || {};
  EventEmitter.call(this);
  this.cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
  this.file = opts.file ? path.resolve(opts.cwd, opts.file) : this.cwd;
  this.data = opts.data;
  this.includePaths = opts.includePaths || [];

  // Map all include paths to configured working directory:
  this.includePaths = this.includePaths.map(function(includePath) {
    return path.resolve(self.cwd, includePath);
  });
}

Importer.prototype = _.extend({}, EventEmitter.prototype, {
  includePaths: [],
  async: true,

  /**
  * Runs the importer config asynchronously.
  */
  run: function(done) {
    this.async = true;
    var self = this;

    function finish(err, file) {
      var hasCallback = (typeof done === 'function');
      if (err && !hasCallback) return self.emit('error', err);
      if (err) return done(err);
      done(null, file);
    }

    if (this.data) {
      this.createFile(this.file, this.uri, this.file, this.data, finish).parse(finish);
    } else {
      this.resolve(this.file, this.cwd, function(err, file) {
        if (err) return finish(err);
        file.parse(finish);
      });
    }

    return this;
  },

  /**
  * Runs the importer config synchronously.
  */
  runSync: function() {
    this.async = false;
    var file;

    if (this.data) {
      file = this.createFile(this.file, this.uri, this.file, this.data);
    } else {
      file = this.resolveSync(this.file, this.cwd);
    }

    return file.parse();
  },


  lookupPaths: function(uri, prevUri) {
    var prev = path.parse(prevUri);
    var file = path.parse(uri);
    file.name = file.name.replace(/^_/, '');

    var lookupPaths = (prev.ext ? [prev.dir] : [prevUri, prev.dir]).concat(this.includePaths);
    var lookupExts = file.ext ? [file.ext] : ['.scss'];
    var lookupNames = [];
    var lookups = [];

    lookupExts.forEach(function(ext) {
      // "_file.ext", "file.ext"
      lookupNames.push('_' + file.name + ext, file.name + ext);
    });

    for (var i=0; i < lookupPaths.length; i++) {
      for (var j=0; j < lookupNames.length; j++) {
        lookups.push(path.resolve(lookupPaths[i], file.dir, lookupNames[j]));
      }
    }

    return lookups;
  },

  resolve: function(uri, prev, done) {
    var self = this;
    var prevUri = (typeof prev === 'string') ? prev : prev.file;
    var paths = this.lookupPaths(uri, prevUri);

    function lookup(index) {
      var filepath = paths[index];
      var isInvalid = !filepath;
      var isCached = (AST.cache && AST.cache[filepath]);

      if (isInvalid || isCached) {
        // Exit early with asynchronous resolution:
        return setImmediate(function() {
          if (isInvalid) {
            done(self.pathLookupError(paths, uri, prevUri));
          }
          else if (isCached) {
            done(null, AST.cache[filepath]);
          }
        });
      }

      fs.readFile(filepath, 'utf-8', function(err, data) {
        if (err && err.code === 'ENOENT') return lookup(index+1);
        if (err) return done(err);
        var file = self.createFile(uri, prev, filepath, data, done);
        done(null, file);
      });
    }

    lookup(0);
  },

  resolveSync: function(uri, prev) {
    var prevUri = (typeof prev === 'string') ? prev : prev.file;
    var paths = this.lookupPaths(uri, prevUri);
    var result = {};

    for (var i=0; i < paths.length; i++) {
      var filepath = paths[i];

      if (AST.cache && AST.cache[filepath]) {
        return AST.cache[filepath];
      }

      try {
        var data = fs.readFileSync(filepath, 'utf-8');
        return this.createFile(uri, prev, filepath, data);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        else throw err;
      }
    }

    throw this.pathLookupError(paths, uri, prevUri);
  },

  createFile: function(uri, prev, filepath, data, errorHandler) {
    var graph = (prev instanceof File) ? prev.graph : [];

    // Throw error for recursive file access:
    if (graph.indexOf(filepath) > -1) {
      var err = new Error('Import error in:\n'+ prev.file + '\nThe import "'+ uri +'" makes recursive file access.');
      if (typeof errorHandler === 'function') return errorHandler(err);
      throw err;
    }

    var file = new File(filepath, data, this);
    file.graph = graph.concat(filepath);
    return file;
  },

  pathLookupError: function(paths, uri, prevUri) {
    return new Error('Import error in:\n'+ prevUri +'\nThe import "'+ uri +'" could not be resolved. Searched paths:\n'
      + paths.map(function(p) { return ' - ' + p }).join('\n'));
  }
});


/**
* File
* Handler for parsing loaded file data into an AST.
* Parsing resolves import statements, thus may request additional files.
*/
function File(filepath, data, importer) {
  this.file = filepath;
  this.data = data;
  this.importer = importer;
  this.includedFiles = [];
  this._cb = [];
  _.cacheFile(filepath);
}

File.prototype = {
  pendingImports: 0,
  resolvedImports: 0,
  timestamp: null,

  isParsed: function() {
    return this.ast && this.pendingImports === this.resolvedImports;
  },

  parse: function(done) {
    var self = this;
    var isAsync = (typeof done === 'function');
    var isSync = !isAsync;
    if (isAsync) this._cb.push(done);

    // Async resolution:
    // Call this whenever we hit an async end point.
    // This will handle resolving all pending callbacks,
    // Passing along errors and standard return data.
    function finish(err) {
      // Run callbacks when we have an error,
      // or when import parsing is complete.
      if (err || self.isParsed()) {
        // Cache the file after parsing:
        _.cacheFile(self);

        // Run all callbacks:
        for (var i=0; i < self._cb.length; i++) self._cb[i](err, self);
        self._cb = [];
      }
    }

    // Node importer:
    // Accepts a parsed @import node with a URI reference.
    // This method handles importing the referenced file
    // using this file as a relative starting point.
    function importFor(node) {
      self.pendingImports++;

      if (isSync) {
        // Sync import:
        var file = self.importer.resolveSync(node.uri, self);
        _.mapNodeToFile(node, file.parse());
        _.mapIncludedFiles(self, file);
        self.resolvedImports++;
        return;
      }

      // Async import:
      self.importer.resolve(node.uri, self, function(err, file) {
        if (err) return finish(err);

        file.parse(function(err, file) {
          if (err) return finish(err);

          _.mapNodeToFile(node, file);
          _.mapIncludedFiles(self, file);
          self.resolvedImports++;
          finish(null);
        });
      });
    }

    if (!this.ast) {
      // Parsing is a synchronous operation,
      // and we only want to do this work once.
      // Only proceed if the AST has not been parsed.
      // Callbacks will happen at the end regardless,
      // and will schedule to run after all imports finish.
      try {
        // Attempt to parse a Gonzales syntax tree.
        this.ast = gonzales.parse(this.data, {syntax: 'scss'});
        _.mapNodeToFile(this.ast, this);
      } catch (err) {
        // Format a better error message describing the problem:
        // (Gonzales gives us some raw data about the contextual error, FTW!)
        err = new Error('Error parsing file:\n '+ this.file +'\n >>>>> '+
          err.css_.split('\n')[err.line-1] +'\n'+ err.message);

        if (isSync) throw err;
        finish(err);
        return this;
      }

      // Loop through all root nodes in the stylesheet:
      for (var i=0; i < this.ast.content.length; i++) {
        var node = this.ast.content[i];
        var nodeDelimiter = this.ast.content[i+1];

        // Keep going unless node is an @rule
        if (!node.is('atrule')) continue;

        // Attempt to match an @import statement string:
        var match = node.toString().match(/@import\s+['"]([^'"]+)['"]/);

        // Check for a match that does not use CSS @import formatting.
        if (match && !/^url\(|^http:|\.css$/.test(match[1])) {
          var importNode = _.createNode({
            importer: _.createNode({content: [node]}),
            uri: match[1]
          });

          // Remove any subsequent delimiter:
          if (nodeDelimiter && nodeDelimiter.is('declarationDelimiter')) {
            importNode.importer.content.push(nodeDelimiter);
          }

          // Swap proxy node for previous import content:
          this.ast.content.splice(i, importNode.importer.content.length, importNode);
          importFor(importNode);
        }
      }
    }

    // Always call finish...
    // This assures that repeated calls to parse
    // will still trigger callbacks.
    isSync ? finish() : setImmediate(finish);
    return this;
  }
};

var AST = {
  cache: null,
  extend: _.extend,

  parse: function(opts, done) {
    return new Importer(opts).run(done);
  },

  parseSync: function(opts) {
    return new Importer(opts).runSync();
  },

  _importer: Importer,
  _file: File
};

module.exports = AST;
