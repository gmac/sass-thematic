var path = require('path');
var assert = require('assert');
var AST = require('../lib/importer');

describe('@import statements', function() {
  var resultSync, resultAsync;
  var sync, async;

  before(function(done) {
    resultSync = AST.compileSync({
      file: './style/imports/index.scss',
      cwd: __dirname
    });

    AST.compile({
      file: './style/imports/index.scss',
      cwd: __dirname
    }, function(err, result) {
      resultAsync = result;
      sync = resultSync.ast.toString();
      async = resultAsync.ast.toString();
      done();
    });
  })

  it ('includes a peer file dependency.', function() {
    // from index.scss => sibling-a.scss
    assert.contain(sync, '.index');
    assert.contain(sync, '.sibling-a');
    assert.contain(async, '.index');
    assert.contain(async, '.sibling-a');
  })

  it ('includes an underscored partial dependency.', function() {
    // from index.scss => _sibling-b.scss
    assert.contain(sync, '.sibling-b');
    assert.contain(async, '.sibling-b');
  })

  it ('includes deeply-nested peer dependencies.', function() {
    // from index.scss => sibling-c.scss => sibling-d.scss
    assert.contain(sync, '.sibling-c');
    assert.contain(sync, '.sibling-d');
    assert.contain(async, '.sibling-c');
    assert.contain(async, '.sibling-d');
  })

  it ('removes original @import statement during resolution.', function() {
    assert.doesNotContain(sync, '@import');
    assert.doesNotContain(async, '@import');
  })

  it ('allows the import of blank files.', function() {
    var result = AST.compileSync({file: './style/imports/blank.scss', cwd: __dirname});
    assert.match(result.ast.toString(), /^\s*$/);
  })

  it ('ignores CSS import statements.', function() {
    var result = AST.compileSync({file: './style/imports/css-imports.scss', cwd: __dirname});
    assert.doesNotContain(result.ast.toString(), "@import 'blankfile';");
    assert.contain(result.ast.toString(), "@import 'test.css';");
    assert.contain(result.ast.toString(), "@import 'http://test';");
    assert.contain(result.ast.toString(), "@import url(test);");
  })

  it.skip ('emits a reference to each imported file.', function(done) {
    var files = [];
    parse('imports/index')
      .on('file', function(filename) {
        files.push(filename);
      })
      .on('end', function() {
        assert.equal(files.length, 7)
        done();
      });
  });
});