var AST = require('./lib/ast');
var Thematic = require('./lib/thematic');

// parseAST

Thematic.parseAST = function(opts, done) {
  AST.parse(opts, function(err, result) {
    done(err, result.ast);
  });
};

Thematic.parseASTSync = function(opts) {
  return AST.parseSync(opts).ast;
};

// parseThemeAST

Thematic.parseThemeAST = function(opts, done) {
  AST.parse(opts, function(err, result) {
    var theme = new Thematic(result.ast, opts).parse(opts);
    done(err, theme.ast);
  });
};

Thematic.parseThemeASTSync = function(opts) {
  var result = AST.parseSync(opts);
  var theme = new Thematic(result.ast, opts).parse(opts);
  return theme.ast;
};

// parseThemeSass

Thematic.parseThemeSass = function(opts, done) {
  this.parseThemeAST(opts, function(err, ast) {
    done(err, ast.toString());
  });
};

Thematic.parseThemeSassSync = function(opts) {
  return this.parseThemeASTSync(opts).toString();
};

// parseTemplateSass

Thematic.parseTemplateSass = function(opts, done) {
  opts.template = true;
  opts.disableTreeRemoval = true;
  this.parseThemeAST(opts, function(err, ast) {
    done(err, ast.toString());
  });
};

Thematic.parseTemplateSassSync = function(opts) {
  opts.template = true;
  opts.disableTreeRemoval = true;
  return this.parseThemeASTSync(opts).toString();
};

// renderThemeCSS

Thematic.renderThemeCSS = function(opts, done) {
  AST.parse(opts, function(err, result) {
    new Thematic(result.ast, opts).css(opts, done);
  });
};

Thematic.renderThemeCSSSync = function(opts) {
  var result = AST.parseSync(opts);
  return new Thematic(result.ast, opts).cssSync(opts);
};

// renderThemeTemplate

Thematic.renderThemeTemplate = function(opts, done) {
  AST.parse(opts, function(err, result) {
    new Thematic(result.ast, opts).template(opts, done);
  });
};

Thematic.renderThemeTemplateSync = function(opts) {
  var result = AST.parseSync(opts);
  return new Thematic(result.ast, opts).templateSync(opts);
};

module.exports = Thematic;