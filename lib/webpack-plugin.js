var fs = require('fs');
var os = require('os');
var path = require('path');
var sass = require('node-sass');
var utils = require('loader-utils');
var async = require('async');
var AST = require('./lib/ast');
var SassThematic = require('./lib/thematic');

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