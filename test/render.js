var assert = require('assert');
var sassThematic = require('../index');

describe('sass rendering', function() {

  it ('compiles CSS markup with provided theme variables.', function(done) {
    var opts = {
      themeData: '$keep-color: aqua; $keep-size: 50;',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      outputStyle: 'compressed',
      cwd: __dirname,
    };

    var RESULT = '.keep{color:aqua}.include-keep{color:aqua}';
    var sync = sassThematic.renderThemeCSSSync(opts);

    sassThematic.renderThemeCSS(opts, function(err, async) {
      assert.equal(sync.trim(), RESULT);
      assert.equal(async.trim(), RESULT);
      done();
    });
  });

  it ('compiles CSS templates with interpolations wrapping variable names.', function(done) {
    var opts = {
      templateOpen: '<< ',
      templateClose: ' >>',
      templateSnakeCase: true,
      outputStyle: 'compressed',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      cwd: __dirname,
    };

    var RESULT = '.keep{color:<< keep_color >>}.include-keep{color:<< keep_color >>}';
    var sync = sassThematic.renderThemeTemplateSync(opts);

    sassThematic.renderThemeTemplate(opts, function(err, async) {
      assert.equal(sync.trim(), RESULT);
      assert.equal(async.trim(), RESULT);
      done();
    });
  });

  it ('compiles CSS templates with fields inserted via the "sass-thematic-var" helper function.', function(done) {
    var opts = {
      templateOpen: '<< ',
      templateClose: ' >>',
      templateSnakeCase: true,
      outputStyle: 'compressed',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/helpers.scss',
      cwd: __dirname,
    };

    var RESULT = '.keep{color:<< keep_color >>}';
    var sync = sassThematic.renderThemeTemplateSync(opts);

    sassThematic.renderThemeTemplate(opts, function(err, async) {
      assert.equal(sync.trim(), RESULT);
      assert.equal(async.trim(), RESULT);
      done();
    });
  });

});