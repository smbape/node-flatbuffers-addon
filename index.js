const addon = require("bindings")("addon.node");

const StringBuffer = str => {
    const len = Buffer.byteLength(str, "utf8");
    const buffer = Buffer.allocUnsafe(len + 1);
    buffer.write(str, "utf8");
    buffer[len] = 0;
    return buffer;
};

const setOption = (options, prop, basename, ext, stringify) => {
    if (options[prop] != null && options[`${ prop }_contents`] == null) {
        options[`${ prop }_contents`] = options[prop];
        options[prop] = null;
    }

    if (options[prop] == null && options[`${ prop }_contents`] != null) {
        options[prop] = `${ basename || prop }.${ ext }`;
    }

    if (stringify && options[`${ prop }_contents`] !== null && typeof options[`${ prop }_contents`] === "object" && !Buffer.isBuffer(options[`${ prop }_contents`])) {
        options[`${ prop }_contents`] = JSON.stringify(options[`${ prop }_contents`]);
    }

    if (typeof options[`${ prop }_contents`] === "string") {
        options[`${ prop }_contents`] = StringBuffer(options[`${ prop }_contents`]);
    }

    if (options[`${ prop }_contents`] != null && !Buffer.isBuffer(options[`${ prop }_contents`])) {
        throw new TypeError(`${ prop }_contents must be a string or a Buffer`);
    }

    if (options[`${ prop }_length`] == null && options[`${ prop }_contents`]) {
        options[`${ prop }_length`] = options[`${ prop }_contents`].length;
    }

    if (options[`${ prop }_contents`] != null && Buffer.isBuffer(options[prop])) {
        throw new TypeError(`if ${ prop } is a Buffer, ${ prop }_contents must be null or undefined`);
    }

    if (options[prop] != null && typeof options[prop] !== "string") {
        throw new TypeError(`${ prop } must be a string`);
    }
};

const schemaOptions = options => {
    [ "schema", "conform" ].forEach(prop => {
        setOption(options, prop, prop, "fbs");
    });

    if (!options.schema_contents) {
        throw new TypeError("schema_contents must be a string or a Buffer");
    }

    [ "include_directories", "conform_include_directories" ].forEach(prop => {
        if (options[prop] == null) {
            options[prop] = [];
        }

        if (Array.isArray(options[prop])) {
            options[prop].forEach((item, i, arr) => {
                if (typeof item === "string") {
                    arr[i] = StringBuffer(item);
                } else if (!Buffer.isBuffer(item)) {
                    throw new TypeError(`element ${ i } of ${ prop } must be a string or a Buffer`);
                }
            });
        }
    });

    if (typeof options.include_prefix === "string") {
        options.include_prefix = StringBuffer(options.include_prefix);
    }

    return options;
};

Object.assign(exports, {
    binary: options => {
        options = schemaOptions(Object.assign({}, options));

        setOption(options, "json", "data", "json", true);

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
