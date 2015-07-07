# Thematic Sass

_A toolkit for generating customizable theme stylesheets from Sass_

## The Problem...

You're building a site that gets themed with customizable colors, fonts, sizes, etc. So, you set up a base stylesheet for the site, and then maintain a separate theme stylesheet for custom style overrides.

Unfortunately, this makes updates a hasstle. Style changes in the base stylesheet must always be mirrored in the theme-specific override. Keeping these stylesheets in sync becomes laborious and frustrating. It would be really great if we could _automate_ the creation of these overrides from the base source.

Thematic Sass can help.

## Here's How it Works

**1. Configure.** Provide file paths to a Sass file to parse, and a vars file with all theme variables defined. We'll extract the names of all theme variables from the vars file.

**2. Parse.** We reconstitute the Sass file's deeply-nested source tree of `@import` statements using [file-importer](https://github.com/gmac/file-importer), and then parse that flattened source into a complete abstract syntax tree (AST) using the fabulous [gonzales-pe](https://github.com/tonyganch/gonzales-pe).

**3. Prune.** We traverse the parsed AST, dropping any rulesets and/or declarations that do not include a theme variable. Using some dynamic programming, we can extend this to `@include` and `@extend` rules as well. We reduce the Sass source down to the minimum set of rules implementing or extending theme variables. This provides a minimal Sass file that can be compiled with the variables for each theme.

**4. Template.** Parsing Sass into custom assets for each theme is tedious. It's generally easier just to render the theme file into a view template. We can (optionally) choose to render our Sass theme file into flat CSS, passing through variable names as template fields, and then serve the theme CSS as a rendered view through our application.

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
