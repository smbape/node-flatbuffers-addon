/* eslint-env node, mocha */

const { expect } = require("chai");
const native_addon = require("../");
const flatbuffers_addon = require("../lib/flatbuffers_addon");

const {hasOwnProperty: hasProp} = Object.prototype;

const c_str = str => {
    const len = Buffer.byteLength(str, "utf8");
    const buffer = Buffer.allocUnsafe(len + 1);
    buffer.write(str, "utf8");
    buffer[len] = 0;
    return new Uint8Array(buffer);
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#Syntax
var isTypedArray = typeof BigInt64Array === "function" ? obj => {
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

describe("switch-to-embind", () => {
    let initialized = false;

    before(done => {
        flatbuffers_addon.init({
            // wasmBinaryFile: null,
            onRuntimeInitialized: () => {
                initialized = true;
            }
        }, (err, Module) => {
            native_addon.js = options => {
                options = schemaOptions(Object.assign({}, options));

                return Module.GenerateJSTSCode(
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
            };

            native_addon.binary = options => {
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
            };

            done();
        });
    });

    it("should onRuntimeInitialized", () => {
        expect(initialized).to.equal(true);
    });

});
