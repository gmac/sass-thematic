var sassAST = require('./lib/ast');
var reducer = require('./lib/reduce');

module.exports.parseAST = function(opts, done) {
  sassAST.parse(opts, done);
};

module.exports.parse = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    ast = reducer.parse(ast, opts);
    done(err, ast);
  });
};

module.exports.render = function(opts, done) {
  sassAST.parse(opts, function(err, ast) {
    ast = reducer.parse(ast, opts);
    done(err, ast.toString());
  });
};