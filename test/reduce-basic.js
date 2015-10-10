var assert = require('assert');
var AST = require('../lib/ast');
var SassThematic = require('../lib/thematic');
var sassThematicApi = require('../index');

describe('basics', function() {
  describe('parsing operations', function() {
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/parse.scss',
      cwd: __dirname
    };

    var ast = AST.parseSync(opts).ast;

    function normalize(text) {
      return text.split('\n').join(' ').replace(/\s+/g, ' ');
    }

    it ('performs no tree alterations by default.', function() {
      var theme = new SassThematic(JSON.parse(ast.toJson()), opts);
      assert.equal(theme.parse().toString(), ast.toString());
    })

    it ('prunes varsfile references.', function() {
      var theme = new SassThematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({pruneVars: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: $keep-color; font-family: serif; }');
    })

    it ('prunes unthemed tree forks.', function() {
      var theme = new SassThematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({pruneVars: true, pruneTree: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: $keep-color; // declaration; }');
    })

    it ('templatizes theme variables.', function() {
      var theme = new SassThematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({pruneVars: true, template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: ____keep-color____; font-family: serif; }');
    })

    it ('performs all pruning and template operations together.', function() {
      var theme = new SassThematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({pruneVars: true, pruneTree: true, template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: ____keep-color____; // declaration; }');
    })
  })

  describe('pruning operations', function() {
    var linefeed;

    before(function(done) {
      sassThematicApi.parseThemeSass({
        varsFile: 'style/reduce/_vars.scss',
        file: 'style/reduce/basic.scss',
        cwd: __dirname,
      }, function(err, src) {
        var lines = src.split('\n');
        linefeed = function(s, len) {
          return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
        };
        done();
      })
    })

    it ('fulfills an @import with the requested file contents.', function() {
      assert.equal(linefeed(0, 2), '$junk-color: red; $junk-size: 100;');
    })

    it ('drops @import requests for the override variables file.', function() {
      assert.equal(linefeed(2, 1), '// varsfile');
    })

    it ('drops rulesets without override variables.', function() {
      assert.equal(linefeed(4, 1), '// ruleset');
    })

    it ('keeps rulesets with override variables, but drops other declarations.', function() {
      assert.equal(linefeed(6, 4), '.keep { color: $keep-color; // declaration; }');
    })

    it ('keeps nested ruleset heirarchies, while dropping their unnecessary declarations.', function() {
      assert.equal(linefeed(11, 3), '.nested { // declaration; // declaration;');
    })

    it ('drops nested rulesets without override variables.', function() {
      assert.equal(linefeed(15, 1), '// ruleset');
    })

    it ('keeps nested rulesets with override variables, but drops other declarations.', function() {
      assert.equal(linefeed(17, 4), '.keep { color: $keep-color; // declaration; }');
    })

    it ('keeps rulesets flagged with an "@sass-thematic-keep" singleline comment.', function() {
      assert.equal(linefeed(23, 3), '.keep { // @sass-thematic-keep }');
    })
  })

  describe('pruning considerations', function() {
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/basic.scss',
      cwd: __dirname
    };

    it ('performs itempotent pruning, wherein multiple calls will produce the same result.', function() {
      var ast = AST.parseSync(opts).ast;
      var theme = new SassThematic(ast, opts);
      assert.equal(theme.prune().toString(), theme.prune().toString());
    })

    it ('indifferently prunes either node trees or primitive structures.', function() {
      var node = AST.parseSync(opts).ast;
      var json = JSON.parse(node.toJson());
      var themeNode = new SassThematic(node, opts);
      var themeJson = new SassThematic(json, opts);
      assert.equal(themeNode.prune().toString(), themeJson.prune().toString());
    })
  })
})