var sassAST = require('./lib/ast');
var SassThematic = require('./lib/thematic');

// parseAST

module.exports.parseAST = function(opts, done) {
  sassAST.parse(opts, function(err, result) {
    done(err, result.ast);
  });
};

module.exports.parseASTSync = function(opts) {
  return sassAST.parseSync(opts).ast;
};

// parseThemeAST

module.exports.parseThemeAST = function(opts, done) {
  sassAST.parse(opts, function(err, result) {
    var theme = new SassThematic(result.ast, opts).prune();
    done(err, theme.ast);
  });
};

module.exports.parseThemeASTSync = function(opts) {
  var ast = sassAST.parseSync(opts).ast;
  var theme = new SassThematic(ast, opts).prune();
  return theme.ast;
};

// parseThemeSass

module.exports.parseThemeSass = function(opts, done) {
  this.parseThemeAST(opts, function(err, ast) {
    done(err, ast.toString());
  });
};

module.exports.parseThemeSassSync = function(opts) {
  return this.parseThemeASTSync(opts).toString();
};

// parseThemeSass

module.exports.renderThemeCSS = function(opts, done) {
  sassAST.parse(opts, function(err, result) {
    new SassThematic(result.ast, opts).css(done);
  });
};

module.exports.renderThemeTemplate = function(opts, done) {
  sassAST.parse(opts, function(err, result) {
    new SassThematic(result.ast, opts).template(done);
  });
};