# Thematic Sass

_A toolkit for generating customizable theme stylesheets from Sass_

## The Problem...

You're building a site that gets themed with customizable colors, fonts, sizes, etc. So, you set up a base stylesheet for the site, and then maintain a separate theme stylesheet for custom style overrides.

Unfortunately, this makes updates a hasstle. Style changes in the base stylesheet must always be mirrored in the theme-specific override. Keeping these stylesheets in sync becomes laborious and frustrating. It would be really great if we could _automate_ the creation of these overrides from the base source.

Thematic Sass can help.

## Here's how it works:

**1. Configure.** Provide file paths to your main Sass file, and to a vars file with all theme variables defined. We'll extract the names of all theme variables from this vars file.

```javascript
ast.parse({
  varsFile: './styles/_vars.scss',
  file: './styles/main.scss',
  includePaths: ['./lib/']
}, function(err, source) {
  // do stuff...
});
```

**2. Parse.** We reconstitute the Sass file's deeply-nested source tree of `@import` statements using [file-importer](https://github.com/gmac/file-importer), and then parse that flattened source into a complete abstract syntax tree (AST) using the fabulous [gonzales-pe](https://github.com/tonyganch/gonzales-pe).

```css
// From `@import 'vars';`
$keep-color: red;

// From `@import 'junk';`
$junk-color: red;

// From `main.scss`

@mixin mixin-junk {
  color: $junk-color;
}

@mixin mixin-keep {
  color: $keep-color;
}

.junk {
  color: $junk-color;
  font-family: serif;
}

.keep {
  color: $keep-color;
  font-family: serif;
}

.include-junk {
  @include mixin-junk;
}

.include-keep {
  @include mixin-keep;
}
```

**3. Prune.** We traverse the parsed AST, dropping any rulesets and/or declarations that do not include a theme variable. With some dynamic programming, this pruning expands to `@include`, `@extend`, and other inflected rule dependencies. This process reduces the Sass down to a minimum set of rules which implement theme variables. This minimal Sass may be compiled with a custom set of theme variables.

```css
// From `@import 'vars';`
$keep-color: red;

// From `@import 'junk';`
$junk-color: red;

// From `main.scss`

// mixin

@mixin mixin-keep {
  color: $keep-color;
}

// ruleset

.keep {
  color: $keep-color;
  // declaration
}

// ruleset

.include-keep {
  @include mixin-keep;
}
```

**4. Template.** Parsing custom variables into a view template is generally simpler than compiling custom assets for each theme. Thus, we can choose to render our Sass theme file into flat CSS, passing through variable names as template fields formatted for our desired templating language.

```css
.keep { color: <%= keep-color %>; }
.include-keep { color: <%= keep-color %>; }
```

## Install

Install NPM package:

```
npm install sass-ast --save-dev
```

## Usage

```javascript
var sassAST = require('sass-ast');

sassAST.parse({
    file: 'lib/test',
    includePaths: ['./styles/']
  },
  function(err, ast) {
    if (err) throw err;
    console.log(ast);
  });
```

### sassAST.parse( options, callback )

SassAST is a wrapper around [file-importer](https://github.com/gmac/file-importer), which is designed to generally mirror the configuration of `node-sass`.

#### Required options, one or both:

* **`file`**: String path to the file to load and parse. This may be an absolute path, or else a relative path from `process.cwd()` (or the provided `cwd` option). Uses `./` by default.

* **`data`**: String data to parse. When provided, file read is skipped and the provided string is parsed as file contents. You may still provide a `file` option as path context for mapping imports.

#### Optional options:

* **`cwd`**: Path of the directory to resolve `file` reference and `includePaths` from. Uses `process.cwd()` by default.

* **`includePaths`**: Array of base paths to search while perform file lookups. These should be absolute directory paths, or else relative to `process.cwd()` (or the provided `cwd` option).

* **`extensions`**: Array of file extensions to search while performing lookups. Set as `['.scss']` by default (for standard Sass import behavior). You could set this to, say, `['.txt']` to import a tree of plain text files.

## How it works

 * `file-importer` is used to reconstitute the file tree of a Sass codebase, combining files referenced via `@import` statements.

 * As files are imported, each file is parsed into an AST by `gonzales`, and then merged into its parent AST in place of the original `@import` rule. Imported stylesheets are assigned `importer` and `file` properties to annotate where and how the source was loaded.

The net result is a complete `gonzales` AST object, composed of deeply-nested source trees. Each imported stylesheet retains its own `stylesheet` node and line numbers. To flatten a source tree and its line numbering, you may call `.toCSS('scss')` on the full tree, and then reparse it.

### Example:

**In `index.scss`:**

```
@import 'sibling';
.index {}
```

**In `sibling.scss`:**

```
.sibling {}
```

**Run `sassAST` parser:**

```javascript
var sassAST = require('sass-ast');

sassAST.parse({file: 'test/index'}, function(err, ast) {
  if (err) throw err;
  console.log(JSON.stringify(ast));
});
```

**Resulting (abbreviated) [Gonzales](https://github.com/tonyganch/gonzales-pe) tree:**

```json
{
  "type": "stylesheet",
  "content": [
    {
      "type": "stylesheet",
      "content": [
        {
          "type": "ruleset",
          "content": [ "~~ AST: .sibling {} ~~" ],
          "start": { },
          "end": { }
        }
      ],
      "start": { },
      "end": { },
      "importer": [ "~~ AST: @import 'sibling'; ~~" ],
      "file": "/path/to/test/sibling.scss"
    },
    {
      "type": "space",
      "content": "\n",
      "start": { },
      "end": { }
    },
    {
      "type": "ruleset",
      "content": [ "~~ AST: .index {} ~~" ],
      "start": { },
      "end": { }
    }
  ],
  "start": { },
  "end": { },
  "importer": [],
  "file": "/path/to/test/index.scss"
}
```

Calling the Gonzales `.toCSS('scss')` on this tree would yield:

```css
.sibling {}

.index {}
```

## Issues

This library is a tiny bridge between two primary tools that do the heavy lifting. Most issues should probably be reported directly to their specific project:

 * Report issues with `@import` resolutions to [file-importer](https://github.com/gmac/file-importer).
 * Report issues with Sass lexical parsing to [gonzales-pe](https://github.com/tonyganch/gonzales-pe).

Thanks! Reporting directly to the appropriate project will make sure your report is reviewed.
