var assert = require('assert');
var overrides = require('../index');

describe('ERB Output', function() {
  var linefeed;

  before(function(done) {
    overrides.parse({
      templatize: '<%= VAR %>',
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/all.scss',
      cwd: __dirname,
    }, function(err, template) {
      console.log(template.css.toString());
      done();
    });
  });

  it ('does stuff...', function() {
    //assert.equal(linefeed(10, 1), '// ruleset');
  });

});