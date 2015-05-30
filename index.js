var gonzales = require('gonzales-pe');
var File = require('file-importer');

function extend(base, obj) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) base[i] = obj[i];
  }
  return base;
}

/**
 * Customized compiler for assembling AST data.
 * Loaded file dependencies will have their ASTs precompiled.
 * This compiler wants to aggregate loaded ASTs into one payload.
 */
File.prototype.compile = function(files) {
  if (files.length === 1) {
    // Inherit loaded data and AST directly:
    this.data = files[0].data;
    this.ast = files[0].ast;
  }
  else {
    // Compile aggregate data and AST wrapper.
    // This AST is a stylesheet with many nested stylesheets.
    this.data = '';
    this.ast = gonzales.createNode({
      type: 'stylesheet',
      content: [],
      start: [0, 0],
      end: [0, 0]
    });

    // Use this after the next gonzales release:
    //this.ast = gonzales.parse('', {syntax: 'scss'});

    for (var i = 0; i < files.length; i++) {
      this.data += files[i].data + '\n';
      this.ast.content.push(files[i].ast);
    }
  }

  return this;
};

File.prototype.parse = function(done) {
  // Parse the file's AST.
  // File may already have AST data from previous compile step.
  this.ast = this.ast || gonzales.parse(this.data, {syntax: 'scss'});
  this.ast.file = this.file;

  console.log('parse:', this.file);

  var self = this;
  var ast = this.ast;
  var imports = {};
  var nodes = {};

  // Loop through all root nodes in the stylesheet:
  for (var i=0; i < ast.content.length; i++) {
    var node = ast.content[i];

    // If a root node is an @rule
    if (node.is('atrules')) {
      // Attempt to match an @import statement string:
      var match = node.toCSS('scss').match(/@import\s+['"]([^'"]+)['"]/);

      if (match) {
        var file = match[1];
        var nextNode = ast.content[i+1];

        // Create a file for the import, if we need one:
        if (!imports[file]) {
          imports[file] = self.fork({file: file}).render(next);
        }

        // Assign a file reference for this node:
        nodes[file] = nodes[file] || [];
        nodes[file].push(node);

        // Remove any subsequent delimiter:
        if (nextNode && nextNode.is('declarationDelimiter')) {
          ast.content.splice(i+1, 1);
        }
      }
    }
  }

  function next(err, file) {
    if (err) throw err;

    // Swap the new AST into place for the old @import rule:
    if (file && nodes[file.file]) {
      for (var i=0; i < nodes[file.file].length; i++) {
        var node = nodes[file.file][i];

        // Extend node with all properties of the imported AST:
        for (var prop in file.ast) {
          if (file.ast.hasOwnProperty(prop)) node[prop] = file.ast[prop];
        }
      }
    }

    for (var i in imports) {
      // Abort if there are any pending imports:
      if (imports.hasOwnProperty(i) && !imports[i].isParsed()) return;
    }

    // Mark file as parsed and roll on:
    self._parsed = true;
    done(null, self);
  }

  next();
  return this;
};


module.exports.parse = function(opts, done) {
  new File(opts).render(function(err, file) {
    done(err, file.ast);
  });
};

function doit(opts) {
  new File(opts).render(function(err, file) {
    console.log(JSON.stringify(file.ast, null, '  '));
  });
}

doit({file: 'test/index'});