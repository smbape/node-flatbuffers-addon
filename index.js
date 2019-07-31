const addon = require('bindings')('addon.node');
const fs = require("fs");

const StringBuffer = str => {
    const buffer = Buffer.from(str);
    const len = buffer.length;
    const target = Buffer.allocUnsafe(len + 1);
    buffer.copy(target);
    target[len] = 0;
    return target;
}

const schemaOptions = options => {
    if (Buffer.isBuffer(options.schema) && options.schema_contents != null) {
        throw new TypeError("if schema option is a Buffer, schema_contents must be null or undefined");
    }

    if (options.schema != null && options.schema_contents == null) {
        options.schema_contents = options.schema;
        options.schema = null;
    }

    if (options.schema == null && options.schema_contents != null) {
        options.schema = "schema.fbs";
    }

    if (typeof options.schema_contents === "string") {
        options.schema_contents = StringBuffer(options.schema_contents);
    }

    if (!Buffer.isBuffer(options.schema_contents)) {
        throw new TypeError("schema_contents must either be a string or a Buffer");
    }

    if (options.schema_length == null) {
        options.schema_length = options.schema_contents.length;
    }

    if (Buffer.isBuffer(options.conform) && options.conform_contents != null) {
        throw new TypeError("if conform option is a Buffer, conform_contents must be null or undefined");
    }

    if (options.conform != null && options.conform_contents == null) {
        options.conform_contents = options.conform;
        options.conform = null;
    }

    if (options.conform == null && options.conform_contents != null) {
        options.conform = "conform.fbs";
    }

    if (typeof options.conform_contents === "string") {
        options.conform_contents = StringBuffer(options.conform_contents);
    }

    if (options.conform_contents != null && !Buffer.isBuffer(options.conform_contents)) {
        throw new TypeError("conform_contents must either be a string or a Buffer");
    }

    if (options.conform_contents != null && options.conform_length == null) {
        options.conform_length = options.conform_contents.length;
    }

    [ "include_directories", "conform_include_directories" ].forEach(prop => {
        if (options[prop] == null) {
            options[prop] = [];
        }

        if (Array.isArray(options[prop])) {
            options[prop].forEach((str, i, arr) => {
                if (typeof str === "string") {
                    arr[i] = StringBuffer(str);
                }
            });
        }
    });

    return options;
}

Object.assign(exports, {
    binary: options => {
        options = schemaOptions(Object.assign({}, options));

        if (Buffer.isBuffer(options.json) && options.json_contents != null) {
            throw new TypeError("if json option is a Buffer, json_contents must be null or undefined");
        }

        if (options.json != null && options.json_contents == null) {
            options.json_contents = options.json;
            options.json = null;
        }

        if (options.json == null && options.json_contents != null) {
            options.json = "data.json";
        }

        if (typeof options.json_contents === "string") {
            options.json_contents = StringBuffer(options.json_contents);
        } else if (options.json_contents != null && typeof options.json_contents === "object" && !Buffer.isBuffer(options.json_contents)) {
            options.json_contents = StringBuffer(JSON.stringify(options.json_contents));
        }

        if (options.json_contents != null && !Buffer.isBuffer(options.json_contents)) {
            throw new TypeError("json_contents must either be a string, a Buffer or an Object");
        }

        if (options.json_contents != null && options.json_length == null) {
            options.json_length = options.json_contents.length;
        }

        if (options.schema_binary && options.json_contents != null) {
            throw new TypeError("if schema_binary option is true, json_contents must be null or undefined");
        }

        return addon.binary(options);
    },
    js: options => {
        options = schemaOptions(Object.assign({}, options));

        return addon.js(options);
    },
});
