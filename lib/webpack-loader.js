module.exports = function(source) {
  if (this.cacheable) this.cacheable();
  this._compilation.sassThematic = this._compilation.sassThematic || {};
  this._compilation.sassThematic[this.resourcePath] = source;
  return source;
};
