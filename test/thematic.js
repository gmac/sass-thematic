var assert = require('assert');
var AST = require('../lib/ast');
var Thematic = require('../index');

describe('basics', function() {
  describe('parsing operations', function() {
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/parse.scss',
      treeRemoval: true,
      varsRemoval: true,
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
      var result = theme.parse({treeRemoval: false}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: $keep-color; font-family: serif; }');
    })

    it ('may disable variables omission and tree pruning (effectively resulting in a no-op).', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      assert.equal(theme.parse({treeRemoval: false, varsRemoval: false}).toString(), ast.toString());
    })

    it ('templatizes theme variables.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile // ruleset .keep { color: ____keep-color____; // declaration; }');
    })

    it ('templatizes theme variables throughout an expanded source tree.', function() {
      var theme = new Thematic(JSON.parse(ast.toJson()), opts);
      var result = theme.parse({treeRemoval: false, template: true}).toString();
      assert.equal(normalize(result), '$junk-color: red; $junk-size: 100; // varsfile .junk { color: $junk-color; font-family: serif; } .keep { color: ____keep-color____; font-family: serif; }');
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

  describe('template field usage errors', function() {
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/error.scss',
      cwd: __dirname,
      template: true,
    }

    function assertError(src, error) {
      opts.data = src;
      
      assert.throws(function() {
        new Thematic(AST.parseSync(opts).ast, opts).parse(opts);
      }, error)
    }

    it ('errors when template theme variables are used as function arguments.', function() {
      var message = /not permitted as arguments/;
      assertError('@import "vars"; .error { color: tint($keep-color, 10%); }' , message);
      assertError('@import "vars"; .error { color: tint(____keep-color____, 10%); }', message);
    })

    it ('errors when template theme variables are used in interpolations.', function() {
      var message = /not permitted in interpolations/;
      assertError('@import "vars"; .error { color: #{$keep-color}; }', message);
      // No need to test this format (it's invalid Sass):
      // color: #{____keep-color____};
    })

    it ('errors when template theme variables are used in operations.', function() {
      var message = /not permitted in operations/;
      // Check both unary and other operations:
      assertError('@import "vars"; .error { color: $keep-size + 10; }', message);
      assertError('@import "vars"; .error { color: $keep-size * 10; }', message);

      assertError('@import "vars"; .error { color: ____keep-size____ + 10; }', message);
      assertError('@import "vars"; .error { color: ____keep-size____ * 10; }', message);
    })
  })

  describe('Sass template parsing', function() {
    var target;
    var opts = {
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/basic.scss',
      template: true,
      cwd: __dirname
    }

    before(function() {
      target = AST.parseSync(opts).ast.toString();
      target = target.replace(/color: \$keep-color/g, 'color: ____keep-color____');
    })

    it ('synchronously renders full-source templates.', function() {
      var result = Thematic.parseSassSync(opts);
      assert.equal(result, target);
    })

    it ('asynchronously renders full-source templates.', function(done) {
      Thematic.parseSass(opts, function(err, result) {
        assert.equal(result, target);
        done();
      })
    })

    it ('allows customization of interpolation fields wrappers.', function() {
      var customOpts = AST.extend(opts, {
        fieldOpen: '@@',
        fieldClose: '@@'
      })
      var result = Thematic.parseSassSync(opts);
      assert.equal(result, target.replace(/____/g, '@@'));
    })
  })
})