var assert = require('assert');
var Thematic = require('../index');

function lineFeeder(src) {
  var lines = src.split('\n')
  return function(s, len) {
    return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ')
  };
}

describe('pruning operations', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/basic.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('fulfills an @import with the requested file contents.', function() {
    assert.equal(linefeed(0, 2), '$junk-color: red; $junk-size: 100;')
  })

  it ('drops @import requests for the override variables file.', function() {
    assert.equal(linefeed(2, 1), '// varsfile')
  })

  it ('drops rulesets without override variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset')
  })

  it ('keeps rulesets with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(6, 4), '.keep { color: $keep-color; // declaration; }')
  })

  it ('keeps nested ruleset heirarchies, while dropping their unnecessary declarations.', function() {
    assert.equal(linefeed(11, 3), '.nested { // declaration; // declaration;')
  })

  it ('drops nested rulesets without override variables.', function() {
    assert.equal(linefeed(15, 1), '// ruleset')
  })

  it ('keeps nested rulesets with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(17, 4), '.keep { color: $keep-color; // declaration; }')
  })

  it ('keeps rulesets flagged with an "@sass-thematic-keep" singleline comment.', function() {
    assert.equal(linefeed(23, 3), '.keep { // @sass-thematic-keep }')
  })
})

describe('directive reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/directive.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops loops without override variables.', function() {
    assert.equal(linefeed(4, 1), '// loop')
  })

  it ('keeps loops that contain rulesets with override variables.', function() {
    assert.equal(linefeed(6, 5), '@for $i from 1 through 5 { .keep-#{$i} { color: $keep-color; } }')
  })

  it ('drops loops that inflect and implement unnecessary variables.', function() {
    assert.equal(linefeed(12, 1), '// loop')
  })

  it ('keeps loops that inflect and implement override variables.', function() {
    assert.equal(linefeed(14, 5), '@each $c in $keep-color { .keep { color: $c; } }')
  })
})

describe('@extend reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/extend.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops rulesets without keepable @extend rules or override variables.', function() {
    assert.equal(linefeed(11, 1), '// ruleset')
  })

  it ('keeps rulesets with override variables, but drops unnecessary @extend rules.', function() {
    assert.equal(linefeed(13, 4), '.keep { // extend; color: $keep-color; }')
  })

  it ('keeps rulesets with relevant @extend rules, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(18, 4), '.keep { @extend .extend-keep; // declaration; }')
  })

  it ('drops rulesets that chain @extend rules onto omitted rulesets.', function() {
    assert.equal(linefeed(23, 1), '// ruleset')
  })

  it ('keeps rulesets that chain @extend rules onto preserved rulesets.', function() {
    assert.equal(linefeed(25, 3), '.chain-keep { @extend .keep; }')
  })

  it ('drops nested rulesets without relevant @extend rules or override variables.', function() {
    assert.equal(linefeed(30, 1), '// ruleset')
  })

  it ('keeps nested rulesets with relevant @extend rules, but drops other declarations.', function() {
    assert.equal(linefeed(32, 4), '.keep { @extend .extend-keep; // declaration; }')
  })
})

describe('@extend placeholder reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/placeholder.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops placeholders without keepable override variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset')
  })

  it ('keeps placeholders with override variables, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(6, 4), '%placeholder-keep { color: $keep-color; // declaration; }')
  })

  it ('drops rulesets without keepable @extend rules or override variables.', function() {
    assert.equal(linefeed(11, 1), '// ruleset')
  })

  it ('keeps placeholders with keepable @extend rules, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(13, 4), '.keep { @extend %placeholder-keep; // declaration; }')
  })

  it ('keeps rulesets with keepable child rulesets.', function() {
    assert.equal(linefeed(18, 1), '.nested {')
  })

  it ('drops nested rulesets without relevant @extend rules or override variables.', function() {
    assert.equal(linefeed(19, 1), '// ruleset')
  })

  it ('keeps nested rulesets with relevant @extend rules, but drops other declarations.', function() {
    assert.equal(linefeed(21, 4), '.keep { @extend %placeholder-keep; // declaration; }')
  })
})

describe('interpolation reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/interpolation.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops rulesets that interpolate unnecessary variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset')
  })

  it ('keeps rulesets that interpolate override variables.', function() {
    assert.equal(linefeed(6, 3), '.keep { color: #{$keep-color}; }')
  })
})

describe('@keyframes reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/keyframes.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops @keyframe blocks without override variables.', function() {
    assert.equal(linefeed(4, 1), '// atruler')
  })

  it ('drops @keyframe rulesets without override variables.', function() {
    assert.equal(linefeed(7, 1), '// ruleset')
  })

  it ('keeps @keyframe blocks that contain frames with override variables.', function() {
    assert.equal(linefeed(6, 6), '@keyframes anim-keep { // ruleset 100% { width: $keep-size; } }')
  })
})

describe('@mixin reducer', function() {
  var linefeed;

  before(function(done) {
    Thematic.parseSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/mixin.scss',
      treeRemoval: true,
      varsRemoval: true,
      cwd: __dirname,
    }, function(err, src) {
      linefeed = lineFeeder(src)
      done()
    })
  })

  it ('drops @mixin blocks without override variables.', function() {
    assert.equal(linefeed(4, 1), '// mixin')
  })

  it ('keeps @mixin blocks with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(6, 4), '@mixin mixin-keep() { color: $keep-color; // declaration; }')
  })

  it ('keeps nested ruleset heirarchies.', function() {
    assert.equal(linefeed(11, 1), '.nested {')
  })

  it ('drops rulesets without keepable mixin @include rules or override variables.', function() {
    assert.equal(linefeed(12, 1), '// ruleset')
  })

  it ('keeps rulesets with override variables, but drops omitted mixin @includes.', function() {
    assert.equal(linefeed(14, 4), '.keep { // include; color: $keep-color; }')
  })

  it ('keeps rulesets with a keepable mixin @includes, but drops other declarations.', function() {
    assert.equal(linefeed(19, 4), '.keep { @include mixin-keep; // declaration; }')
  })
})