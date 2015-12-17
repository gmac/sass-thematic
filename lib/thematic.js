var fs = require('fs');
var path = require('path');
var extend = require('./ast').extend;
var gonzales = require('gonzales-pe');
var GonzalesNode = require('gonzales-pe/lib/node/basic-node');
var GonzalesNodeType = require('gonzales-pe/lib/node/node-types');

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
 * This duplicated Gonzales mapping to allow easier updates,
 * should the Gonzales source naming system ever change.
 */
var NodeType = {
  ARGUMENTS:      GonzalesNodeType.ArgumentsType,
  AT_RULE:        GonzalesNodeType.AtrulerType,
  COMMENT:        GonzalesNodeType.CommentSLType,
  DECLARATION:    GonzalesNodeType.DeclarationType,
  EXTEND:         GonzalesNodeType.ExtendType,
  FUNCTION:       GonzalesNodeType.FunctionType,
  IDENTIFIER:     GonzalesNodeType.IdentType,
  INCLUDE:        GonzalesNodeType.IncludeType,
  INTERPOLATION:  GonzalesNodeType.InterpolationType,
  LOOP:           GonzalesNodeType.LoopType,
  MIXIN:          GonzalesNodeType.MixinType,
  OPERATOR:       /operator/i,
  PARENTHESIS:    GonzalesNodeType.ParenthesesType,
  PROPERTY:       GonzalesNodeType.PropertyType,
  RULESET:        GonzalesNodeType.RulesetType,
  SELECTOR:       GonzalesNodeType.SimpleselectorType,
  STYLE_SHEET:    GonzalesNodeType.StylesheetType,
  VALUE:          GonzalesNodeType.ValueType,
  VARIABLE:       GonzalesNodeType.VariableType
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
  NodeType.AT_RULE
].reduce(function(memo, type) {
  memo[type] = true;
  return memo;
}, {});

/**
 * Param fields to extend onto the reducer.
 */
var thematicOptions = [
  'varsFile',
  'varsData',
  'themeFile',
  'themeData',
  'treeRemoval',
  'varsRemoval',
  'template',
  'templateOpen',
  'templateClose',
  'templateSnakeCase',
  'sassOptions'
];

function ThematicParser(ast, opts) {
  opts = opts || {};
  this.loadSource(ast);
  this.cwd = opts.cwd || process.cwd();
  this.vars = {};

  // Extend valid option names onto this object:
  for (var i=0; i < thematicOptions.length; i++) {
    var attr = thematicOptions[i];
    if (opts.hasOwnProperty(attr)) {
      this[attr] = opts[attr];
    }
  }

  // Write all theme variables into the thematic vars cache:
  this.resetMapping();
  this.loadThemeVars();
  this.setThemeVars(this.varsData);
  this.setFieldFormat(opts.fieldOpen, opts.fieldClose);
}

