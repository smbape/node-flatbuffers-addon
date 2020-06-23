const {hasOwnProperty: hasProp} = Object.prototype;

const c_str = str => {
    const len = Buffer.byteLength(str, "utf8");
    const buffer = Buffer.allocUnsafe(len + 1);
    buffer.write(str, "utf8");
    buffer[len] = 0;
    return new Uint8Array(buffer);
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#Syntax
const isTypedArray = typeof BigInt64Array === "function" ? obj => {
    return (obj instanceof Int8Array) ||
        (obj instanceof Uint8Array) ||
        (obj instanceof Uint8ClampedArray) ||
        (obj instanceof Int16Array) ||
        (obj instanceof Uint16Array) ||
        (obj instanceof Int32Array) ||
        (obj instanceof Uint32Array) ||
        (obj instanceof Float32Array) ||
        (obj instanceof Float64Array) ||
        (obj instanceof BigInt64Array) ||
        (obj instanceof BigUint64Array);
} : obj => {
    return (obj instanceof Int8Array) ||
        (obj instanceof Uint8Array) ||
        (obj instanceof Uint8ClampedArray) ||
        (obj instanceof Int16Array) ||
        (obj instanceof Uint16Array) ||
        (obj instanceof Int32Array) ||
        (obj instanceof Uint32Array) ||
        (obj instanceof Float32Array) ||
        (obj instanceof Float64Array);
};

const setOption = (options, prop, basename, ext, stringify) => {
    const prop_contents = `${ prop }_contents`;
    const prop_length = `${ prop }_length`;
    let contents = hasProp.call(options, prop_contents) ? options[prop_contents] : null;
    let value = hasProp.call(options, prop) ? options[prop] : null;

    if (contents == null && value != null) {
        contents = value;
        value = null;
    }

    if (value == null && contents != null) {
        value = `${ basename || prop }.${ ext }`;
    }

    if (stringify && contents !== null && typeof contents === "object" && !isTypedArray(contents)) {
        contents = JSON.stringify(contents);
    }

    if (typeof contents === "string") {
        contents = c_str(contents);
    }

    if (contents && !isTypedArray(contents)) {
        throw new TypeError(`${ prop }_contents must be a string or a TypedArray`);
    }

    if (options[prop_length] == null && contents) {
        options[prop_length] = contents.length;
    }

    if (contents && isTypedArray(value)) {
        throw new TypeError(`if ${ prop } is a TypedArray, ${ prop }_contents must be null or undefined`);
    }

    if (value && typeof value !== "string") {
        throw new TypeError(`${ prop } must be a string`);
    }

    options[prop_contents] = contents;
    options[prop] = value;
};

const schemaOptions = options => {
    [ "schema", "conform" ].forEach(prop => {
        setOption(options, prop, prop, "fbs");
    });

    if (!isTypedArray(options.schema_contents)) {
        throw new TypeError("schema_contents must be a string or a TypedArray");
    }

    [ "include_directories", "conform_include_directories" ].forEach(prop => {
        if (options[prop] == null) {
            options[prop] = [];
        }

        if (Array.isArray(options[prop])) {
            options[prop].forEach((item, i, arr) => {
                if (typeof item === "string") {
                    arr[i] = c_str(item);
                } else if (!isTypedArray(item)) {
                    throw new TypeError(`element ${ i } of ${ prop } must be a string or a TypedArray`);
                }
            });
        }
    });

    return options;
};

const DEFAULT_SCHEMA = `
    namespace some.nested.namespace;

    file_extension "dat";

    table Book {
        id:     string (id: 0);
        title:  string (id: 1);
        authors:[string] (id: 2);
        release:ulong (id: 3);
        genres: [ulong] (id: 4);
    }

    table Library {
        name:  string (id: 0);
        books: [Book] (id: 1);
        cdate: ulong = 1 (id: 2);
    }

    root_type Library;
`;

const DEFAULT_SCHEMA_BUFFER = Buffer.from(DEFAULT_SCHEMA);

const DEFAULT_LIBRARY = {
    name: "BookShop 0",
    books: [],
    cdate: 1
};

for (let i = 0; i < 4; i++) {
    DEFAULT_LIBRARY.books[i] = {
        id: `book-${ i }`,
        title: `Book ${ i }`,
        authors: [`Author ${ i }`],
        release: Math.floor(Date.now() / 1000),
        genres: [ Math.floor(Math.random() * 1000) ]
    };
}

const DEFAULT_LIBRARY_JSON = JSON.stringify(DEFAULT_LIBRARY);
const DEFAULT_LIBRARY_JSON_BUFFER = Buffer.from(DEFAULT_LIBRARY_JSON);

const testBinary = addon => {
    addon.binary({
        schema: "Library.fbs",
        schema_contents: DEFAULT_SCHEMA_BUFFER,
        json: "books.json",
        json_contents: DEFAULT_LIBRARY_JSON_BUFFER
    });
};

const testJs = addon => {
    addon.js({
        schema: "Library.fbs",
        schema_contents: DEFAULT_SCHEMA_BUFFER
    });
};

require("../lib/flatbuffers_addon").init({
    // wasmBinaryFile: null,
    onRuntimeInitialized: () => {
        initialized = true;
    }
}, (err, Module) => {
    const emscripten_addon_internal = {
        js: options => {
            options = schemaOptions(Object.assign({}, options));

            return Module.GenerateJSTSCode_Internal(
                options.schema,
                options.schema_contents,
                options.schema_length,
                options.include_directories,
                options.conform,
                options.conform_contents,
                options.conform_length,
                options.conform_include_directories,
                options
            );
        },

        binary: options => {
            options = schemaOptions(Object.assign({}, options));

            setOption(options, "json", "data", "json", true);

            if (options.schema_binary && options.json_contents != null) {
                throw new TypeError("if schema_binary option is true, json_contents must be null or undefined");
            }

            return Module.GenerateBinary(
                options.schema,
                options.schema_contents,
                options.schema_length,
                options.include_directories,
                options.conform,
                options.conform_contents,
                options.conform_length,
                options.conform_include_directories,
                options.json,
                options.json_contents,
                options.json_length,
                options
            );
        }
    };

    const emscripten_addon_external = Object.assign({}, emscripten_addon_internal, {
        js: options => {
            options = schemaOptions(Object.assign({}, options));

            return Module.GenerateJSTSCode_External(
                options.schema,
                options.schema_contents,
                options.schema_length,
                options.include_directories,
                options.conform,
                options.conform_contents,
                options.conform_length,
                options.conform_include_directories,
                options
            );
        }
    });

    const native_addon = require("../");

    for (let i = 0; i < 10; i++) {
        testBinary(emscripten_addon_internal);
    }

    for (let i = 0; i < 10; i++) {
        testBinary(emscripten_addon_external);
    }

    for (let i = 0; i < 10; i++) {
        testBinary(native_addon);
    }

    const {Benchmark, Suite} = require("benchmark");
    const suite = new Suite();
    Benchmark.options.maxTime = process.env.MAX_TIME && /^\d+$/.test(process.env.MAX_TIME) ? parseInt(process.env.MAX_TIME, 10) : 5;

    suite
        .add("emscripten_addon_internal testBinary", () => {
            testBinary(emscripten_addon_internal);
        })
        .add("emscripten_addon_external testBinary", () => {
            testBinary(emscripten_addon_external);
        })
        .add("native_addon              testBinary", () => {
            testBinary(native_addon);
        })
        .add("emscripten_addon_internal testJs", () => {
            testJs(emscripten_addon_internal);
        })
        .add("emscripten_addon_external testJs", () => {
            testJs(emscripten_addon_external);
        })
        .add("native_addon              testJs", () => {
            testJs(native_addon);
        })
        .on("cycle", event => {
            console.log(String(event.target));
        })
        .on("complete", function() {
            // eslint-disable-next-line no-invalid-this
            console.log(`Fastest is ${ this.filter("fastest").map("name").toString().trim() }`);
        })
        .run({
            async: true,
        });
});
