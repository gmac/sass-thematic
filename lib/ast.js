var gonzales = require('gonzales-pe');
var File = require('file-importer');

// Extend properties from `obj` onto `base`:
function extend(base, obj) {
  for (var i in obj)
    if (obj.hasOwnProperty(i)) base[i] = obj[i];
  return base;
}

// Creates an empty Gonzales stylesheet node:
function emptyNode(opts) {
  return extend(gonzales.createNode({
    type: 'stylesheet',
    syntax: 'scss',
    content: [],
    start: {line: 1, column: 1},
    end: {line: 1, column: 1}
  }), opts || {});
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
    this.ast = emptyNode();

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
  this.ast.filepath = this.filepath;
  this.ast.file = this.file;
  //console.log(this.ast);
  //console.log('************');

  var self = this;
  var ast = this.ast;
  var imports = {};

  // Loop through all root nodes in the stylesheet:
  for (var i=0; i < ast.content.length; i++) {
    var node = ast.content[i];
    var nodeDelimiter = ast.content[i+1];

    // If a root node is an @rule
    if (node.is('atrules')) {
      // Attempt to match an @import statement string:
      var match = node.toString('scss').match(/@import\s+['"]([^'"]+)['"]/);

      // Check for a match that does not use CSS @import formatting.
      if (match && !/^url\(|^http:|\.css$/.test(match[1])) {
        var proxyNode = emptyNode({
          file: match[1],
          importer: emptyNode({content: [node]})
        });

        // Remove any subsequent delimiter:
        if (nodeDelimiter && nodeDelimiter.is('declarationDelimiter')) {
          proxyNode.importer.content.push(nodeDelimiter);
        }

        // Swap proxy node for previous import content:
        ast.content.splice(i, proxyNode.importer.content.length, proxyNode);

        // Create a file for the import, if we need one:
        
        if (!imports[proxyNode.file]) {
          imports[proxyNode.file] = self.fork({file: proxyNode.file});
          imports[proxyNode.file].proxyNodes = [];
        }
        
        // Add into the new import's list of proxy instances:
        imports[proxyNode.file].proxyNodes.push(proxyNode);
      }
    }
  }

  // Tell all generated imports to render:
  for (var i in imports) {
    if (imports.hasOwnProperty(i)) imports[i].render(next);
  }

  // Call next in case we had no imports:
  next();

  function next(err, file) {
    if (err) throw err;

    // Swap the new AST into place for the old @import rule:
    if (file) {
      for (var i=0; i < file.proxyNodes.length; i++) {
        extend(file.proxyNodes[i], file.ast);
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

  return this;
};

module.exports.parse = function(opts, done) {
  new File(opts).render(function(err, file) {
    done(err, file.ast);
  });
};