var path = require('path');
var assert = require('assert');
var AST = require('../lib/ast');

describe('file resolution', function() {
  it ('resolves a requested file from a base name.', function() {
    var file = AST.parseSync({file: 'style/resolution/index', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file from a full filename.', function() {
    var file = AST.parseSync({file: 'style/resolution/index.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file with a relative path.', function() {
    var file = AST.parseSync({file: './style/resolution/index.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file with an absolute path.', function() {
    var file = AST.parseSync({file: path.join(__dirname, 'style/resolution/index.scss'), cwd: __dirname});
    assert.contain(file.ast.toString(), '.index');
  })

  it ('resolves a requested file partial without underscore prefix.', function() {
    var file = AST.parseSync({file: 'style/resolution/prefix', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial with underscore prefix.', function() {
    var file = AST.parseSync({file: 'style/resolution/_prefix', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial without underscore prefix, but with file extension.', function() {
    var file = AST.parseSync({file: 'style/resolution/prefix.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('resolves a requested file partial with underscore prefix and file extension.', function() {
    var file = AST.parseSync({file: 'style/resolution/_prefix.scss', cwd: __dirname});
    assert.contain(file.ast.toString(), '.prefix');
  })

  it ('errors upon unresolvable sync imports.', function() {
    assert.throws(function() {
      AST.parseSync({file: 'style/resolution/error.scss', cwd: __dirname});
    }, /could not be resolved/)
  })

  it ('errors upon unresolvable missing async imports.', function(done) {
    AST.parse({file: 'style/resolution/error.scss', cwd: __dirname}, function(err, result) {
      assert(err)
      assert.match(err.message, /could not be resolved/)
      done()
    })
  })

  it ('errors upon encountering recursive sync imports.', function() {
    assert.throws(function() {
      AST.parseSync({file: 'style/resolution/recursive-a', cwd: __dirname})
    }, /recursive file access/)
  })

  it ('errors upon encountering recursive async imports.', function(done) {
    AST.parse({file: 'style/resolution/recursive-a', cwd: __dirname}, function(err, result) {
      assert(err)
      assert.match(err.message, /recursive file access/)
      done()
    })
  })
})
