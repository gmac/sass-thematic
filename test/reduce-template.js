var assert = require('assert');
var sassThematic = require('../index');

describe('ERB Output', function() {
  var linefeed;

  before(function(done) {
    sassThematic.renderThemeTemplate({
      templateOpen: '<%=',
      templateClose: '%>',
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/all.scss',
      cwd: __dirname,
    }, function(err, template) {
      console.log(template);
      done();
    });
  });

  it ('does stuff...', function() {
    //assert.equal(linefeed(10, 1), '// ruleset');
  });

});