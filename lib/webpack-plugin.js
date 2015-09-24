var fs = require('fs');
var os = require('os');
var path = require('path');
var sass = require('node-sass');
var AST = require('./ast');
var SassThematic = require('./thematic');

function SassThematicPlugin(opts) {
  SassThematic.options = opts;
}

SassThematicPlugin.prototype.apply = function(compiler) {
  compiler.plugin('emit', function(compilation, callback) {

    console.log(SassThematic.cache);

    callback();
  });
};

module.exports = SassThematicPlugin;