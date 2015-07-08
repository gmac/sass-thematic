var assert = require('assert');
var sassThematic = require('../index');

describe('sass rendering', function() {

  it ('compiles CSS markup with provided theme variables.', function(done) {
    sassThematic.renderThemeCSS({
      themeData: '$keep-color: aqua; $keep-size: 50;',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      outputStyle: 'compressed',
      cwd: __dirname,
    }, function(err, src) {
      assert.equal(src.trim(), '.keep{color:aqua}.include-keep{color:aqua}');
      done();
    });
  });

  it ('compiles CSS templates with interpolations wrapping variable names.', function(done) {
    sassThematic.renderThemeTemplate({
      templateOpen: '<< ',
      templateClose: ' >>',
      templateSnakeCase: true,
      outputStyle: 'compressed',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      cwd: __dirname,
    }, function(err, src) {
      assert.equal(src.trim(), '.keep{color:<< keep_color >>}.include-keep{color:<< keep_color >>}');
      done();
    });
  });

});