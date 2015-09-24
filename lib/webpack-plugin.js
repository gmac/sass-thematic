var fs = require('fs');
var os = require('os');
var path = require('path');
var sass = require('node-sass');
var SassThematic = require('./thematic');

function SassThematicPlugin(opts) {
  // Resolve variables file path:
  if (opts.varsFile && !opts.varsData) {
    opts.varsData = fs.readFileSync(path.resolve(opts.varsFile), 'utf-8');
  } else if (!opts.varsData) {
    throw 'No variables file or data was specified.';
  }

  SassThematic.cache = {};
  SassThematic.options = opts;
  SassThematic.renderer = new SassThematic({}, opts);
  SassThematic.renderer.toString = function() {
    var sass = '';

    for (var file in SassThematic.cache) {
      if (SassThematic.cache.hasOwnProperty(file)) {
        sass += SassThematic.cache[file];
      }
    }

    return sass;
  };

  console.log('SassThematicPlugin install');
}

SassThematicPlugin.prototype.apply = function(compiler) {
  compiler.plugin('emit', function(compilation, callback) {

    SassThematic.renderer.renderTemplate(function(err, tmpl) {
      compilation.assets['theme.css'] = {
        source: function() {
          return tmpl;
        },
        size: function() {
          return tmpl.length;
        }
      };
      callback();
    });

  });
};

module.exports = SassThematicPlugin;
