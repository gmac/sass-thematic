var assert = require('assert');
var AST = require('../lib/ast');
var Thematic = require('../lib/thematic');
var thematicApi = require('../index');

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

    it ('parses Sass variables and their values into a mapping table.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      assert.equal(theme.vars['keep-color'], 'green');
      assert.equal(theme.vars['keep-size'], 100);
    })

    it ('parses JSON variables and their values into a mapping table.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      theme.setThemeVars('{"$keep-color":"papayawhip","$keep-size":500}')
      assert.equal(theme.vars['keep-color'], 'papayawhip');
      assert.equal(theme.vars['keep-size'], 500);
    })

    it ('prunes variable includes and unthemed tree forks by default.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse().toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: $keep-color; // declaration; }');
    })

    it ('prunes variable includes and unthemed tree forks by default.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse().toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: $keep-color; // declaration; }');
    })

    it ('may disable tree pruning.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({disableTreeRemoval: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: $keep-color; font-family: serif; }');
    })

    it ('may disable variables omission and tree pruning (effectively resulting in a no-op).', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      assert.equal(theme.parse({disableVarsRemoval: true, disableTreeRemoval: true}).toString(), ast.toString());
    })

    it ('templatizes theme variables.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: ____keep-color____; // declaration; }');
    })

    it ('templatizes theme variables throughout an expanded source tree.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({disableTreeRemoval: true, template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: ____keep-color____; font-family: serif; }');
    })
  })

  describe('pruning operations', function() {
    var linefeed;

    before(function(done) {
      thematicApi.parseThemeSass({
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
      var theme = new Thematic(ast, opts);
      assert.equal(theme.parse().toString(), theme.parse().toString());
    })

    it ('indifferently prunes either node trees or primitive structures.', function() {
      var node = AST.parseSync(opts).ast;
      var json = JSON.parse(node.toJson());
      var themeNode = new Thematic(node, opts);
      var themeJson = new Thematic(json, opts);
      assert.equal(themeNode.parse().toString(), themeJson.parse().toString());
    })
  })

  describe('template pruning errors', function() {
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/error.scss',
      cwd: __dirname,
      template: true,
    };

    it ('errors when template theme variables are used as function arguments.', function() {
      opts.data = '@import "vars"; .error { color: tint($keep-color, 10%); }';
      
      assert.throws(function() {
        new Thematic(AST.parseSync(opts).ast, opts).parse(opts);
      }, /not permitted as arguments/);
    })

    it ('errors when template theme variables are used in interpolations.', function() {
      opts.data = '@import "vars"; .error { color: #{$keep-color}; }';
      
      assert.throws(function() {
        new Thematic(AST.parseSync(opts).ast, opts).parse(opts);
      }, /not permitted in interpolations/);
    })

    it ('errors when template theme variables are used in unary operations (+/-).', function() {
      opts.data = '@import "vars"; .error { color: $keep-size + 10; }';

      assert.throws(function() {
        new Thematic(AST.parseSync(opts).ast, opts).parse(opts);
      }, /not permitted in operations/);
    })

    it ('errors when template theme variables are used in other operations.', function() {
      opts.data = '@import "vars"; .error { color: $keep-size * 10; }';

      assert.throws(function() {
        new Thematic(AST.parseSync(opts).ast, opts).parse(opts);
      }, /not permitted in operations/);
    })
  })

  describe('full template parsing', function() {
    var target;
    var opts = {
      disableVarsRemoval: true,
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/basic.scss',
      cwd: __dirname
    };

    before(function() {
      target = AST.parseSync(opts).ast.toString();
      target = target.replace(/color: \$keep-color/g, 'color: ____keep-color____');
    })

    it ('synchronously renders full-source templates.', function() {
      var result = thematicApi.parseTemplateSassSync(opts);
      assert.equal(result, target);
    })

    it ('asynchronously renders full-source templates.', function(done) {
      thematicApi.parseTemplateSass(opts, function(err, result) {
        assert.equal(result, target);
        done();
      })
    })
  })
})