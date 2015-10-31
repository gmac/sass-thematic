![SassThematic](title.png)

**A framework for generating dynamic theme stylesheets from Sass.**

* [How it works](#how-it-works)
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

## Getting Started

SassThematic supports two unique strategies for generating themed CSS – each provides a different approach to the problem. A process overview for each strategy is available on the wiki:

1. [Theme Override Stylesheet](https://github.com/gmac/sass-thematic/wiki/Theme-Override-Stylesheet)
1. [Full-CSS Themed Template](https://github.com/gmac/sass-thematic/wiki/Theme-CSS-Template)

## Install

Install the NPM package:

```
npm install sass-thematic --save-dev
```

## Upgrading to v2.x

While the v2.x framework has mostly the same API as the v0.x series, internal operations of the tool have changed significantly, thus meriting the major version bump. Potentially breaking changes:

 - Webpack integration broken out. Webpack plugins shall independently wrap this module.
 - Upgrades to Gonzales-PE latest, and adjusts implementation to match new parsing operations.

## API

SassThematic provides the following API. All methods take roughly the same options, which are fully [outlined below](#full-api-options). As of v1.x, all methods have sync and async implementations.

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

### parseThemeAST
- **thematic.parseThemeAST( options, callback )**
- **thematic.parseThemeASTSync( options )**

Parses, prunes, and returns an abstract syntax tree of just your Sass that implements theme variables. A `varsFile` option is required to identify relevant theme variables. This variables file should include *nothing* but variable definitions. The returned object is a [gonzales-pe](https://github.com/tonyganch/gonzales-pe) node tree.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.parseThemeAST({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/']
}, function(err, ast) {
   console.log(ast);
});

// Sync
var ast = thematic.parseThemeASTSync({ ...options... });
```

### parseThemeSass
- **thematic.parseThemeSass( options, callback )**
- **thematic.parseThemeSassSync( options )**

Parses, prunes, and returns a rendered Sass string of rules that implement your theme variables. A `varsFile` option is required to identify relevant theme variables. The returned string is raw Sass with all theme variable imports removed. You may prepend new theme variable definitions onto this Sass string and run it through the Sass compiler.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.parseThemeSass({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/']
}, function(err, sassString) {
   console.log(sassString);
});

// Sync
var sassString = thematic.parseThemeSassSync({ ...options... });
```

### parseTemplateSass
- **thematic.parseTemplateSass( options, callback )**
- **thematic.parseTemplateSassSync( options )**

Parses and returns a rendered Sass string of your complete source tree with theme variables converted to template fields. Template fields are formatted as `____name____`, and may be sent through the Sass compiler as literals and then parsed into values or interpolation fields in the rendered CSS. This method is under development, and will be used to generate full-source CSS templates. A `varsFile` option is required to identify relevant theme variables.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.parseTemplateSass({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/']
}, function(err, sassString) {
   console.log(sassString);
});

// Sync
var sassString = thematic.parseTemplateSassSync({ ...options... });
```

### renderThemeCSS
- **thematic.renderThemeCSS( options, callback )**
- **thematic.renderThemeCSSSync( options )**

Parses, prunes, compiles, and returns a rendered CSS string of selectors that implement your theme variables. A `varsFile` option is required to identify relevant theme variables. A `themeFile` or `themeData` option is required to provide variables used to render the CSS.

```javascript
var thematic = require('sass-thematic');

// Async
thematic.renderThemeCSS({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  themeData: '$color1: red; $color2: green;',
  includePaths: ['./lib/']
}, function(err, cssString) {
   console.log(cssString);
});

// Sync
var cssString = thematic.renderThemeCSSSync({ ...options... });
```

### renderThemeTemplate
- **thematic.renderThemeTemplate( options, callback )**
- **thematic.renderThemeTemplateSync( options )**

Parses, prunes, compiles, and returns a rendered template string of flat CSS rules that implement your theme variables. A `varsFile` option is required to identify relevant theme variables. The returned string is flat CSS with interpolation fields (ie: `<%= var %>`) wrapping theme variables.

This method requires the `node-sass` library installed as a peer dependency. Also note, variable names must pass through the Sass compiler as literals, therefore theme variables may NOT be used as function arguments (ie: `tint($this-will-explode, 10)`) or in math expressions (ie: `$sad-trombone * 0.5`).

```javascript
var thematic = require('sass-thematic');

// Async
thematic.renderThemeTemplate({
  file: './styles/main.scss',
  varsFile: './styles/_theme.scss',
  includePaths: ['./lib/'],
  templateOpen: '<%=',
  templateClose: '%>'
}, function(err, templateString) {
   console.log(templateString);
});

// Sync
var templateString = thematic.renderThemeTemplateSync({ ...options... });
```

## Full API Options

#### Required for all methods, one or both:

* **`file`**: String path to the main Sass file to load and parse. This may be an absolute path, or else a relative path from `cwd`.

* **`data`**: A Sass string to parse. You may still provide a `file` option as filepath context for mapping imports.

#### Required for theme parsing methods:

* **`varsFile`**: String path to a file containing all theme variables. This may be an absolute path, or else a relative path from `cwd`. This file must contain all theme variable definitions, and nothing else.

#### Required for theme rendering methods, one of:

* **`themeFile`**: String path to a file containing all theme variables to render CSS with. This may be an absolute path, or else a relative path from `cwd`.

* **`themeData`**: String data containing Sass variable definitions for all theme variables to render CSS with. Should be formatted as `$color1: red; $color2: black;`.

#### Optional options:

* **`includePaths`**: Array of base paths to search while performing file lookups. These should be absolute directory paths, or else relative to `cwd`. This operates just like the `node-sass` option of the same name.

* **`cwd`**: Path of the directory to resolve `file`, `varsFile`, `themeFile`,  and `includePaths` references from. Uses `process.cwd()` by default.

* **`disableTreeRemoval`**: Disables the removal of tree nodes. Useful when compiling full-source templates.

* **`disableVarsRemoval`**: Disables the removal of theme variable stylesheet imports. Be sure to use the Sass `!default` flag when leaving theme variables in the source tree.

* **`templateOpen`**: The opening token for template interpolation fields. Uses ERB-style `<%=` by default.

* **`templateClose`**: The closing token for template interpolation fields. Uses ERB-style `%>` by default.

* **`templateSnakeCase`**: Boolean. Set as `true` to transform all template variable names to `snake_case` (lowercase with underscores).

* **`fieldOpen`**: The opening token wrapping field literals that get sent through the Sass compiler. Uses `____` by default.

* **`fieldClose`**: The closing token wrapping field literals that get sent through the Sass compiler. Uses `____` by default.

* **`outputStyle`**: For rendering methods, this option is passed through to the Sass compiler to define output format. See [node-sass](https://www.npmjs.com/package/node-sass) docs for possible values.

## Pruning

SassThematic currently supports the following basic implementations:

* Removing unthemed rulesets and declarations.
* Removing unthemed mixins and their `@include` implementation.
* Removing unthemed `@extend` implementations.
* Removing unthemed loops (`@for`, `@each`), with basic local variable inflection.

This tool is a self-acknowledged 90% system that attempts to provide good automation for conventional use cases. Sass is a complex and nuanced language, therefore all of these pruning implementations undoubtedly have holes. For best results, review the [tests specs](https://github.com/gmac/sass-thematic/tree/master/test/style/reduce) to see what capabilities exist, and moderate complexity while implementing theme variables.

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
