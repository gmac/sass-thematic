var path = require('path');
var assert = require('assert');
var AST = require('../lib/importer');

describe('file resolution', function() {
  it ('resolves a requested file from a base name.', function() {
    var file = AST.compileSync({file: 'style/resolution/index', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file from a full filename.', function() {
    var file = AST.compileSync({file: 'style/resolution/index.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file with a relative path.', function() {
    var file = AST.compileSync({file: './style/resolution/index.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file with an absolute path.', function() {
    var file = AST.compileSync({file: path.join(__dirname, 'style/resolution/index.scss'), cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file partial without underscore prefix.', function() {
    var file = AST.compileSync({file: 'style/resolution/prefix', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial with underscore prefix.', function() {
    var file = AST.compileSync({file: 'style/resolution/_prefix', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial without underscore prefix, but with file extension.', function() {
    var file = AST.compileSync({file: 'style/resolution/prefix.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial with underscore prefix and file extension.', function() {
    var file = AST.compileSync({file: 'style/resolution/_prefix.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it.skip ('errors upon encountering recursive imports.', function() {
    var result = AST.compileSync({file: 'style/resolution/recursive-a', cwd: __dirname})
    console.log(result.ast.toString());
  })

  it.skip ('resolves contents of a provided data string.', function(done) {
    fileImporter.parse({
      cwd: path.resolve(__dirname, 'lib'),
      data: '@import "resolution/group";'
    }, function(err, data) {
      assert.contain(data, '.group_a');
      assert.contain(data, '.group_b');
      done();
    });
  });
});