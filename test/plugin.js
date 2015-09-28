var path = require('path');
var assert = require('assert');
var SassThematicPlugin = require('../lib/webpack-plugin');

describe.skip('webpack plugin', function() {
  var PATH_A = path.resolve(__dirname, 'style/plugin/a.scss');
  var PATH_B = path.resolve(__dirname, 'style/plugin/b.scss');
  var plugin;

  beforeEach(function() {
    plugin = new SassThematicPlugin({
      varsFile: 'style/plugin/_vars.scss',
      cwd: __dirname,
      output: [{
        includeFiles: [
          'style/plugin/b.scss',
          'style/plugin/a.scss'
        ],
        template: {
          filename: 'test.css.erb',
          templateSnakeCase: true
        },
        css: {
          filename: 'test.css'
        }
      }]
    });

    plugin.compilation = {
      assets: {},
      errors: [],
      fileDependencies: []
    };
  })

  describe('.validateCache', function() {
    var changes;

    beforeEach(function() {
      plugin.cache[PATH_A] = {}
      plugin.cache[PATH_B] = {}
      changes = {
        '/path/test.scss': {}
      }
    })

    it ('passes validation when all files present in the cache.', function() {
      assert(plugin.validateCache(changes))
    })

    it ('invalidates the cache when relevant files have changed.', function() {
      changes[PATH_B] = {};
      assert(!plugin.validateCache(changes))
    })

    it ('fails validation when any files are missing from the cache.', function() {
      plugin.cache[PATH_A] = null;
      assert(!plugin.validateCache(changes))
    })
  })

  describe('.loadCache', function() {
    it ('loads all missing assets into the cache.', function() {
      assert(plugin.validateCache(changes))
    })
  })

})
