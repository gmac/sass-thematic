var fs = require('fs');
var path = require('path');
var gonzales = require('gonzales-pe');

var NodeType = {
  ARGUMENTS: 'arguments',
  BLOCK: 'block',
  COMMENT: 'singlelineComment',
  DECLARATION: 'declaration',
  DELIMITER_D: 'declarationDelimiter',
  DELIMITER_P: 'propertyDelimiter',
  EXTEND: 'extend',
  FUNCTION: 'function',
  IDENTIFIER: 'ident',
  INCLUDE: 'include',
  INTERPOLATION: 'interpolation',
  LOOP: 'loop',
  MIXIN: 'mixin',
  PARENTHESIS: 'parentheses',
  PROPERTY: 'property',
  RULESET: 'ruleset',
  SELECTOR: 'selector',
  SIMPLE_SELECTOR: 'simpleSelector',
  STYLE_SHEET: 'stylesheet',
  VALUE: 'value',
  VARIABLE: 'variable'
};

var reducerOptions = ['varsFile', 'themeFile', 'themeData', 'templateOpen', 'templateClose', 'templateSnakeCase', 'outputStyle'];

function SassThematic(ast, opts) {
  this.ast = ast;
  this.cwd = opts.cwd || process.cwd();
  this.selector = [];
  this.vars = {};
  this.locals = {};
  this.extend = {};
  this.mixin = {};

  // Extend valid option names onto this object:
  for (var i=0; i < reducerOptions.length; i++) {
    var attr = reducerOptions[i];
    if (opts.hasOwnProperty(attr)) {
      this[attr] = opts[attr];
    }
  }

  // Resolve variables file path:
  if (!this.varsFile) throw 'No variables file specified.';
  if (!path.isAbsolute(this.varsFile)) {
    this.varsFile = path.resolve(this.cwd, this.varsFile);
  }

  // Write all theme variables into the reducer vars cache:
  this.varsText = fs.readFileSync(this.varsFile, 'utf-8');
  var pattern = /(\$[^\s:]+)[\s:]/g;
  var match = pattern.exec(this.varsText);

  while (match) {
    this.vars[ match[1] ] = 1;
    match = pattern.exec(this.varsText);
  }
}

