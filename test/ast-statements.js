var path = require('path');
var assert = require('assert');
var AST = require('../lib/ast');

describe.only ('@import statements', function() {
  var resultSync, resultAsync;
  var sync, async;

  before(function(done) {
    var opts = {
      file: './style/imports/index.scss',
      cwd: __dirname
    };

    AST.parse(opts, function(err, result) {
      console.log(result.ast.toString());
      resultAsync = result;
      resultSync = AST.parseSync(opts);
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
    var result = AST.parseSync({file: './style/imports/blank.scss', cwd: __dirname});
    assert.match(result.ast.toString(), /^\s*$/);
  })

  it ('ignores CSS import statements.', function() {
    var result = AST.parseSync({file: './style/imports/css-imports.scss', cwd: __dirname});
    assert.doesNotContain(result.ast.toString(), "@import 'blankfile';");
    assert.contain(result.ast.toString(), "@import 'test.css';");
    assert.contain(result.ast.toString(), "@import 'http://test';");
    assert.contain(result.ast.toString(), "@import url(test);");
  })
});
