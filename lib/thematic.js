var fs = require('fs');
var path = require('path');
var gonzales = require('gonzales-pe');
var GonzalesNode = require('gonzales-pe/lib/node/basic-node');

/**
* Gonzales node utilities
* Configured as functional helpers to operate
* on plain objects versus just parsed Nodes.
*/
var Node = {
  toString: function(node) {
    return node.syntax ? GonzalesNode.prototype.toString.call(node) : '';
  },
  first: function(node, type) {
    return GonzalesNode.prototype.first.call(node, type);
  }
};

/**
 * Node type definitions.
 */
var NodeType = {
  ARGUMENTS: 'arguments',
  AT_RULE_R: 'atruler',
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

/**
 * Removable node types.
 * (compiled to a keyed hash for direct lookup access)
 */
var RemovableTypes = [
  NodeType.DECLARATION,
  NodeType.EXTEND,
  NodeType.INCLUDE,
  NodeType.LOOP,
  NodeType.MIXIN,
  NodeType.RULESET,
  NodeType.AT_RULE_R
].reduce(function(memo, type) {
  memo[type] = true;
  return memo;
}, {});

/**
 * Param fields to extend onto the reducer.
 */
var reducerOptions = [
  'varsFile',
  'varsData',
  'themeFile',
  'themeData',
  'templateOpen',
  'templateClose',
  'templateSnakeCase',
  'outputStyle',
  'disableTreeRemoval',
  'disableVarsRemoval'
];

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

  // Write all theme variables into the thematic vars cache:
  this.loadThemeVars();
  this.setThemeVars(this.varsData);
}

