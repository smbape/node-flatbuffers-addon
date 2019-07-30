# flatbuffers-addon

Generate flatbuffers directly from node.

## Generate binary

```js
const flatc = require("flatbuffers-addon");
const buffer = flatc.binary(options);
```

### options.schema

`type: String|Buffer`

Schema path.

if `schema` is a String and `schema_contents` is `null` or `undefined`, `schema` will be treated as `schema_contents`.

### options.schema_contents

`type: String|Buffer`

Schema contents.

### options.schema_length

`type: int`

schema contents length to parse.

### options.schema_binary

**NOT TESTED**

`type: bool`
`default: false`

Serialize schemas instead of JSON

### options.include_directories

`type: [String]`

Include directories for schemas

### options.conform

**NOT TESTED**

`type: String|Buffer`

Specify a schema the following `schema` should be an evolution of.

if `conform` is a String and `conform_contents` is `null` or `undefined`, `conform` will be treated as `conform_contents`.

### options.conform_contents

**NOT TESTED**

`type: String|Buffer`

Conform schema contents.

### options.conform\_include_directories

**NOT TESTED**

`type: [String]`

Include directories for conform schemas

### options.strict_json

**NOT TESTED**

`type: bool`
`default: false`

field names must be / will be quoted, no trailing commas in tables/vectors.

### options.ignore\_null_scalar

`type: bool`
`default: false`

Allow scalar fields to be null

### options.allow\_non_utf8

**NOT TESTED**

`type: bool`
`default: false`

Pass non-UTF-8 input through parser

### options.skip\_unexpected\_fields\_in_json

**NOT TESTED**

`type: bool`
`default: false`

Allow fields in JSON that are not defined in the schema.
These fields will be discared when generating binaries.

### options.size_prefixed

**NOT TESTED**

`type: bool`
`default: false`

Input binaries are size prefixed buffers.

### options.proto_mode

**NOT TESTED**

`type: bool`
`default: false`

Input is a .proto, translate to .fbs.

### options.proto_oneof\_union

**NOT TESTED**

`type: bool`
`default: false`

Translate .proto oneofs to flatbuffer unions.

### options.binary\_schema_comments

**NOT TESTED**

`type: bool`
`default: false`

Add doc comments to the binary schema files.

### options.binary\_schema_builtins

**NOT TESTED**

`type: bool`
`default: false`

Add builtin attributes to the binary schema files.

### options.force_defaults

**NOT TESTED**

`type: bool`
`default: false`

Emit default values in binary output from JSON.

## Generate js

```js
const flatc = require("flatbuffers-addon");
const code = flatc.js(options);
```

### options.schema

`type: String|Buffer`

Schema path.

if `schema` is a String and `schema_contents` is `null` or `undefined`, `schema` will be treated as `schema_contents`.

### options.schema_contents

`type: String|Buffer`

Schema contents.

### options.schema_length

`type: int`

schema contents length to parse.

### options.include_directories

`type: [String]`

Include directories for schemas

### options.conform

**NOT TESTED**

`type: String|Buffer`

Specify a schema the following `schema` should be an evolution of.

if `conform` is a String and `conform_contents` is `null` or `undefined`, `conform` will be treated as `conform_contents`.

### options.conform_contents

**NOT TESTED**

`type: String|Buffer`

Conform schema contents.

### options.conform\_include_directories

**NOT TESTED**

`type: [String]`

Include directories for conform schemas

### options.type

**NOT TESTED**

`type: String`

`ts` to generate TypeScript code.

### options.allow\_non_utf8

**NOT TESTED**

`type: bool`
`default: false`

Pass non-UTF-8 input through parser

### options.mutable_buffer

`type: bool`
`default: false`

Generate accessors that can mutate buffers in-place.

### options.generate_all

**NOT TESTED**

`type: bool`
`default: false`

Generate not just code for the current schema files, but for all files it includes as well.
If the language uses a single file for output (by default the case for C++ and JS), all code will end up in this one file.

### options.skip\_js_exports

**NOT TESTED**

`type: bool`
`default: false`

Removes Node.js style export lines in JS.

### options.use\_goog\_js\_export_format

**NOT TESTED**

`type: bool`
`default: false`

Uses goog.exports* for closure compiler exporting in JS.

### options.use\_ES6\_js\_export_format

**NOT TESTED**

`type: bool`
`default: false`

Uses ECMAScript 6 export style lines in JS.

### options.keep\_include_path

**NOT TESTED**

`type: bool`
`default: false`

Keep original prefix of schema include statement.

### options.skip\_flatbuffers_import

**NOT TESTED**

`type: bool`
`default: false`

Don't include flatbuffers import statement for TypeScript.

### options.reexport\_ts_modules

**NOT TESTED**

`type: bool`
`default: true`

re-export imported dependencies for TypeScript

### options.js\_ts\_short_names

**NOT TESTED**

`type: bool`
`default: true`

Use short function names for JS and TypeScript.

## Examples

```js
const { flatbuffers } = require("flatbuffers");
const flatc = require("flatbuffers-addon");

const schema = `
    namespace some.nested.namespace;

    file_extension "dat";

    table Book {
        id:string (id: 0);
        title:string (id: 1);
        authors:[string] (id: 2);
        release:ulong (id: 3);
        genres: [ulong] (id: 4);
    }

    table Library {
        name:string (id: 0);
        books: [Book] (id: 1);
    }

    root_type Library;
`;

const js = flatc.js({
    schema
});

const library = {
    name: "BookShop 0",
    books: [{
        id: "book-0",
        title: "Book 0",
        authors: ["Author 0"]
    }]
};


const buffer = flatc.binary({
    schema,
    json: library
});

const deserialized = ((code, binary) => {
    // Evalute generated js code
    const sandbox = {};
    (new Function(code)).call(sandbox);

    // @see https://google.github.io/flatbuffers/flatbuffers_guide_use_javascript.html
    const bytes = new Uint8Array(binary);
    const buf = new flatbuffers.ByteBuffer(bytes);

    // Deserialized flatbuffers binary data
    const Library = sandbox.some.nested.namespace.Library;
    return Library.getRootAsLibrary(buf);

})(js, buffer);

console.log(deserialized.name() === "BookShop 0");
console.log(deserialized.books(0).title() === "Book 0");

```
