var gonzales = require('gonzales-pe');
var File = require('file-importer');


File.prototype.parse = function(done) {
  //console.log(this.file);
  var self = this;
  var ast = self.ast = gonzales.parse(self.data, {syntax: 'scss'});
  var imports = {};
  var nodes = {};

  // Loop through all root nodes in the stylesheet:
  for (var i=0; i < ast.content.length; i++) {
    var node = ast.content[i];

    // If a root node is an @rule
    if (node.type === 'atrules') {
      // Attempt to match an @import statement string:
      var match = node.toCSS('scss').match(/@import\s+['"]([^'"]+)['"]/);

      if (match) {
        var file = match[1];
        var delimiter = ast.content[i+1];

        // Create a file for the import, if we need one:
        if (!imports[file]) {
          imports[file] = self.fork({file: file}).render(next);
        }

        // Assign a file reference for this node:
        nodes[file] = nodes[file] || [];
        nodes[file].push(node);

        // Remove any subsequent delimiter:
        if (delimiter && delimiter.type === 'declarationDelimiter') {
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
        node.type = file.ast.type;
        node.content = file.ast.content;
      }
      console.log(this.ast);
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

function doit(opts) {
  new File(opts).render(function(err, file) {
    console.log(file);
  });
}

doit({file: 'test/index'});