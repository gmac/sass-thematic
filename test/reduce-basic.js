var assert = require('assert');
var sassThematic = require('../index');

describe('basic reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.parseThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/basic.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('fulfills an @import with the requested file contents.', function() {
    assert.equal(linefeed(0, 2), '$junk-color: red; $junk-size: 100;');
  });

  it ('drops @import requests for the override variables file.', function() {
    assert.equal(linefeed(2, 1), '// varsfile');
  });

  it ('drops rulesets without override variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset');
  });

  it ('keeps rulesets with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(6, 4), '.keep { color: $keep-color; // declaration; }');
  });

  it ('keeps nested ruleset heirarchies, while dropping their unnecessary declarations.', function() {
    assert.equal(linefeed(11, 3), '.nested { // declaration; // declaration;');
  });

  it ('drops nested rulesets without override variables.', function() {
    assert.equal(linefeed(15, 1), '// ruleset');
  });

  it ('keeps nested rulesets with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(17, 4), '.keep { color: $keep-color; // declaration; }');
  });

  it ('keeps rulesets flagged with an "@sass-thematic-keep" singleline comment.', function() {
    assert.equal(linefeed(23, 3), '.keep { // @sass-thematic-keep }');
  });
});