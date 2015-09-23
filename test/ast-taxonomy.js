var path = require('path');
var assert = require('assert');
var AST = require('../lib/ast');

function stylesheets(ast) {
  return ast.content.filter(function(node) {
    return node.type === 'stylesheet';
  });
}

describe('Sass Abstract Syntax Tree', function() {
  var sync, async;
  var importsSync, importsAsync;

  before(function(done) {
    sync = AST.parseSync({
      file: './style/taxonomy/main.scss',
      includePaths: ['./stylelib/'],
      cwd: __dirname
    }).ast

    AST.parse({
      file: './style/taxonomy/main.scss',
      includePaths: ['./stylelib/'],
      cwd: __dirname
    }, function(err, result) {
      async = result.ast;
      importsSync = stylesheets(sync);
      importsAsync = stylesheets(async);
      done();
    })
  })

  it ('fulfills all root imports.', function() {
    assert.equal(importsSync.length, 4);
    assert.equal(importsAsync.length, 4);
  })

  it ('configures meta data for the root stylesheet.', function() {
    [sync, async].forEach(function(ast) {
      var file = path.resolve(__dirname, './style/taxonomy/main.scss');
      assert.equal(ast.uri, file);
      assert.equal(ast.file, file);
      assert.equal(ast.importer, null);
    })
  })

  it ('configures meta data for a basic file import.', function() {
    [importsSync[0], importsAsync[0]].forEach(function(sheet) {
      assert.equal(sheet.uri, 'a');
      assert.equal(sheet.file, path.resolve(__dirname, './style/taxonomy/a.scss'));
      assert.equal(sheet.importer.toString(), "@import 'a';");
    })
  })

  it ('configures meta data for an underscore file import.', function() {
    [importsSync[1], importsAsync[1]].forEach(function(sheet) {
      assert.equal(sheet.uri, 'b');
      assert.equal(sheet.file, path.resolve(__dirname, './style/taxonomy/_b.scss'));
      assert.equal(sheet.importer.toString(), "@import 'b';");
    })
  })

  it ('configures meta data for a pathed import.', function() {
    [importsSync[2], importsAsync[2]].forEach(function(sheet) {
      assert.equal(sheet.uri, 'path/c');
      assert.equal(sheet.file, path.resolve(__dirname, './style/taxonomy/path/c.scss'));
      assert.equal(sheet.importer.toString(), "@import 'path/c';");
    })
  })

  it ('configures meta data for an includePaths import.', function() {
    [importsSync[3], importsAsync[3]].forEach(function(sheet) {
      assert.equal(sheet.uri, 'base/main');
      assert.equal(sheet.file, path.resolve(__dirname, './stylelib/base/main.scss'));
      assert.equal(sheet.importer.toString(), "@import 'base/main';");
    })
  })

  describe ('nested imports', function() {
    var nestedSync, nestedAsync;

    before(function() {
      // extract stylesheets from the "path/c" import:
      nestedSync = stylesheets(importsSync[2]);
      nestedAsync = stylesheets(importsAsync[2]);
    })

    it ('fulfills all nested imports.', function() {
      assert.equal(nestedSync.length, 1);
      assert.equal(nestedAsync.length, 1);
    })

    it ('configures meta data for a nested file import.', function() {
      [nestedSync[0], nestedSync[0]].forEach(function(sheet) {
        assert.equal(sheet.uri, 'd');
        assert.equal(sheet.file, path.resolve(__dirname, './style/taxonomy/path/d.scss'));
        assert.equal(sheet.importer.toString(), "@import 'd';");
      })
    })
  })
})