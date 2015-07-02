var fs = require('fs');
var path = require('path');

var NodeType = {
  DELIMITER_D: 'declarationDelimiter',
  DELIMITER_P: 'propertyDelimiter',
  EXTEND: 'extend',
  IDENTIFIER: 'ident',
  INCLUDE: 'include',
  MIXIN: 'mixin',
  PROPERTY: 'property',
  SIMPLE_SELECTOR: 'simpleSelector',
  STYLE_SHEET: 'stylesheet',
  VARIABLE: 'variable'
};

/**
 * Override variable names, formatted as object keys: {'var-a': 1, 'var-b': 1, ...}
 * These names are parsed directly from the base default variables Sass file.
 */
var VARS_FILE;
var VAR_NAMES;

/**
 * Node types elidgible for removal from the Sass abstract syntax tree:
 * these node types will be eliminated unless they contain a relevant variable.
 */
var REMOVE_NODE_TYPES = {
  'declaration': 1,
  'ruleset': 1,
  'atruleb': 1,
  'atruler': 1,
  'mixin': 1
};

var MIXINS = {};

/**
* Loads the variables file into the application.
*/
function loadVars(opts) {
  VARS_FILE = opts.varsFile;
  VAR_NAMES = {};

  if (!VARS_FILE) throw 'No variables file specified.';
  if (!path.isAbsolute(VARS_FILE)) {
    VARS_FILE = path.resolve(opts.cwd || process.cwd(), VARS_FILE);
  }

  var defaults = fs.readFileSync(VARS_FILE, 'utf-8');
  var pattern = /\$([^\s:]+)[\s:]/g;
  var match = pattern.exec(defaults);

  while (match) {
    VAR_NAMES[ match[1] ] = 1;
    match = pattern.exec(defaults);
  }
}


function firstInstanceOfType(content, type) {
  for (var i = 0; i < content.length; i++) {
    if (content[i].type === type) return content[i];
  }
  return null;
}

/**
* Drops a node from the tree:
* the node's content is replaced by a single-line comment.
*/
function dropNode(node, desc) {
  node.content = ' ' + (desc || node.type);
  node.type = 'singlelineComment';
  return false;
}

/**
 * Methodology for recursively filtering a Sass abstract syntax tree (AST).
 * Each node is explored for relevant variables, and then pruned if irrelevant.
 * @param { object } node: a Gonzales Node object from a parsed AST.
 * @param { array } ancestry: an array of node-type strings prepresenting the current search path.
 * @return { boolean } returns true if the search branch should be retained.
 */
function filterNode(node, ancestry, selector) {
  ancestry = ancestry || [];
  selector = selector || [];
  var parentType = ancestry[ ancestry.length-1 ];
  var contextType = ancestry[ ancestry.length-2 ];
  var keep = false;

  // Check to see if this is a variable identifier. If so, keep it for one of two reasons:
  // - This is one of our whitelisted override variables, -OR-
  // - This is a property definition that we'll possibly need later (ie: `$var-name: #555`)
  // Note: a variable is retained by returning TRUE up the recursive search tree,
  // thus indicating to removable ancestors that they should be retained.
  if (node.type === NodeType.IDENTIFIER && parentType === NodeType.VARIABLE) {
    return contextType === NodeType.PROPERTY || VAR_NAMES.hasOwnProperty(node.content);
  }

  // Keep "@include mixin-name;" statements for keepable mixins:
  if (node.type === NodeType.SIMPLE_SELECTOR && parentType === NodeType.EXTEND) {
    //console.log(ancestry);
    //return true;
  }

  // Keep "@include mixin-name;" statements for keepable mixins:
  if (node.type === NodeType.SIMPLE_SELECTOR && parentType === NodeType.INCLUDE) {
    return MIXINS.hasOwnProperty(node.content);
  }

  // Drop all vars stylesheet includes:
  // This removes the overrideable variables from the compilation entirely.
  if (node.type === NodeType.STYLE_SHEET && node.filepath === VARS_FILE) {
    return dropNode(node, 'varsfile');
  }

  // Extend filter to all child nodes...
  if (Array.isArray(node.content)) {
    // Extend ancestry array for the current node:
    var path = ancestry.slice();
    path.push(node.type);

    // Recursively filter on all node children:
    for (var i=0; i < node.content.length; i++) {
      keep = filterNode(node.content[i], path) || keep;
    }
  }

  // Track mixin names that contain keepable variables:
  if (node.type === NodeType.MIXIN && keep) {
    var ident = firstInstanceOfType(node.content, NodeType.IDENTIFIER);
    if (ident && typeof ident.content === 'string') {
      MIXINS[ ident.content ] = 1;
    }
  }

  // If this is a removable node that we're NOT keeping,
  // then just turn it into a comment noting what we took out.
  if (REMOVE_NODE_TYPES.hasOwnProperty(node.type) && !keep) {
    return dropNode(node);
  }

  return keep;
}


module.exports.parse = function(ast, opts) {
  loadVars(opts);
  //console.log(ast.toJson())
  filterNode(ast);
  return ast;
};