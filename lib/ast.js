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
  this.files = {};

  // Map all include paths to configured working directory:
  this.includePaths = this.includePaths.map(function(includePath) {
    return path.resolve(self.cwd, includePath);
  });
}

Importer.prototype = _.extend({}, EventEmitter.prototype, {
  includePaths: [],
  files: null,
  async: true,

  run: function(callback) {
    this.async = true;
    var self = this;

    var done = function(err, file) {
      var hasCallback = (typeof callback === 'function');
      if (err && !hasCallback) self.emit('error', err);
      if (hasCallback) callback(err, self._result(file));
      self.emit('end');
    };

    if (this.data) {
      this.createFile(this.file, this.uri, this.file, this.data).parse().then(done);
    } else {
      this.resolve(this.file, this.cwd, function(err, file) {
        if (err) return self.emit('error', err);
        file.parse().then(done);
      });
    }

    return this;
  },

  runSync: function() {
    this.async = false;
    var file;

    if (this.data) {
      file = this.createFile(this.file, this.uri, this.file, this.data);
    } else {
      file = this.resolveSync(this.file, this.cwd);
    }

    return this._result(file.parse());
  },

  _result: function(file) {
    return {
      ast: file.ast,
      file: file.file,
      imports: []
    };
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

    var lookup = function(index) {
      var filepath = paths[index];

      if (!filepath) {
        return self.emit('error', self._pathLookupError(paths, uri, prevUri));
      }

      fs.readFile(filepath, 'utf-8', function(err, data) {
        if (err && err.code === 'ENOENT') return lookup(index+1);
        done(err, self.createFile(uri, prev, filepath, data));
      });
    };

    lookup(0);
  },

  resolveSync: function(uri, prev) {
    var prevUri = (typeof prev === 'string') ? prev : prev.file;
    var paths = this.lookupPaths(uri, prevUri);
    var result = {};

    for (var i=0; i < paths.length; i++) {
      var filepath = paths[i];

      try {
        var data = fs.readFileSync(filepath, 'utf-8');
        return this.createFile(uri, prev, filepath, data);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        else throw err;
      }
    }

    throw this._pathLookupError(paths, uri, prevUri);
  },

  createFile: function(uri, prev, filepath, data) {
    var graph = (prev && prev.graph instanceof Array) ? prev.graph : [];

    // Throw error for recursive file access:
    if (graph.indexOf(filepath) > -1) {
      var err = new Error('Import error in '+ prev.file + '\nThe import "'+ uri +'" makes recursive file access.');
      if (this.async) return this.emit('error', err);
      else throw err;
    }

    var file = new File(filepath, data, this);
    file.graph = graph.concat(filepath);
    return file;
  },

  _pathLookupError: function(paths, uri, prevUri) {
    return new Error('Import error in '+ prevUri +'\nThe import "'+ uri +'" could not be resolved. Searched paths:\n'
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
  this.ast = gonzales.parse(data, {syntax: 'scss'});
  this._mapNodeToFile(this.ast, this);
  this._cb = [];
}

File.prototype = {
  parsed: false,
  pendingImports: 0,
  resolvedImports: 0,

  parse: function() {
    if (this.parsed) return this;

    // Loop through all root nodes in the stylesheet:
    for (var i=0; i < this.ast.content.length; i++) {
      var node = this.ast.content[i];
      var nodeDelimiter = this.ast.content[i+1];

      // Keep going unless node is an @rule
      if (!node.is('atrules')) continue;

      // Attempt to match an @import statement string:
      var match = node.toString('scss').match(/@import\s+['"]([^'"]+)['"]/);

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
        this._import(importNode);
      }
    }

    this.parsed = true;
    this._end();
    return this;
  },

  // Promise interface for attaching a callback to run when complete.
  // While not a real promise, this gets the job done.
  then: function(handler) {
    this._cb.push(handler);
    this._end();
    return this;
  },

  /**
  * Maps an AST node to a resolved file.
  * Applies standard meta data to imported nodes:
  * - contents: applies the imported file contents as the node tree.
  * - uri: the original (probably relative) reference used to import the file.
  * - file: the resolved (definitely absolute) file path that the import loaded.
  */
  _mapNodeToFile: function(node, file) {
    node.content = file.ast.content;
    node.uri = node.uri || file.file;
    node.file = file.file;
  },

  // Imports file contents for a tree node:
  // Import file will be loaded, parsed, and then populate the parent node.
  _import: function(node) {
    var self = this;
    this.pendingImports++;

    if (this.importer.async) {
      this.importer.resolve(node.uri, this, function(err, file) {
        if (err) return self.importer.emit('error', err);
        file.parse().then(function() {
          self._mapNodeToFile(node, file);
          self.resolvedImports++;
          self._end();
        });
      });
    } else {
      var file = this.importer.resolveSync(node.uri, this);
      file.parse();
      self._mapNodeToFile(node, file);
      this.resolvedImports++;
    }
  },

  // Calls for resolution on the file:
  // Call this method after parsing and after each import resolution.
  _end: function() {
    if (this.parsed && this.pendingImports === this.resolvedImports && this._cb.length) {
      var self = this;
      var callbacks = this._cb;
      this._cb = [];

      var done = function() {
        for (var i=0; i < callbacks.length; i++) {
          if (typeof callbacks[i] === 'function') callbacks[i](null, self);
        }
      };

      this.importer.async ? setImmediate(done) : done();
    }
  }
};


module.exports = {
  parse: function(opts, done) {
    return new Importer(opts).run(done);
  },

  parseSync: function(opts) {
    return new Importer(opts).runSync();
  },

  extend: _.extend,
  
  _importer: Importer,
  _file: File
};
