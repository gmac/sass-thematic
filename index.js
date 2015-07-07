var sassAST = require('./lib/ast');
var Reducer = require('./lib/reduce');

module.exports.parseAST = function(opts, done) {
  sassAST.parse(opts, done);
};

module.exports.parseThemeAST = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var reducer = new Reducer(ast, opts).prune();
    done(err, reducer.ast);
  });
};

module.exports.renderThemeSass = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var reducer = new Reducer(ast, opts).prune();
    done(err, reducer.ast.toString());
  });
};

module.exports.renderThemeTemplate = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    var reducer = new Reducer(ast, opts).template(function(err, template) {
      done(err, template);
    });
  });
};