SassThematic.prototype = {
  varsFile: null,
  _template: false,
  templateOpen: '<%= ',
  templateClose: ' %>',
  outputStyle: 'nested',

  // List of removable node types:
  removeableTypes: [
    NodeType.DECLARATION,
    NodeType.EXTEND,
    NodeType.INCLUDE,
    NodeType.LOOP,
    NodeType.MIXIN,
    NodeType.RULESET
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
    node.type = NodeType.COMMENT;
    return false;
  },

  /**
  * Collects local variable definitions that may
  * derrive from an override variable:
  * Ex: `@each $c in $keep-color`
  */
  setLocals: function(node) {
    var locals = {};
    var keep = false;
    var loop = node.toString().split('\n')[0];
    var pattern = /(\$[\w-]+)/g;
    var match = pattern.exec(loop);

    while (match) {
      locals[ match[1] ] = 1;
      keep = this.vars.hasOwnProperty(match[1]) || keep;
      match = pattern.exec(loop);
    }

    // Only keep these locals if there was a valid override within the loop:
    this.locals = keep ? locals : {};
  },

  /**
   * Methodology for recursively filtering a Sass abstract syntax tree (AST).
   * Each node is explored for relevant variables, and then pruned if irrelevant.
   * @param { object } node: a Gonzales Node object from a parsed AST.
   * @param { array } ancestry: an array of node-type strings prepresenting the current search path.
   * @return { boolean } returns true if the search branch should be retained.
   */
  reduceNode: function(node, parent) {
    var keep = false;

    // Track selector heirarchy while drilling into the tree:
    if (node.type === NodeType.SELECTOR) {
      this.selector.push(node.toString().trim());
    }

    // Track derivitive locals created by control-flow loops:
    else if (node.type === NodeType.LOOP) {
      this.setLocals(node);
    }

    // Keep variable declarations and overrides:
    else if (node.type === NodeType.VARIABLE && parent) {
      // Test if the var belongs to the set of override vars:
      var overrideVar = this.vars.hasOwnProperty(node.toString());
      // Test if the variable is keepable (includes local derivatives)
      var keepableVar = overrideVar || this.locals.hasOwnProperty(node.toString());
      // Check usage context to determin if variable is being read (versus written):
      var readingVar = (parent.type === NodeType.VALUE ||
                        parent.type === NodeType.INTERPOLATION ||
                        parent.type === NodeType.PARENTHESIS ||
                        parent.type === NodeType.ARGUMENTS ||
                        parent.type === NodeType.LOOP);

      if (this._template && overrideVar && readingVar) {
        if (parent.type === NodeType.ARGUMENTS) {
          throw 'Theme variables are not permitted as arguments when rendering templates:\n--> '+parent.toString();
        }

        var id = node.first(NodeType.IDENTIFIER);
        node.type = id.type;
        node.content = '____'+ id.content +'____';
      }

      // Keep if the variable is a property being written ($banana: yellow;),
      // or if the variable is keepable and being read (color: $banana;).
      return (parent.type === NodeType.PROPERTY) || (readingVar && keepableVar);
    }

    // Keep "@include mixin-name;" statements for keepable mixin:
    else if (node.type === NodeType.EXTEND) {
      var extend = node.toString().replace(/@extend\s+(.+)$/, '$1').trim();
      if (this.extend.hasOwnProperty(extend)) return true;
    }

    // Keep "@include mixin-name;" statements for keepable mixin:
    else if (node.type === NodeType.INCLUDE) {
      var include = node.toString().replace(/@include\s+(.+)$/, '$1').trim();
      if (this.mixin.hasOwnProperty(include)) return true;
    }

    // Drop all vars stylesheet includes:
    // This removes the overrideable variables from the compilation entirely.
    else if (node.type === NodeType.STYLE_SHEET && node.file === this.varsFile) {
      return this.dropNode(node, 'varsfile');
    }

    // Keep framework helper functions while compiling templates:
    else if (node.type === NodeType.FUNCTION && /^sass-thematic/.test(node.toString())) {
      return !!this._template;
    }

    // Keep node trees with an "// @sass-thematic-keep" comment flag:
    else if (node.type === NodeType.COMMENT && node.content.trim() === '@sass-thematic-keep') {
      return true;
    }

    // Extend filter to all child nodes...
    if (Array.isArray(node.content)) {
      // Recursively filter on all node children:
      for (var i=0; i < node.content.length; i++) {
        keep = this.reduceNode(node.content[i], node) || keep;
      }
    }

    // Track mixin names that contain keepable variables:
    if (node.type === NodeType.MIXIN && keep) {
      var ident = node.first(NodeType.IDENTIFIER);
      if (ident && typeof ident.content === 'string') {
        this.mixin[ ident.content ] = 1;
      }
    }

    // Track valid rulesets for future use by @extend:
    // Remove last selector after traversing a ruleset.
    else if (node.type === NodeType.RULESET) {

      // Retain all selector names that are being kept:
      if (keep && this.selector.length) {
        this.extend[ this.selector.join(' ') ] = 1;
      }

      this.selector.pop();
    }

    // Clear local variables after completing a loop:
    else if (node.type === NodeType.LOOP) {
      this.locals = {};
    }

    // If this is a removable node that we're NOT keeping, drop it:
    if (!keep && this.isRemovable(node.type)) {
      return this.dropNode(node);
    }

    return keep;
  },

  // Invokes pruning on the theme's AST:
  prune: function() {
    this._template = false;
    this.reduceNode(this.ast);
    return this;
  },

  // Invokes pruning, and then compiles to CSS:
  css: function(done) {
    this._renderCSS(true, done);
    return this;
  },

  cssSync: function() {
    return this._renderCSS(false);
  },

  _renderCSS: function(async, done) {
    var sass = require('node-sass');
    this._template = false;
    this.reduceNode(this.ast);

    if (!this.themeData) {
      if (!this.themeFile) throw 'No theme variables file specified.';
      if (!path.isAbsolute(this.themeFile)) {
        this.themeFile = path.resolve(this.cwd, this.themeFile);
      }

      this.themeData = fs.readFileSync(this.themeFile, 'utf-8');
    }

    var opts = {
      outputStyle: this.outputStyle,
      data: ['$sass-thematic:"css";', this.themeData, this.ast.toString()].join('\n')
    };

    if (async) {
      if (typeof done !== 'function') throw 'A callback is required for async css rendering.';
      sass.render(opts, function(err, result) {
        done(err, result.css.toString());
      });
    } else {
      return sass.renderSync(opts).css.toString();
    }
  },

  // Renders a flat CSS template with interpolation fields:
  template: function(done) {
    this._renderTemplate(true, done);
    return this;
  },

  templateSync: function() {
    return this._renderTemplate(false);
  },

  _renderTemplate: function(async, done) {
    var self = this;
    var sass = require('node-sass');
    this._template = true;
    this.reduceNode(this.ast);

    var opts = {
      outputStyle: this.outputStyle,
      data: [
        '$sass-thematic:"template";', 
        '@function sass-thematic-var($n){ @return ____#{unquote($n)}____; }',
        this.varsText,
        this.ast.toString()
      ].join('\n')
    };

    var formatResult = function(result) {
      return result.css.toString().replace(/____(.+?)____/g, function(match, $1) {
        var field = self.templateSnakeCase ? $1.toLowerCase().replace(/-/g, '_') : $1;
        return self.templateOpen + field + self.templateClose;
      });
    };

    if (async) {
      if (typeof done !== 'function') throw 'A callback is required for async template rendering.';
      sass.render(opts, function(err, result) {
        done(err, formatResult(result));
      });
    } else {
      return formatResult(sass.renderSync(opts));
    }
  }
};

module.exports = SassThematic;
