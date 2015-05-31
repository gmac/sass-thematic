# sass-ast

[pre-release]

Reconstitute an entire Sass filebase into an Abstract Syntax Tree (AST) of lexically-parsed grammar. This is useful for performing validations and/or extracting portions of your Sass styleset for specific purposes.

## How it works

This is an extremely lightweight library that combines [file-importer](https://github.com/gmac/file-importer) with the fabulous [gonzales-pe](https://github.com/tonyganch/gonzales-pe) CSS lexer:

 * `file-importer` is used to reconstitute the file tree of a Sass codebase, combining files referenced via `@import` statements.

 * As files are imported, each file is parsed into an AST by `gonzales`, and then merged into its parent AST in place of the original `@import` rule.

The net result is a complete `gonzales` AST object, composed of deeply-nested source trees. Each imported stylesheet retains its own `stylesheet` node and line numbers. Also, `sass-ast` adds `import` and `file` properties to each `stylsheet` node in the tree, denoting where each stylesheet came from.

### Example:

In `index.scss`:

```
@import 'sibling';
.index {}
```

In `sibling.scss`:

```
.sibling {}
```

Run parser:

```
var sassAST = require('sass-ast');

sassAST.parse({file: 'test/index'}, function(err, ast) {
  if (err) throw err;
  console.log(JSON.stringify(ast));
});
```

Resulting (abbreviated) [Gonzales](https://github.com/tonyganch/gonzales-pe) tree:

```json
{
  "type": "stylesheet",
  "content": [
    {
      "type": "stylesheet",
      "content": [
        {
          "type": "ruleset",
          "content": [
            "... .sibling {} ..."
          ],
          "start": { },
          "end": { }
        }
      ],
      "start": { },
      "end": { },
      "import": "sibling",
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
      "content": [
        "... .index {} ..."
      ],
      "start": { },
      "end": { }
    }
  ],
  "start": { },
  "end": { },
  "import": "test/index",
  "file": "/path/to/test/index.scss"
}
```



## Install

To install in your NPM package:

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

## Issues

This library is a tiny bridge between two primary tools that do the heavy lifting. Most issues should probably be reported directly to their specific project:

 * Report issues with `@import` resolutions to [file-importer](https://github.com/gmac/file-importer).
 * Report issues with Sass lexical parsing to [gonzales-pe](https://github.com/tonyganch/gonzales-pe).

Thanks! Reporting directly to the appropriate project will make sure your report is reviewed.