var sassAST = require('./lib/ast');
var SassThematic = require('./lib/thematic');

module.exports = {
  // parseAST

  parseAST: function(opts, done) {
    sassAST.parse(opts, function(err, result) {
      done(err, result.ast);
    });
  },

  parseASTSync: function(opts) {
    return sassAST.parseSync(opts).ast;
  },

  // parseThemeAST

  parseThemeAST: function(opts, done) {
    sassAST.parse(opts, function(err, result) {
      var theme = new SassThematic(result.ast, opts).prune();
      done(err, theme.ast);
    });
  },

  parseThemeASTSync: function(opts) {
    var result = sassAST.parseSync(opts);
    var theme = new SassThematic(result.ast, opts).prune();
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
    sassAST.parse(opts, function(err, result) {
      new SassThematic(result.ast, opts).css(done);
    });
  },

  renderThemeCSSSync: function(opts) {
    var result = sassAST.parseSync(opts);
    return new SassThematic(result.ast, opts).cssSync();
  },

  // renderThemeTemplate

  renderThemeTemplate: function(opts, done) {
    sassAST.parse(opts, function(err, result) {
      new SassThematic(result.ast, opts).template(done);
    });
  },

  renderThemeTemplateSync: function(opts) {
    var result = sassAST.parseSync(opts);
    return new SassThematic(result.ast, opts).templateSync();
  },

  // Webpack Plugin

  webpack: function(opts) {
    var SassThematicPlugin = require('./lib/webpack-plugin');
    return new SassThematicPlugin(opts);
  }
};
