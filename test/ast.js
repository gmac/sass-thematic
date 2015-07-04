var path = require('path');
var assert = require('assert');
var overrides = require('../index');

function stylesheets(ast) {
  return ast.content.filter(function(node) {
    return node.type === 'stylesheet';
  });
}

describe('basic overrides', function() {
  var ast;
  var imports;

  before(function(done) {
    overrides.parseAST({
      cwd: __dirname,
      file: 'style/ast/main.scss',
      includePaths: ['./stylelib/']
    },function(err, obj) {
      ast = obj;
      imports = stylesheets(ast);
      done();
    });
  });

  it ('fulfills all stylesheet imports.', function() {
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
    console.log(sheet.importer.toString());
    //assert.equal(sheet.importer.toString(), "@import 'a';");
  });

  it ('configures meta data for an underscore file import.', function() {
    var sheet = imports[1];
    assert.equal(sheet.file, 'b');
    assert.equal(sheet.filepath, path.join(__dirname, 'style/ast/_b.scss'));
    console.log(sheet.importer.toString());
    //assert.equal(sheet.importer.toString(), "@import 'b';");
  });

  it ('configures meta data for an include path import.', function() {
    var sheet = imports[2];
    assert.equal(sheet.file, 'base/main');
    assert.equal(sheet.filepath, path.join(__dirname, 'stylelib/base/main.scss'));
    //assert.equal(sheet.importer.toString(), "@import 'base/main';");
  });

  it ('configures meta data for a directory path import.', function() {
    var sheet = imports[3];
    assert.equal(sheet.file, 'path');
    assert.equal(sheet.filepath, path.join(__dirname, 'style/ast/path'));
    //assert.equal(sheet.importer.toString(), "@import 'path';");
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