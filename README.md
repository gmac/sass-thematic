![SassThematic](title.png)

**A parser for generating dynamic theme stylesheets from Sass.**

* [Workflows](#workflows)
* [Installation, Upgrade, and API](#install)
* [Full API options](#full-api-options)
* [Webpack integration](#webpack-builders)
* [Gulp integration](#gulp-pipe)
* [Credits](#credit)

## The Problem:

We're building a site that gets themed with customizable colors, fonts, sizes, etc. So, we set up a base stylesheet for the site, and then maintain a separate theme stylesheet for custom style overrides.

![](https://cdn2.vox-cdn.com/thumbor/URBw1hzRV7J438s5EUDF8wNszyg=/0x0:1803x1014/1400x788/filters:format(webp)/cdn0.vox-cdn.com/uploads/chorus_image/image/46706550/themes.0.0.jpg)

This works, but makes updates difficult. All changes in the base stylesheet must be mirrored in the theme-specific overrides. Keeping these stylesheets synchronized is tedious and error-prone. It would be great if we could just _automate_ the generation of these theme overrides from the base source... or, just generate a CSS template to be rendered by our application with theme variables at runtime.

This is SassThematic.

## Workflows

SassThematic accomodates two unique workflows for generating CSS themes – each takes a different approach to the problem. A process overview for each workflow is available on the wiki:

* [Theme Override Workflow](https://github.com/gmac/sass-thematic/wiki/Theme-Override-Workflow)
* [Theme Template Workflow](https://github.com/gmac/sass-thematic/wiki/Theme-Template-Workflow)

## Install

Install the NPM package:

```
npm install sass-thematic --save-dev
```

## Upgrading to v2.x

The v2.x API has changed significantly to better support selecting a workflow. Breaking changes:

 - Smaller API, tailored via options. Tree pruning no longer happens by default.
 - Webpack integration removed. Webpack plugins should independently wrap this module.
 - Upgrades to Gonzales-PE latest, and adjusts implementation to match new parsing operations.

## API

SassThematic provides the following API. All methods take similar options, which are fully [outlined below](#full-api-options).

### parseAST
- **thematic.parseAST( options, callback )**
- **thematic.parseASTSync( options )**

Parses and returns a raw abstract syntax tree of your deeply-nested Sass source. The returned object is a [gonzales-pe](https://github.com/tonyganch/gonzales-pe) node tree with all `@import` statements replaced by the imported stylesheet nodes. Use this complete source tree to make your own modifications.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.parseAST({
  file: './styles/main.scss',
  includePaths: ['./lib/']
}, function(err, ast) {
   console.log(ast);
});

// Sync
var ast = thematic.parseASTSync({ ...options... });
```

### parseSass
- **thematic.parseSass( options, callback )**
- **thematic.parseSassSync( options )**

Parses and returns a raw Sass string of your deeply-nested Sass source with optional transformations applied. This raw Sass may be run through the Sass compiler. Options:

* `varsFile` or `varsData`: required to identify relevant theme variables.
* `treeRemoval`: optionally removes Sass rules that do not implement theme variables.
* `varsRemoval`: optionally removes theme variable imports.
* `template`: optionally transforms theme variables into template identifiers.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.parseSass({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/'],
  treeRemoval: true,
  varsRemoval: true,
  template: true
}, function(err, sassString) {
   console.log(sassString);
});

// Sync
var sassString = thematic.parseSassSync({ ...options... });
```

### renderCSS
- **thematic.renderCSS( options, callback )**
- **thematic.renderCSSSync( options )**

Renders a CSS string from your Sass source. Sass is parsed with optional transformations applied, then custom theme variables are prepended, and lastly this custom themed Sass is run through the Sass compiler. Options:

* `varsFile` or `varsData`: required to identify relevant theme variables.
* `themeFile` or `themeData`: required to provide variables for the themed CSS rendering.
* `treeRemoval`: optionally removes Sass rules that do not implement theme variables.
* `varsRemoval`: optionally removes theme variable imports.
* `sassOptions`: options object passed to the Node-Sass compiler.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.renderCSS({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  themeData: '$color1: red; $color2: green;',
  includePaths: ['./lib/']
}, function(err, cssString) {
   console.log(cssString);
});

// Sync
var cssString = thematic.renderCSSSync({ ...options... });
```

### renderTemplate
- **thematic.renderTemplate( options, callback )**
- **thematic.renderTemplateSync( options )**

Renders a CSS template string from your Sass source. Sass is parsed with theme variables preserved as identifiers (and other optional transformations applied), then CSS is compiled from the transformed source, and lastly field identifiers are filled back in with template interpolation fields. Options:

* `varsFile` or `varsData`: required to identify relevant theme variables.
* `treeRemoval`: optionally removes Sass rules that do not implement theme variables.
* `varsRemoval`: optionally removes theme variable imports.
* `templateOpen`: token used to open template interpolation fields (ie: `<%=`).
* `templateClose`: token used to close template interpolation fields (ie: `%>`).
* `templateSnakeCase`: formats all variable names as `snake_case` (lowercase with underscores).
* `sassOptions`: options object passed to the Node-Sass compiler.

Note: theme variable names must pass through the Sass compiler as literal string identifiers, therefore [restrictions apply](https://github.com/gmac/sass-thematic/wiki/Theme-Template-Workflow#restrictions) on how theme variables may be used in pre-rendered Sass contexts.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.renderTemplate({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/'],
  templateOpen: '<%=',
  templateClose: '%>'
}, function(err, templateString) {
   console.log(templateString);
});

// Sync
var templateString = thematic.renderTemplateSync({ ...options... });
```

## Full API Options

#### Required for all methods, one or both:

* **`file`**: String. Path to the main Sass file to load and parse. This may be an absolute path, or else a relative path from `cwd`.

* **`data`**: String. A raw Sass string to parse. You may still provide a `file` option as filepath context for mapping imports.

#### Required for Sass parsing methods, one of:

* **`varsFile`**: String. Path to a file containing all theme variables. This may be an absolute path, or else a relative path from `cwd`. This file must contain all theme variable definitions, and nothing else. Variables may be formatted as Sass or JSON.

* **`varsData`**: String. Data containing variable definitions for all theme variables. Should be formatted as Sass (`$color1: red; $color2: black;`) or JSON (`{"color1": "red", "color2": "black"}`).

#### Required for CSS rendering methods, one of:

* **`themeFile`**: String. Path to a file containing all theme variables to render CSS with. This may be an absolute path, or else a relative path from `cwd`.

* **`themeData`**: String. Data containing Sass variable definitions for all theme variables rendered into CSS. Should be formatted as Sass (`$color1: red; $color2: black;`) or JSON (`{"color1": "red", "color2": "black"}`).

#### Optional options:

* **`includePaths`**: Array. List of base paths to search while performing file lookups. These should be absolute directory paths, or else relative to `cwd`. This operates just like the `node-sass` option of the same name.

* **`cwd`**: String. Path of the directory to resolve `file`, `varsFile`, `themeFile`,  and `includePaths` references from. Uses `process.cwd()` by default.

* **`treeRemoval`**: Boolean. Enables the removal of tree nodes that do not implement theme variables.

* **`varsRemoval`**: Boolean. Enables the removal of theme variable imports. Be sure to use the Sass `!default` flag when leaving theme variable imports in the source tree.

* **`templateOpen`**: String. The opening token for template interpolation fields. Uses ERB-style `<%=` by default.

* **`templateClose`**: String. The closing token for template interpolation fields. Uses ERB-style `%>` by default.

* **`templateSnakeCase`**: Boolean. Enables the transformation of template variable names into `snake_case` (lowercase with underscores).

* **`fieldOpen`**: String. The opening token wrapping field literals that get sent through the Sass compiler. Uses `____` (four underscores) by default.

* **`fieldClose`**: String. The closing token wrapping field literals that get sent through the Sass compiler. Uses `____` (four underscores) by default.

* **`sassOptions`**: Object. For rendering methods, this options object is passed through to the Sass compiler. See [node-sass](https://www.npmjs.com/package/node-sass) docs for possible values.

## Webpack Builders

As of v2.x, Webpack integration has been broken out into wrapper modules. Build objectives vary wildly, so SassThematic remains unopinionated about how it hooks into a build pipeline. The following Webpack wrappers exist:

- [sass-theme-template-loader](https://github.com/gmac/sass-theme-template-loader): compiles full-source CSS templates with theme variables as interpolation fields.
- [sass-thematic-webpack-plugin](https://github.com/gmac/sass-thematic/blob/v1.3.0/lib/webpack-plugin.js): original live-compiler implementation included in SassThematic v1.3. No longer maintained by author, but available if anyone wants to break it out into a community project.

## Gulp Pipe

It's pretty simple to setup a Gulp pipe that hooks multiple Sass entry point files into SassThematic. Use the following as a basic template:

```javascript
var gulp = require('gulp');
var vinyl = require('vinyl');
var through2 = require('through2');
var thematic = require('sass-thematic');

// SassThematic Gulp pipe:
function sassTheme(opts) {
  var output = '';
  return through2.obj(function(file, enc, done) {
      opts.file = file.path;
      opts.data = file.contents.toString('utf-8');

      thematic.parseThemeSass(opts, function(err, result) {
        output += result;
        done();
      });
    },
    function(done) {
      this.push(new vinyl({
        path: 'theme.scss',
        contents: new Buffer(output)
      }));
      done();
    });
}

// Then use it...
gulp.task('theme', function() {
  return gulp.src('components/**/index.scss')
    .pipe(sassTheme({ ... opts ...}))
    .pipe(gulp.dest('/path/to/output/dir'));
});
```

## Credit

This toolkit would be impossible without the hard work of [@tonyganch](https://github.com/tonyganch) on the [gonzales-pe](https://github.com/tonyganch/gonzales-pe) lexer, which provides the framework for intelligently dismantling Sass. Serious kudos.

Brought to you by [Vox Media](http://voxmedia.com). <img src="http://fonts.voxmedia.com/emoji/voxmedia.png" alt="" width="15" height="15" style="width:15px;">
