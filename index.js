const addon = require("node-gyp-build")(__dirname);

const hasProp = Object.prototype.hasOwnProperty;

const c_str = (str, null_terminated) => {
    if (typeof str === "string") {
        const byteLength = Buffer.byteLength(str, "utf8");
        const buf = Buffer.allocUnsafe(null_terminated ? byteLength + 1 : byteLength);
        buf.write(str, "utf8");
        if (null_terminated) {
            buf[byteLength] = 0;
        }
        return buf;
    }

    if (null_terminated && Buffer.isBuffer(str) && str[str.length - 1] !== 0) {
        const byteLength = str.length;
        const buf = Buffer.allocUnsafe(byteLength + 1);
        str.copy(buf, 0, 0, byteLength);
        buf[byteLength] = 0;
        return buf;
    }

    return str;
};

const setOption = (options, prop, basename, ext, stringify) => {
    const prop_contents = `${ prop }_contents`;

    if (options[prop] != null && options[prop_contents] == null) {
        options[prop_contents] = options[prop];
        options[prop] = null;
    }

    if (options[prop] == null && options[prop_contents] != null) {
        options[prop] = `${ basename || prop }.${ ext }`;
    }

    if (stringify && options[prop_contents] !== null && typeof options[prop_contents] === "object" && !Buffer.isBuffer(options[prop_contents])) {
        options[prop_contents] = JSON.stringify(options[prop_contents]);
    }

    if (typeof options[prop_contents] === "string") {
        options[prop_contents] = c_str(options[prop_contents]);
    }

    if (options[prop_contents] != null) {
        if (!Buffer.isBuffer(options[prop_contents])) {
            throw new TypeError(`${ prop }_contents must be a string or a Buffer`);
        }

        if (Buffer.isBuffer(options[prop])) {
            throw new TypeError(`if ${ prop } is a Buffer, ${ prop }_contents must be null or undefined`);
        }
    }

    if (options[prop] != null && typeof options[prop] !== "string") {
        throw new TypeError(`${ prop } must be a string`);
    }

    if (options[prop] != null) {
        options[prop] = c_str(options[prop], true);
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
                arr[i] = c_str(item, true);
                if (!Buffer.isBuffer(arr[i])) {
                    throw new TypeError(`element ${ i } of ${ prop } must be a string or a Buffer`);
                }
            });
        }
    });

    [ "include_prefix", "js_ts_global_prefix" ].forEach(prop => {
        if (options[prop] != null) {
            options[prop] = c_str(options[prop], true);
        }
    });

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
