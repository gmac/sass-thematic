var AST = require('./lib/ast');
var Thematic = require('./lib/thematic');

module.exports = {
  // parseAST

  parseAST: function(opts, done) {
    AST.parse(opts, function(err, result) {
      done(err, result.ast);
    });
  },

  parseASTSync: function(opts) {
    return AST.parseSync(opts).ast;
  },

  // parseThemeAST

  parseThemeAST: function(opts, done) {
    AST.parse(opts, function(err, result) {
      var theme = new Thematic(result.ast, opts).parse(opts);
      done(err, theme.ast);
    });
  },

  parseThemeASTSync: function(opts) {
    var result = AST.parseSync(opts);
    var theme = new Thematic(result.ast, opts).parse(opts);
    return theme.ast;
  },

  // parseThemeSass

  parseThemeSass: function(opts, done) {
    this.parseThemeAST(opts, function(err, ast) {
      done(err, ast.toString());
    });
  },

  parseThemeSassSync: function(opts) {
    return this.parseThemeASTSync(opts).toString();
  },

  // renderThemeCSS

  renderThemeCSS: function(opts, done) {
    AST.parse(opts, function(err, result) {
      new Thematic(result.ast, opts).css(opts, done);
    });
  },

  renderThemeCSSSync: function(opts) {
    var result = AST.parseSync(opts);
    return new Thematic(result.ast, opts).cssSync(opts);
  },

  // renderThemeTemplate

  renderThemeTemplate: function(opts, done) {
    AST.parse(opts, function(err, result) {
      new Thematic(result.ast, opts).template(opts, done);
    });
  },

  renderThemeTemplateSync: function(opts) {
    var result = AST.parseSync(opts);
    return new Thematic(result.ast, opts).templateSync(opts);
  },

  // Webpack Plugin

  webpack: function(opts) {
    var ThematicPlugin = require('./lib/webpack-plugin');
    return new ThematicPlugin(opts);
  }
};
