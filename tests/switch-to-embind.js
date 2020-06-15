/* eslint-env node, mocha */

const { expect } = require("chai");
const native_addon = require("../");
const flatbuffers_addon = require("../lib/flatbuffers_addon");

const {toString} = Object.prototype;

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
    if (options[prop] != null && options[`${ prop }_contents`] == null) {
        options[`${ prop }_contents`] = options[prop];
        options[prop] = null;
    }

    if (options[prop] == null && options[`${ prop }_contents`] != null) {
        options[prop] = `${ basename || prop }.${ ext }`;
    }

    if (stringify && options[`${ prop }_contents`] !== null && typeof options[`${ prop }_contents`] === "object" && !isTypedArray(options[`${ prop }_contents`])) {
        options[`${ prop }_contents`] = JSON.stringify(options[`${ prop }_contents`]);
    }

    if (typeof options[`${ prop }_contents`] === "string") {
        options[`${ prop }_contents`] = c_str(options[`${ prop }_contents`]);
    }

    if (options[`${ prop }_contents`] && !isTypedArray(options[`${ prop }_contents`])) {
        throw new TypeError(`${ prop }_contents must be a string or a TypedArray`);
    }

    if (options[`${ prop }_length`] == null && options[`${ prop }_contents`]) {
        options[`${ prop }_length`] = options[`${ prop }_contents`].length;
    }

    if (options[`${ prop }_contents`] && isTypedArray(options[prop])) {
        throw new TypeError(`if ${ prop } is a TypedArray, ${ prop }_contents must be null or undefined`);
    }

    if (options[prop] && typeof options[prop] !== "string") {
        throw new TypeError(`${ prop } must be a string`);
    }
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
