var assert = require('assert');
var Mocha = require('mocha');
var mocha = new Mocha();

// Add custom assertions:
assert.contain = function(a, b) {
  if (a.indexOf(b) == -1) {
    assert.fail(a, b, 'expected to contain');
  }
};

assert.doesNotContain = function(a, b) {
  if (a.indexOf(b) != -1) {
    assert.fail(a, b, 'expected not to contain');
  }
};

assert.match = function(val, rx) {
  if (!rx.test(val)) {
    assert.fail(val, rx, 'expected to match');
  }
};

assert.doesNotMatch = function(val, rx) {
  if (rx.test(val)) {
    assert.fail(val, rx, 'expected not to match');
  }
};

mocha.reporter('dot');
mocha.addFile('test/import-statements');
mocha.addFile('test/import-resolutions');
mocha.addFile('test/import-paths');
// mocha.addFile('test/ast');
// mocha.addFile('test/reduce-basic');
// mocha.addFile('test/reduce-interpolation');
// mocha.addFile('test/reduce-mixin');
// mocha.addFile('test/reduce-extend');
// mocha.addFile('test/reduce-placeholder');
// mocha.addFile('test/reduce-directive');
// mocha.addFile('test/render');

mocha.run(function(failures) {
  process.on('exit', function() {
    process.exit(failures);
  });
});