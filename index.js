var sassAST = require('./lib/ast');
var SassThematic = require('./lib/thematic');

module.exports.parseAST = function(opts, done) {
  sassAST.parse(opts, done);
};

module.exports.parseThemeAST = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var theme = new SassThematic(ast, opts).prune();
    done(err, theme.ast);
  });
};

module.exports.parseThemeSass = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var theme = new SassThematic(ast, opts).prune();
    done(err, theme.ast.toString());
  });
};

module.exports.renderThemeCSS = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    new SassThematic(ast, opts).css(done);
  });
};

module.exports.renderThemeTemplate = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    new SassThematic(ast, opts).template(done);
  });
};