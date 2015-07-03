var fs = require('fs');
var path = require('path');

var NodeType = {
  BLOCK: 'block',
  DECLARATION: 'declaration',
  DELIMITER_D: 'declarationDelimiter',
  DELIMITER_P: 'propertyDelimiter',
  EXTEND: 'extend',
  IDENTIFIER: 'ident',
  INCLUDE: 'include',
  MIXIN: 'mixin',
  PROPERTY: 'property',
  RULESET: 'ruleset',
  SELECTOR: 'selector',
  SIMPLE_SELECTOR: 'simpleSelector',
  STYLE_SHEET: 'stylesheet',
  VALUE: 'value',
  VARIABLE: 'variable'
};

function Reducer(opts) {
  this.selector = [];
  this.extend = {};
  this.mixins = {}
  this.vars = {};
  this.varsFile = opts.varsFile;

  if (!this.varsFile) throw 'No variables file specified.';
  if (!path.isAbsolute(this.varsFile)) {
    this.varsFile = path.resolve(opts.cwd || process.cwd(), this.varsFile);
  }

  var defaults = fs.readFileSync(this.varsFile, 'utf-8');
  var pattern = /(\$[^\s:]+)[\s:]/g;
  var match = pattern.exec(defaults);

  while (match) {
    this.vars[ match[1] ] = 1;
    match = pattern.exec(defaults);
  }
}

Reducer.prototype = {
  // List of removable node types:
  removeableTypes: [
    NodeType.DECLARATION,
    NodeType.RULESET,
    NodeType.MIXIN,
    'atruleb',
    'atruler'
  ],

  // Checks if a type is removable:
  // constructs and caches types hash on first lookup.
  isRemovable: function(type) {
    return this.removeableTypes.indexOf(type) != -1;
  },

  /**
  * Drops a node from the tree:
  * the node's content is replaced by a single-line comment.
  */
  dropNode: function(node, desc) {
    node.content = ' ' + (desc || node.type);
    node.type = 'singlelineComment';
    return false;
  },

  /**
   * Methodology for recursively filtering a Sass abstract syntax tree (AST).
   * Each node is explored for relevant variables, and then pruned if irrelevant.
   * @param { object } node: a Gonzales Node object from a parsed AST.
   * @param { array } ancestry: an array of node-type strings prepresenting the current search path.
   * @return { boolean } returns true if the search branch should be retained.
   */
  filterNode: function(node, parent) {
    var keep = false;

    // Track selector heirarchy while drilling into the tree:
    if (node.type === NodeType.SELECTOR) {
      this.selector.push(node.toString().trim());
      return false;
    }

    // Keep variable declarations and overrides:
    if (node.type === NodeType.VARIABLE && parent) {
      // Keep if the variable is a property definition ($banana: yellow;)
      return  (parent.type === NodeType.PROPERTY) || 
      // Keep if the variable is an overrideable value:
              (parent.type === NodeType.VALUE && this.vars.hasOwnProperty(node.toString()));
    }

    // Keep "@include mixin-name;" statements for keepable mixins:
    if (node.type === NodeType.EXTEND) {
      var extend = node.toString().replace(/@extend\s+(.+)$/, '$1').trim();
      return this.extend.hasOwnProperty(extend);
    }

    // Keep "@include mixin-name;" statements for keepable mixins:
    if (node.type === NodeType.INCLUDE) {
      var include = node.toString().replace(/@include\s+(.+)$/, '$1').trim();
      return this.mixins.hasOwnProperty(include);
    }

    // Drop all vars stylesheet includes:
    // This removes the overrideable variables from the compilation entirely.
    if (node.type === NodeType.STYLE_SHEET && node.filepath === this.varsFile) {
      return this.dropNode(node, 'varsfile');
    }

    // Extend filter to all child nodes...
    if (Array.isArray(node.content)) {
      // Recursively filter on all node children:
      for (var i=0; i < node.content.length; i++) {
        keep = this.filterNode(node.content[i], node) || keep;
      }
    }
    
    // Track mixin names that contain keepable variables:
    if (node.type === NodeType.MIXIN && keep) {
      var ident = node.first(NodeType.IDENTIFIER);
      if (ident && typeof ident.content === 'string') {
        this.mixins[ ident.content ] = 1;
      }
    }

    // Track valid rulesets for future use by @extend:
    if (node.type === NodeType.RULESET) {

      // Retain all selector names that are being kept:
      if (keep && this.selector.length) {
        this.extend[ this.selector.join(' ') ] = 1;
      }

      // Remove last selector after traversing a ruleset:
      this.selector.pop();
    }

    // If this is a removable node that we're NOT keeping, drop it:
    if (!keep && this.isRemovable(node.type)) {
      return this.dropNode(node);
    }

    return keep;
  }
};


module.exports.parse = function(ast, opts) {
  var reducer = new Reducer(opts);
  reducer.filterNode(ast);
  return ast;
};