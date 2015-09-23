var path = require('path');
var assert = require('assert');
var AST = require('../lib/ast');

describe('data option', function() {
  var resultSync, resultAsync;
  var sync, async;

  describe('without file reference', function() {
    var OPTIONS = {
      data: '@import "style/imports/sibling-a";',
      cwd: __dirname
    };

    before(function(done) {
      AST.parse(OPTIONS, function(err, result) {
        resultSync = AST.parseSync(OPTIONS);
        resultAsync = result;
        sync = resultSync.ast;
        async = resultAsync.ast;
        done();
      })
    })

    it ('resolves contents of a provided data string.', function() {
      assert.contain(sync.toString(), '.sibling-a');
      assert.contain(async.toString(), '.sibling-a');
    })

    it ('configures meta data for the root file.', function() {
      assert.equal(sync.uri, __dirname);
      assert.equal(sync.file, __dirname);
      assert.equal(sync.importer, null);

      assert.equal(async.uri, __dirname);
      assert.equal(async.file, __dirname);
      assert.equal(sync.importer, null);
    })

    it ('configures meta data for imports.', function() {
      var importSync = sync.first('stylesheet');
      var importAsync = async.first('stylesheet');
      var uri = 'style/imports/sibling-a';
      var file = path.resolve(__dirname, uri + '.scss');

      assert.equal(importSync.uri, uri);
      assert.equal(importSync.file, file);
      assert.equal(importSync.importer.toString(), OPTIONS.data);

      assert.equal(importAsync.uri, uri);
      assert.equal(importAsync.file, file);
      assert.equal(importAsync.importer.toString(), OPTIONS.data);
    })

    it ('errors upon unresolvable virtual import', function() {
      assert.throws(function() {
        AST.parseSync({data: '@import "imports/sibling-a";', cwd: __dirname});
      }, /could not be resolved/)
    })
  })

  describe('with file reference', function() {
    var OPTIONS = {
      file: 'style/imports/dummy',
      data: '@import "sibling-a";',
      cwd: __dirname
    };

    before(function(done) {
      AST.parse(OPTIONS, function(err, result) {
        resultSync = AST.parseSync(OPTIONS);
        resultAsync = result;
        sync = resultSync.ast;
        async = resultAsync.ast;
        done();
      })
    })

    it ('resolves contents of a provided data string with virtual filepath.', function() {
      assert.contain(sync.toString(), '.sibling-a');
      assert.contain(async.toString(), '.sibling-a');
    })

    it ('resolves contents of a provided data string with full-qualified virtual filepath.', function() {
      var fullUri = AST.parseSync({
        file: './style/imports/dummy.scss',
        data: OPTIONS.data,
        cwd: OPTIONS.cwd
      })
      assert.contain(fullUri.ast.toString(), '.sibling-a');
    })

    it ('configures meta data for the root file.', function() {
      var uri = path.resolve(__dirname, 'style/imports/dummy');

      assert.equal(sync.uri, uri);
      assert.equal(sync.file, uri);
      assert.equal(sync.importer, null);

      assert.equal(async.uri, uri);
      assert.equal(async.file, uri);
      assert.equal(sync.importer, null);
    })

    it ('configures meta data for imports.', function() {
      var importSync = sync.first('stylesheet');
      var importAsync = async.first('stylesheet');
      var uri = 'sibling-a';
      var file = path.resolve(__dirname, 'style/imports/sibling-a.scss');

      assert.equal(importSync.uri, uri);
      assert.equal(importSync.file, file);
      assert.equal(importSync.importer.toString(), OPTIONS.data);

      assert.equal(importAsync.uri, uri);
      assert.equal(importAsync.file, file);
      assert.equal(importAsync.importer.toString(), OPTIONS.data);
    })
  })

  describe('with includePaths', function() {
    it.skip ('')
  })
})