var assert = require('assert');
var sassThematic = require('../index');
var Thematic = require('../lib/thematic');

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
    })
  })

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
    })
  })

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
    })
  })

  describe('render helpers', function() {
    var thematic = new Thematic({}, {
      varsData: "$alpha: 0; $omega: 100px;",
      templateOpen: '<%= ',
      templateClose: ' %>'
    });

    it ('converts plain Sass variables into template fields via regex.', function() {
      var result = thematic.varsToFieldLiterals('.style { height: $alpha; width: $omega; }');
      assert.equal(result, '.style { height: ____alpha____; width: ____omega____; }')
    })

    it ('populates template fields with theme variables.', function() {
      var result = thematic.fieldLiteralsToValues('.style { height: ____alpha____; width: ____omega____; }');
      assert.equal(result, '.style { height: 0; width: 100px; }')
    })

    it ('converts template fields into interpolations.', function() {
      var result = thematic.fieldLiteralsToInterpolations('.style { height: ____alpha____; width: ____omega____; }');
      assert.equal(result, '.style { height: <%= alpha %>; width: <%= omega %>; }')
    })
  })
})