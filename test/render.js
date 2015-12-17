var assert = require('assert');
var Thematic = require('../index');

describe('sass rendering', function() {
  it ('compiles CSS markup with provided theme variables.', function(done) {
    var opts = {
      themeData: '$keep-color: aqua; $keep-size: 50;',
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      treeRemoval: true,
      varsRemoval: true,
      sassOptions: {
        outputStyle: 'compressed',
      },
      cwd: __dirname
    };

    var RESULT = '.keep{color:aqua}.include-keep{color:aqua}';
    var sync = Thematic.renderCSSSync(opts);

    Thematic.renderCSS(opts, function(err, async) {
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
      treeRemoval: true,
      varsRemoval: true,
      sassOptions: {
        outputStyle: 'compressed',
      },
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/render.scss',
      cwd: __dirname
    };

    var RESULT = '.keep{color:<< keep_color >>}.include-keep{color:<< keep_color >>}';
    var sync = Thematic.renderTemplateSync(opts);

    Thematic.renderTemplate(opts, function(err, async) {
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
      treeRemoval: true,
      varsRemoval: true,
      sassOptions: {
        outputStyle: 'compressed',
      },
      varsFile: 'style/render/_vars.scss',
      file: 'style/render/helpers.scss',
      cwd: __dirname
    };

    var RESULT = '.keep{color:<< keep_color >>}';
    var sync = Thematic.renderTemplateSync(opts);

    Thematic.renderTemplate(opts, function(err, async) {
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
      var result = thematic.varsToFieldIdentifiers('.style { height: $alpha; width: $omega; }');
      assert.equal(result, '.style { height: ____alpha____; width: ____omega____; }')
    })

    it ('populates template fields with theme variables.', function() {
      var result = thematic.fieldIdentifiersToValues('.style { height: ____alpha____; width: ____omega____; }');
      assert.equal(result, '.style { height: 0; width: 100px; }')
    })

    it ('converts template fields into interpolations.', function() {
      var result = thematic.fieldIdentifiersToInterpolations('.style { height: ____alpha____; width: ____omega____; }');
      assert.equal(result, '.style { height: <%= alpha %>; width: <%= omega %>; }')
    })
  })

  describe('usage counts', function() {
    var thematic;

    beforeEach(function() {
      thematic = new Thematic({}, {
        varsData: "$alpha: 0; $omega: 100px;",
        template: true
      })
    })

    it.only ('keeps a running tally of field usage while parsing a source.', function() {
      thematic.loadSource('.style { height: $alpha; width: ____omega____; margin: $omega; }').parse();
      console.log(thematic.usage)
      assert.equal(thematic.usage.alpha, 1)
      assert.equal(thematic.usage.omega, 2)
    })

    it ('keeps a running tally of field usage while parsing vars into fields.', function() {
      thematic.varsToFieldIdentifiers('.style { height: $alpha; width: $omega; margin: $omega; }')
      assert.equal(thematic.usage.alpha, 1)
      assert.equal(thematic.usage.omega, 2)
    })

    it ('generates a running tally of pre-formatted field usage.', function() {
      thematic.reportFieldIdentifiers('.style { height: ____alpha____; width: ____omega____; margin: ____omega____; }')
      assert.equal(thematic.usage.alpha, 1)
      assert.equal(thematic.usage.omega, 2)
    })
  })
})