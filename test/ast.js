var path = require('path');
var assert = require('assert');
var sassThematic = require('../index');

function stylesheets(ast) {
  return ast.content.filter(function(node) {
    return node.type === 'stylesheet';
  });
}

describe('Sass Abstract Syntax Tree', function() {
  var ast;
  var imports;

  before(function(done) {
    sassThematic.parseAST({
      cwd: __dirname,
      file: 'style/ast/main.scss',
      includePaths: ['./stylelib/']
    },function(err, obj) {
      ast = obj;
      imports = stylesheets(ast);
      done();
    });
  });

  it ('fulfills all root imports.', function() {
    assert.equal(imports.length, 4);
  });

  it ('configures meta data for the root stylesheet.', function() {
    assert.equal(ast.file, 'style/ast/main.scss');
    assert.equal(ast.filepath, path.join(__dirname, ast.file));
    assert.equal(ast.importer, null);
  });

  it ('configures meta data for a basic file import.', function() {
    var sheet = imports[0];
    assert.equal(sheet.file, 'a');
    assert.equal(sheet.filepath, path.join(__dirname, 'style/ast/a.scss'));
    assert.equal(sheet.importer.toString(), "@import 'a';");
  });

  it ('configures meta data for an underscore file import.', function() {
    var sheet = imports[1];
    assert.equal(sheet.file, 'b');
    assert.equal(sheet.filepath, path.join(__dirname, 'style/ast/_b.scss'));
    assert.equal(sheet.importer.toString(), "@import 'b';");
  });

  it ('configures meta data for an includePaths import.', function() {
    var sheet = imports[2];
    assert.equal(sheet.file, 'base/main');
    assert.equal(sheet.filepath, path.join(__dirname, 'stylelib/base/main.scss'));
    assert.equal(sheet.importer.toString(), "@import 'base/main';");
  });

  it ('configures meta data for a directory path import.', function() {
    var sheet = imports[3];
    assert.equal(sheet.file, 'path');
    assert.equal(sheet.filepath, path.join(__dirname, 'style/ast/path'));
    assert.equal(sheet.importer.toString(), "@import 'path';");
  });

  it ('ignores @import file references ending with a ".css" extension.', function() {
    assert(ast.toString().indexOf("@import 'test.css';") > -1);
  });

  it ('ignores @import file references starting with a "http:" protocol.', function() {
    assert(ast.toString().indexOf("@import 'http://test.css';") > -1);
  });

  it ('ignores @import file references for "url()" wrappers.', function() {
    assert(ast.toString().indexOf("@import url('test.css');") > -1);
  });

  describe('directory path imports', function() {

    var pathImports;

    before(function() {
      pathImports = stylesheets(imports[3]);
    });

    it ('fulfills sub-path imports.', function() {
      assert.equal(pathImports.length, 2);
    });

    it ('configures meta data for each directory path import file.', function() {
      assert.equal(pathImports[0].file, 'a.scss');
      assert.equal(pathImports[0].filepath, path.join(__dirname, 'style/ast/path/a.scss'));

      assert.equal(pathImports[1].file, 'b.scss');
      assert.equal(pathImports[1].filepath, path.join(__dirname, 'style/ast/path/b.scss'));
    });

    it ('configures no importers for directory path files.', function() {
      assert.equal(pathImports[0].importer, null);
      assert.equal(pathImports[1].importer, null);
    });
  });
});