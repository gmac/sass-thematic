var assert = require('assert');
var overrides = require('../index');

function render(file, done) {
  overrides.render({
    varsFile: 'scss/_vars.scss',
    file: file,
    cwd: __dirname,
  }, function(err, src) {
    console.log(src);
    done();
  });
}

describe('basic overrides', function() {
  it ('includes a peer file dependency.', function(done) {
    render('scss/basic.scss', done);
    //done();
  });

  it ('includes a prefixed peer dependency.', function(done) {
    done();
  });
});

describe('@mixins overrides', function() {
  it ('includes a peer file dependency.', function(done) {
    render('scss/mixin.scss', done);
    //done();
  });

  it ('includes a prefixed peer dependency.', function(done) {
    done();
  });
});

describe('@extend overrides', function() {
  it ('includes a peer file dependency.', function(done) {
    //render('scss/extend.scss', done);
    done();
  });

  it ('includes a prefixed peer dependency.', function(done) {
    done();
  });
});