ThematicParser.prototype = {
  varsFile: null,

  // Default config settings:
  template: false,
  treeRemoval: false,
  varsRemoval: false,
  templateOpen: '<%= ',
  templateClose: ' %>',
  templateSnakeCase: false,
  sassOptions: {
    outputStyle: 'nested'
  },

  // Operational config settings:
  _template: false,
  _treeRemoval: false,
  _varsRemoval: false,

  // Include merge helper for formatting objects:
  merge: extend,

  /**
  * Configures the patterns used as template field literals.
  * @param {String} open token denoting start of field identifier.
  * @param {String} close token denoting end of field identifier.
  */
  setFieldFormat: function(open, close) {
    this.fieldOpen = (typeof open === 'string' && open.length) ? open : '____';
    this.fieldClose = (typeof close === 'string' && close.length) ? close : this.fieldOpen;
    
    var fieldPattern = this.fieldOpen +'(.+?)'+ this.fieldClose;
    this.fieldRegex = new RegExp(fieldPattern);
    this.fieldRegexAll = new RegExp(fieldPattern, 'g');
  },

  /**
  * Parses raw Sass variable definitions
  * into the thematic mapping of vars names to values.
  */
  setThemeVars: function(varsData) {
    if (isJSON(varsData)) {
      // JSON variables
      varsData = JSON.parse(varsData);

      for (var key in varsData) {
        if (varsData.hasOwnProperty(key)) {
          this.vars[normalizeVarName(key)] = varsData[key];
        }
      }
    }
    else {
      // Sass variables
      var pattern = /\$([^\s:]+)\s*:\s*([^!;]+)/g;
      var match = pattern.exec(varsData);

      while (match) {
        this.vars[ match[1] ] = match[2].trim();
        match = pattern.exec(varsData);
      }
    }
  },

  /**
  * Loads theme variables into the thematic instance.
  */
  loadThemeVars: function() {
    if (typeof this.varsData !== 'string') {
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
    if (typeof this.themeData !== 'string') {
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
  * Loads a source file into the renderer.
  * @param {String|Object} source AST, JSON string, or Sass string.
  * @returns {SassThematic} self reference.
  */
  loadSource: function(source) {
    if (typeof source === 'object') {
      this.ast = source;
    }
    else if (typeof source === 'string') {
      // JSON source:
      if (isJSON(source)) {
        this.ast = JSON.parse(source);
      }
      // Sass source:
      else {
        this.ast = gonzales.parse(source, {syntax: 'scss'});
      }
    }
    else {
      throw 'Source could not be loaded.';
    }

    this.resetMapping();
    return this;
  },

  /**
  * Resets all source mappings used while parsing.
  * This gets reset each time a new source is loaded into the parser.
  */
  resetMapping: function() {
    this.selector = [];
    this.locals = {};
    this.extend = {};
    this.mixin = {};
    this.usage = {};
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
    this._template = !!(opts.hasOwnProperty('template') ? opts.template : this.template);
    this._treeRemoval = !!(opts.hasOwnProperty('treeRemoval') ? opts.treeRemoval : this.treeRemoval);
    this._varsRemoval = !!(opts.hasOwnProperty('varsRemoval') ? opts.varsRemoval : this.varsRemoval);
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
    var search = false;

    // Track selector heirarchy while drilling into the tree:
    if (node.type === NodeType.SELECTOR) {
      this.selector.push(Node.toString(node).trim());
    }

    // Track derivitive locals created by control-flow loops:
    else if (node.type === NodeType.LOOP) {
      this._mapNodeLocalVars(node);
      search = true;
    }

    // Keep variable declarations and overrides:
    else if (node.type === NodeType.VARIABLE && parent) {
      var varName = normalizeVarName(Node.toString(node));
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

      // Transform theme variables into fields when rendering to template:
      if (this._template && isThemeVar && isRefContext) {
        this._validateFieldContext(parent);

        var id = Node.first(node, NodeType.IDENTIFIER);
        node.type = id.type;
        node.content = this.fieldOpen + id.content + this.fieldClose;
        this._reportFieldUsage(id.content);
      }

      // Keep if the variable is being declared (ie, `$banana: yellow;`),
      // or if the variable is keepable and being referenced (ie, `color: $banana;`).
      return (parent.type === NodeType.PROPERTY) || (isRefContext && isKeepableVar);
    }

    // Keep "____field-name____" template field identifiers:
    else if (node.type === NodeType.IDENTIFIER && this.isValidFieldName(node.content) && parent) {
      this._validateFieldContext(parent);
      this._reportFieldUsage(node.content.replace(this.fieldRegex, '$1'));
      return true;
    }

    // Keep "@extend class-name;" statements for keepable extensions:
    else if (node.type === NodeType.EXTEND) {
      var target = Node.first(node, NodeType.SELECTOR);
      if (this.extend.hasOwnProperty(target)) return true;
    }

    // Keep "@include mixin-name;" statements for keepable mixins:
    else if (node.type === NodeType.INCLUDE) {
      var target = Node.first(node, NodeType.SELECTOR);
      if (this.mixin.hasOwnProperty(target)) return true;
    }

    // Drop all vars stylesheet includes:
    // This removes the overrideable variables from the compilation entirely.
    else if (node.type === NodeType.STYLE_SHEET && node.file === this.varsFile && this._varsRemoval) {
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

    // Deep search all other node types:
    else {
      search = true;
    }

    // Extend filter to all child nodes...
    if (Array.isArray(node.content) && search) {
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
      //console.log(this.selector);
      // Retain all selector names that are being kept:
      if (keep && this.selector.length) {
        this.extend[ this.selector.join(' ') ] = 1;
      }
      //console.log(this.selector);
      this.selector.pop();
    }

    // Clear local variables after completing a loop:
    else if (node.type === NodeType.LOOP) {
      this.locals = {};
    }

    // If we don't need to keep the node and it's a removable type, then drop it:
    // Also check the renderer to see if destructive operations are enabled.
    if (!keep && !!RemovableTypes[node.type] && this._treeRemoval) {
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
    var pattern = /\$([\w-]+)/g;
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
  * Validates the usage context for a template field.
  * Template fields are post-processed values,
  * therefore may not be used in preprocessed functions, operations, or interpolations.
  * @private
  */
  _validateFieldContext: function(parent) {
    function error(usage) {
      return new Error('Template theme fields are not permitted '+ usage +':\n>>> '+ Node.toString(parent));
    }

    // Check for arguments implementation:
    if (parent.type === NodeType.ARGUMENTS) {
      throw error('as arguments');
    }

    // Check for interpolations implementation:
    if (parent.type === NodeType.INTERPOLATION) {
      throw error('in interpolations');
    }

    // Check for operations implementation:
    for (var i=0; i < parent.content.length; i++) {
      if (NodeType.OPERATOR.test(parent.content[i].type)) {
        throw error('in operations');
      }
    }
  },

  /**
  * Tracks field names used within the source,
  * and keeps a running tally of their use count.
  * @param {String} name of field to report on.
  */
  _reportFieldUsage: function(name) {
    if (!this.usage.hasOwnProperty(name)) {
      this.usage[name] = 0;
    }
    this.usage[name]++;
  },

  /**
  * Validates the formatting of a template field,
  * and checks for its name in the vars mapping table.
  */
  isValidFieldName: function(field) {
    if (this._template) {
      var match = field.match(this.fieldRegex);
      return match && this.vars.hasOwnProperty(match[1]);
    }
    return false;
  },

  /**
  * Renders flat CSS from pruned theme source.
  * @param {Function} callback function to run on completion.
  * @returns {SassThematic} self reference.
  */
  toCSS: function(opts, done) {
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
  toCSSSync: function(opts) {
    this.parse(opts);
    return this.renderCSS();
  },

  /**
  * Builds a Sass options object for rendering CSS data.
  * This object may be passed to node-sass for rendering.
  */
  sassCSSOptions: function() {
    this.loadThemeData();
    return this.merge({}, this.sassOptions || {}, {
      data: [
        '$sass-thematic:"css";',
        this.themeData,
        this.toString()
      ].join('\n')
    });
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
    var opts = this.sassCSSOptions();

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
  toTemplate: function(opts, done) {
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
  toTemplateSync: function(opts) {
    opts = opts || {};
    opts.template = true;
    this.parse(opts);
    return this.renderTemplate();
  },

  /**
  * Builds a Sass options object for rendering template data.
  * This object may be passed to node-sass for rendering.
  */
  sassTemplateOptions: function() {
    return this.merge({}, this.sassOptions || {}, {
      data: [
        '$sass-thematic:"template";',
        '@function sass-thematic-var($n){ @return '+ this.fieldOpen +'#{unquote($n)}'+ this.fieldClose +'; }',
        this.varsData,
        this.toString()
      ].join('\n')
    });
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
    var opts = this.sassTemplateOptions();
    var self = this;

    if (isSync) {
      try {
        var result = sass.renderSync(opts);
        return this.fieldIdentifiersToInterpolations(result.css.toString());
      } catch (err) {
        throw formatSassError(err, opts.data);
      }
    }

    sass.render(opts, function(err, result) {
      if (err) return done(formatSassError(err, opts.data));
      done(null, self.fieldIdentifiersToInterpolations(result.css.toString()));
    });
  },

  /**
  * Counts the usage of all field identifiers in the source text.
  * Field counts are reported into the parser's usage table.
  * @param {String} sass string to count field usage in.
  */
  reportFieldIdentifiers: function(sass) {
    var match;
    while ((match = this.fieldRegexAll.exec(sass)) !== null) {
      if (this.vars.hasOwnProperty(match[1])) {
        this._reportFieldUsage(match[1]);
      }
    }
    return this;
  },

  /**
  * Replaces parsed variable names into field identifiers.
  * Example: "$color-primary" >> "____color-primary____"
  * This method may be used as a plain-text fallback when AST parsing fails.
  * @param {String} sass string to find and replace variable names within.
  * @returns {String} the rendered string with variables formatted as fields.
  */
  varsToFieldIdentifiers: function(sass) {
    return sass.replace(/\$([\w-]+)\s*([^:;\s]*;)/g, function(match, fieldName, terminus) {
      if (this.vars.hasOwnProperty(fieldName)) {
        this._reportFieldUsage(fieldName);
        return this.fieldOpen + fieldName + this.fieldClose + terminus;
      }
      return match;
    }.bind(this));
  },

  /**
  * Replaces parsed field identifiers into template interpolations.
  * Example: "____color-primary____" >> "<%= @color_primary %>"
  * This method is intended to run on rendered CSS containing parsed fields.
  * @param {String} css string to find and replace parsed fields within.
  * @returns {String} the rendered string with fields formatted as interpolations.
  */
  fieldIdentifiersToInterpolations: function(css) {
    return css.replace(this.fieldRegexAll, function(match, fieldName) {
      if (this.templateSnakeCase) {
        fieldName = fieldName.toLowerCase().replace(/-/g, '_');
      }
      return this.templateOpen + fieldName + this.templateClose;
    }.bind(this));
  },

  /**
  * Replaces parsed field identifiers into mapped variable values.
  * Example: "____color-primary____" >> "#f00"
  * This method is intended to run on rendered CSS containing parsed fields.
  * @param {String} css string to find and replace parsed fields within.
  * @returns {String} the rendered string with fields formatted as values.
  */
  fieldIdentifiersToValues: function(css) {
    this.loadThemeData();
    return css.replace(this.fieldRegexAll, function(match, fieldName) {
      return this.vars[fieldName] || fieldName;
    }.bind(this));
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
* Normalizes variable names into their base form.
* Ex: "$bee-bop" => "bee-bop"
*/
function normalizeVarName(name) {
  return name.replace(/^\$/, '');
}

/**
* Checks a string for JSON formatting.
*/
function isJSON(str) {
  str = str.trim();
  return str[0] === '{' && str[str.length-1] === '}';
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

module.exports = ThematicParser;