SassThematic.prototype = {
  varsFile: null,
  _template: false,
  _pruneTree: true,
  _pruneVars: true,
  templateOpen: '<%= ',
  templateClose: ' %>',
  outputStyle: 'nested',
  disableTreeRemoval: false,
  disableVarsRemoval: false,

  /**
  * Parses raw Sass variable definitions
  * into the thematic mapping of vars names to values.
  */
  setThemeVars: function(sass) {
    var pattern = /(\$[^\s:]+)[\s:]+([^!;]+)/g;
    var match = pattern.exec(sass);

    while (match) {
      this.vars[ match[1] ] = match[2].trim();
      match = pattern.exec(sass);
    }
  },

  /**
  * Loads theme variables into the thematic instance.
  */
  loadThemeVars: function() {
    if (!this.varsData) {
      if (!this.varsFile) throw 'No theme variables file specified.';
      this.varsFile = path.resolve(this.cwd, this.varsFile);
      this.varsData = fs.readFileSync(this.varsFile, 'utf-8');
    }
  },

  /**
  * Loads theme data values into the thematic instance.
  * Attempts to use `themeData/themeFile` references first,
  * and then resorts to using the original variables data.
  */
  loadThemeData: function() {
    if (!this.themeData) {
      if (this.themeFile) {
        this.themeFile = path.resolve(this.cwd, this.themeFile);
        this.themeData = fs.readFileSync(this.themeFile, 'utf-8');
      } else {
        this.loadThemeVars();
        this.themeData = this.varsData;
      }
      this.setThemeVars(this.themeData);
    }
  },

  /**
  * Parses the Thematic AST instance.
  * All non-themed rules and declarations will be eliminated by default.
  * @param {Object} options for parsing:
  * - disableTreeRemoval: true to prevent destructive tree pruning.
  * - disableVarsRemoval: true to prevent destructive variables removal.
  * - template: true for template parsing.
  * @returns {SassThematic} self reference.
  */
  parse: function(opts) {
    var opts = opts || {};
    this._template = !!(opts.template || false);
    this._pruneTree = !(opts.disableTreeRemoval || this.disableTreeRemoval);
    this._pruneVars = !(opts.disableVarsRemoval || this.disableVarsRemoval);
    this._parseNode(this.ast);
    return this;
  },

  /**
   * Methodology for recursively filtering a Sass abstract syntax tree (AST).
   * Each node is explored for relevant variables, and then pruned if irrelevant.
   * @param { object } node: a Gonzales Node object from a parsed AST.
   * @param { array } ancestry: an array of node-type strings prepresenting the current search path.
   * @return { boolean } returns true if the search branch should be retained.
   * @private
   */
  _parseNode: function(node, parent) {
    var keep = false;

    // Track selector heirarchy while drilling into the tree:
    if (node.type === NodeType.SELECTOR) {
      this.selector.push(Node.toString(node).trim());
    }

    // Track derivitive locals created by control-flow loops:
    else if (node.type === NodeType.LOOP) {
      this._mapNodeLocalVars(node);
    }

    // Keep variable declarations and overrides:
    else if (node.type === NodeType.VARIABLE && parent) {
      var varName = Node.toString(node);
      // Test if the var belongs to the set of theme vars:
      var isThemeVar = this.vars.hasOwnProperty(varName);
      // Test if the variable is keepable (includes local derivatives)
      var isKeepableVar = isThemeVar || this.locals.hasOwnProperty(varName);
      // Check usage context to determin if variable is being referenced (versus declared):
      var isRefContext = (parent.type === NodeType.VALUE ||
                          parent.type === NodeType.INTERPOLATION ||
                          parent.type === NodeType.PARENTHESIS ||
                          parent.type === NodeType.ARGUMENTS ||
                          parent.type === NodeType.LOOP);

      if (this._template && isThemeVar && isRefContext) {
        // Check for arguments implementation:
        if (parent.type === NodeType.ARGUMENTS) {
          throw 'Template theme variables are not permitted as arguments:\n>>> '+Node.toString(parent);
        }

        // Check for operations implementation:
        var op = /operator/i;
        for (var i=0; i < parent.content.length; i++) {
          if (op.test(parent.content[i].type)) {
            throw 'Template theme variables are not permitted in operations:\n>>> '+Node.toString(parent);
          }
        }

        var id = Node.first(node, NodeType.IDENTIFIER);
        node.type = id.type;
        node.content = '____'+ id.content +'____';
      }

      // Keep if the variable is being declared (ie, `$banana: yellow;`),
      // or if the variable is keepable and being referenced (ie, `color: $banana;`).
      return (parent.type === NodeType.PROPERTY) || (isRefContext && isKeepableVar);
    }

    // Keep "@include mixin-name;" statements for keepable mixin:
    else if (node.type === NodeType.EXTEND) {
      var extend = Node.toString(node).replace(/@extend\s+(.+)$/, '$1').trim();
      if (this.extend.hasOwnProperty(extend)) return true;
    }

    // Keep "@include mixin-name;" statements for keepable mixin:
    else if (node.type === NodeType.INCLUDE) {
      var include = Node.toString(node).replace(/@include\s+(.+)$/, '$1').trim();
      if (this.mixin.hasOwnProperty(include)) return true;
    }

    // Drop all vars stylesheet includes:
    // This removes the overrideable variables from the compilation entirely.
    else if (node.type === NodeType.STYLE_SHEET && node.file === this.varsFile && this._pruneVars) {
      return this._removeNode(node, 'varsfile');
    }

    // Keep framework helper functions while compiling templates:
    else if (node.type === NodeType.FUNCTION && /^sass-thematic/.test(Node.toString(node))) {
      return !!this._template;
    }

    // Keep node trees with a "// @sass-thematic-keep" comment flag:
    else if (node.type === NodeType.COMMENT && node.content.trim() === '@sass-thematic-keep') {
      return true;
    }

    // Extend filter to all child nodes...
    if (Array.isArray(node.content)) {
      // Recursively filter on all node children:
      for (var i=0; i < node.content.length; i++) {
        keep = this._parseNode(node.content[i], node) || keep;
      }
    }

    // Track mixin names that contain keepable variables:
    if (node.type === NodeType.MIXIN && keep) {
      var ident = Node.first(node, NodeType.IDENTIFIER);
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

    // If we don't need to keep the node and it's a removable type, then drop it:
    // Also check the renderer to see if destructive operations are enabled.
    if (!keep && !!RemovableTypes[node.type] && this._pruneTree) {
      return this._removeNode(node);
    }

    return keep;
  },

  /**
  * Drops a node from the tree:
  * the node's content is replaced by a single-line comment.
  */
  _removeNode: function(node, desc) {
    node.content = ' ' + (desc || node.type);
    node.type = NodeType.COMMENT;
    return false;
  },

  /**
  * Collects local variable definitions that may
  * derrive from a theme variable:
  * Ex: `@each $c in $keep-color`
  */
  _mapNodeLocalVars: function(node) {
    var locals = {};
    var keep = false;
    var loop = Node.toString(node).split('\n')[0];
    var pattern = /(\$[\w-]+)/g;
    var match = pattern.exec(loop);

    while (match) {
      locals[ match[1] ] = 1;
      keep = this.vars.hasOwnProperty(match[1]) || keep;
      match = pattern.exec(loop);
    }

    // Only keep these locals if there was a valid theme variable within the loop:
    this.locals = keep ? locals : {};
  },

  /**
  * Renders flat CSS from pruned theme source.
  * @param {Function} callback function to run on completion.
  * @returns {SassThematic} self reference.
  */
  css: function(opts, done) {
    if (typeof opts !== 'object') {
      done = opts;
      opts = null;
    }
    validateCallback(done);
    this.parse(opts);
    this.renderCSS(done);
    return this;
  },

  /**
  * Renders flat CSS from pruned theme source.
  * Same as `css`, but runs synchronously.
  * @returns {String} rendered CSS string.
  */
  cssSync: function(opts) {
    this.parse(opts);
    return this.renderCSS();
  },

  /**
  * Builds a Sass options object for rendering CSS data.
  * This object may be passed to node-sass for rendering.
  */
  cssSassOptions: function() {
    this.loadThemeData();
    return {
      outputStyle: this.outputStyle,
      data: [
        '$sass-thematic:"css";',
        this.themeData,
        this.toString()
      ].join('\n')
    };
  },

  /**
  * Low-level implementation of CSS rendering.
  * @param {Function} callback for asynchronous rendering.
  * @returns {String|undefined} rendered CSS string (sync) or undefined (async).
  * @private
  */
  renderCSS: function(done) {
    var isSync = (typeof done !== 'function');
    var sass = require('node-sass');
    var opts = this.cssSassOptions();

    if (isSync) {
      try {
        return sass.renderSync(opts).css.toString();
      } catch (err) {
        throw formatSassError(err, opts.data);
      }
    }

    sass.render(opts, function(err, result) {
      if (err) return done(formatSassError(err, opts.data));
      done(null, result.css.toString());
    });
  },

  /**
  * Renders a flat CSS template with interpolation fields.
  * @param {Function} callback function to run on completion.
  * @returns {SassThematic} self reference.
  */
  template: function(opts, done) {
    if (typeof opts !== 'object') {
      done = opts;
      opts = {};
    }
    validateCallback(done);
    opts.template = true;
    this.parse(opts);
    this.renderTemplate(done);
    return this;
  },

  /**
  * Renders a flat CSS template with interpolation fields.
  * Same as `template`, but runs synchronously.
  * @returns {String} rendered template string.
  */
  templateSync: function(opts) {
    opts = opts || {};
    opts.template = true;
    this.parse(opts);
    return this.renderTemplate();
  },

  /**
  * Builds a Sass options object for rendering template data.
  * This object may be passed to node-sass for rendering.
  */
  templateSassOptions: function() {
    return {
      outputStyle: this.outputStyle,
      data: [
        '$sass-thematic:"template";',
        '@function sass-thematic-var($n){ @return ____#{unquote($n)}____; }',
        this.varsData,
        this.toString()
      ].join('\n')
    };
  },

  /**
  * Low-level implementation of template rendering.
  * @param {Function} callback for asynchronous rendering.
  * @returns {String|undefined} rendered template string (sync) or undefined (async).
  * @private
  */
  renderTemplate: function(done) {
    var isSync = (typeof done !== 'function');
    var sass = require('node-sass');
    var opts = this.templateSassOptions();
    var self = this;

    if (isSync) {
      try {
        var result = sass.renderSync(opts);
        return this.fieldLiteralsToInterpolations(result.css.toString());
      } catch (err) {
        throw formatSassError(err, opts.data);
      }
    }

    sass.render(opts, function(err, result) {
      if (err) return done(formatSassError(err, opts.data));
      done(null, self.fieldLiteralsToInterpolations(result.css.toString()));
    });
  },

  /**
  * Regex for matching template field literals.
  */
  FIELD_REGEX: /____(.+?)____/g,

  /**
  * Replaces parsed field literals into template interpolations.
  * Example: "____color-primary____" >> "<%= @color_primary %>"
  * This method is intended to run on rendered CSS containing parsed fields.
  * @param {String} css string to find and replace parsed fields within.
  * @returns {String} the rendered string with fields formatted as interpolations.
  */
  fieldLiteralsToInterpolations: function(css) {
    var self = this;
    return css.replace(this.FIELD_REGEX, function(match, fieldName) {
      if (self.templateSnakeCase) {
        fieldName = fieldName.toLowerCase().replace(/-/g, '_');
      }
      return self.templateOpen + fieldName + self.templateClose;
    });
  },

  /**
  * Replaces parsed field literals into mapped variable values.
  * Example: "____color-primary____" >> "#f00"
  * This method is intended to run on rendered CSS containing parsed fields.
  * @param {String} css string to find and replace parsed fields within.
  * @returns {String} the rendered string with fields formatted as values.
  */
  fieldLiteralsToValues: function(css) {
    this.loadThemeData();
    var mapping = this.vars;
    return css.replace(this.FIELD_REGEX, function(match, fieldName) {
      return mapping['$'+fieldName] || fieldName;
    });
  },

  /**
  * Print rendered contents as a string.
  */
  toString: function() {
    // Allow a pre-compiled "sass" property to return as the object string:
    // (used by live compiler system)
    return this.sass || Node.toString(this.ast);
  }
};

/**
* Validates and throws for missing callback function.
*/
function validateCallback(cb) {
  if (typeof cb !== 'function')
    throw new Error('A callback function is required for async operations.');
}

/**
* Format Sass error for better contextual reporting.
*/
function formatSassError(err, data) {
  // Generate three-line preview around the error:
  var preview = data.split('\n');
  preview = preview.slice(Math.max(0, err.line-2), Math.min(err.line+1, preview.length-1));
  preview = preview.map(function(src) { return '>>> '+ src });
  preview.unshift(err.message);

  var error = new Error('Error rendering theme Sass:\n'+ preview.join('\n'));
  error.line = err.line || null;
  error.column = err.column || null;
  return error;
}

module.exports = SassThematic;
