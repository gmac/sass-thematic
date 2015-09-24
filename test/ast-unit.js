var path = require('path');
var assert = require('assert');
var AST = require('../lib/ast');

describe('importer', function() {
  var importer;

  beforeEach(function() {
    importer = new AST._importer();
  })

  it ('resolves files asynchronously with async resolver method.', function(done) {
    var asyncFlow = false;
    importer.resolve('./style/imports/sibling-a.scss', __dirname, function(err, file) {
      file.parse(function(err, file) {
        assert.contain(file.ast.toString(), '.sibling-a');
        assert.equal(asyncFlow, true);
        done();
      });
    });
    asyncFlow = true;
  })

  it ('resolves files synchronously with sync resolver method.', function() {
    var asyncFlow = false;
    var file = importer.resolveSync('./style/imports/sibling-a.scss', __dirname);
    assert.contain(file.parse().ast.toString(), '.sibling-a');
    assert.equal(asyncFlow, false);
    asyncFlow = true;
  })
})
