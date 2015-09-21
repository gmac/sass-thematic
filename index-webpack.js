var sassThematic = require('./index');
 
module.exports = function() {
  var callback = this.async();
  var isAsync = (typeof callback === 'function');
  if (!isAsync) throw 'Sass Thematic loader does not allow sync operation.';

  
};