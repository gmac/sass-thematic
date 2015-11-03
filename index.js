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

// parseTemplateSass

Thematic.parseSass = function(opts, done) {
  this.parseAST(opts, function(err, ast) {
    var thematic = new Thematic(ast, opts).parse(opts);
    done(err, thematic.ast.toString());
  });
};

Thematic.parseSassSync = function(opts) {
  var ast = this.parseASTSync(opts);
  var thematic = new Thematic(ast, opts).parse(opts);
  return thematic.ast.toString();
};

// renderThemeCSS

Thematic.renderCSS = function(opts, done) {
  AST.parse(opts, function(err, result) {
    new Thematic(result.ast, opts).toCSS(opts, done);
  });
};

Thematic.renderCSSSync = function(opts) {
  var result = AST.parseSync(opts);
  return new Thematic(result.ast, opts).toCSSSync(opts);
};

// renderThemeTemplate

Thematic.renderTemplate = function(opts, done) {
  AST.parse(opts, function(err, result) {
    new Thematic(result.ast, opts).toTemplate(opts, done);
  });
};

Thematic.renderTemplateSync = function(opts) {
  var result = AST.parseSync(opts);
  return new Thematic(result.ast, opts).toTemplateSync(opts);
};

module.exports = Thematic;