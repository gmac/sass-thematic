var assert = require('assert');
var sassThematic = require('../index');

describe('template output', function() {
  var template;

  before(function(done) {
    sassThematic.renderThemeTemplate({
      templateOpen: '<<',
      templateClose: '>>',
      templateSnakeCase: true,
      templateOutputStyle: 'compressed',
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/template.scss',
      cwd: __dirname,
    }, function(err, src) {
      template = src.trim();
      done();
    });
  });

  it ('renders flattened CSS with interpolations wrapping variable names.', function() {
    assert.equal(template, '.keep{color:<< keep_color >>}.include-keep{color:<< keep_color >>}');
  });
});