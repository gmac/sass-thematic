var sassAST = require('./lib/ast');
var Thematic = require('./lib/thematic');

module.exports.parseAST = function(opts, done) {
  sassAST.parse(opts, done);
};

module.exports.parseThemeAST = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var theme = new Thematic(ast, opts).prune();
    done(err, theme.ast);
  });
};

module.exports.renderThemeSass = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var theme = new Thematic(ast, opts).prune();
    done(err, theme.ast.toString());
  });
};

module.exports.renderThemeCSS = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    new Thematic(ast, opts).css(done);
  });
};

module.exports.renderThemeTemplate = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    new Thematic(ast, opts).template(done);
  });
};