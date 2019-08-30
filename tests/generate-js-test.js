/* eslint-env node, mocha */

const { expect } = require("chai");
const { flatbuffers } = require("flatbuffers");
const addon = require("../");

const parseLong = value => {
    if (value instanceof flatbuffers.Long) {
        value = parseInt(value.high.toString(16) + value.low.toString(16), 16);
    }

    return value;
};

const doPlainAccessor = (proto, property) => {
    const method = proto[property];

    // methods starting with _ are supposed to be private
    // methods starting with get are supposed to be getters
    // methods ending with Length are supposed to be arrays method
    if ("function" !== typeof method || /(?:^(?:_|get[A-Z])|Length$)/.test(property)) {
        return;
    }

    const getter = `get${ property[0].toUpperCase() }${ property.slice(1) }`;
    proto[getter] = method;

    const methodLength = `${ property }Length`;
    const isArray = methodLength in proto;

    Object.defineProperty(proto, property, {
        configurable: true, // descriptor can be changed or deleted
        enumerable: true, // property shows up during enumeration of the properties on the corresponding object
        get: isArray ? function get() {
            const len = this[methodLength]();
            const ret = new Array(len);

            for (let i = 0; i < len; i++) {
                ret[i] = parseLong(this[getter](i));
            }

            this[property] = ret;
            return ret;
        } : function get() {
            const ret = parseLong(this[getter]());
            this[property] = ret;
            return ret;
        },

        set(value) {
            Object.defineProperty(this, property, {
                configurable: true, // descriptor can be changed or deleted
                enumerable: true, // property shows up during enumeration of the properties on the corresponding object
                writable: true, // the value associated with the property may be changed with an assignment
                value
            });

            return value;
        }
    });
};

const plainAccessor = nsp => {
    let Ctor, proto, property;

    // eslint-disable-next-line guard-for-in
    for (const name in nsp) {
        Ctor = nsp[name];
        if ("function" !== typeof Ctor) {
            continue;
        }

        proto = Ctor.prototype;

        // Inherited properties are purposely enumerated
        // eslint-disable-next-line guard-for-in
        for (property in proto) {
            doPlainAccessor(proto, property);
        }
    }
};

const pick = (obj, props) => {
    const ret = {};

    props.forEach(prop => {
        if (prop in obj) {
            ret[prop] = obj[prop];
        }
    });

    return ret;
};

const testLibrary = (Library, bytes, expected, test) => {
    const buf = new flatbuffers.ByteBuffer(bytes);
    const actual = pick(Library.getRootAsLibrary(buf), ["name", "books", "cdate"]);

    for (let i = 0, len = actual.books.length; i < len; i++) {
        actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres", "rank"]);
    }

    if (typeof test === "function") {
        test(actual, expected);
    }

    expect(actual.name).to.equal(expected.name);
    expect(actual.books).to.deep.equal(expected.books);
};

const testFlatbuffers = (js, bytes, expected, test) => {
    const sandbox = {};
    (new Function(js)).call(sandbox); // eslint-disable-line no-new-func
    const nsp = sandbox.some.nested.namespace;
    plainAccessor(nsp);
    testLibrary(nsp.Library, bytes, expected, test);
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

const DEFAULT_RANKED_SCHEMA = `
    namespace some.nested.namespace;

    file_extension "dat";

    table Book {
        id:     string (id: 0);
        title:  string (id: 1);
        authors:[string] (id: 2);
        release:ulong (id: 3);
        genres: [ulong] (id: 4);
        rank:   uint (id: 5);
    }

    table Library {
        name:string (id: 0);
        books: [Book] (id: 1);
        cdate: ulong = 1 (id: 2);
    }

    root_type Library;
`;

const DEFAULT_RANKED_SCHEMA_BUFFER = Buffer.from(DEFAULT_RANKED_SCHEMA);

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

describe("generate-js", () => {
    it("should generate with {schema, json}", () => {
        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: DEFAULT_SCHEMA_BUFFER,
            json: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema_contents, json}", () => {
        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema, schema_contents, json}", () => {
        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: DEFAULT_SCHEMA_BUFFER,
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema_contents, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema, schema_contents, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema, json, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: DEFAULT_SCHEMA_BUFFER,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema_contents, json, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema_contents: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should generate with {schema, schema_contents, json, json_contents}", () => {
        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY_JSON
        }), DEFAULT_LIBRARY);

        testFlatbuffers(addon.js({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA
        }), addon.binary({
            schema: "Library.fbs",
            schema_contents: DEFAULT_SCHEMA,
            json: "books.json",
            json_contents: DEFAULT_LIBRARY
        }), DEFAULT_LIBRARY);
    });

    it("should schema_binary", () => {
        const schema = "Library.bfbs";

        const schema_contents = addon.binary({
            schema: schema.replace(".bfbs", ".fbs"),
            schema_contents: DEFAULT_SCHEMA_BUFFER,
            schema_binary: true
        });

        testFlatbuffers(addon.js({
            schema,
            schema_contents
        }), addon.binary({
            schema,
            schema_contents,
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        }), DEFAULT_LIBRARY);
    });

    it("should force_defaults", () => {
        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA.replace("ulong = 1", "ulong = 2")
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY,
            force_defaults: false
        }), DEFAULT_LIBRARY, (actual, expected) => {
            expect(actual.cdate).to.equal(2);
        });

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA.replace("ulong = 1", "ulong = 2")
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY,
            force_defaults: true
        }), DEFAULT_LIBRARY, (actual, expected) => {
            expect(actual.cdate).to.equal(1);
        });
    });

    it("should conform", () => {
        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 4; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ],
                rank: i + 1
            };
        }

        expect(() => {
            addon.js({
                schema: DEFAULT_RANKED_SCHEMA,
                conform: DEFAULT_SCHEMA.replace("release:ulong", "release:uint")
            });
        }).to.throw(TypeError);

        expect(() => {
            addon.binary({
                schema: DEFAULT_RANKED_SCHEMA,
                conform: DEFAULT_SCHEMA.replace("release:ulong", "release:uint"),
                json: library
            });
        }).to.throw(TypeError);

        testFlatbuffers(addon.js({
            schema: DEFAULT_RANKED_SCHEMA,
            conform: DEFAULT_SCHEMA
        }), addon.binary({
            schema: DEFAULT_RANKED_SCHEMA,
            conform: DEFAULT_SCHEMA,
            json: library
        }), library);
    });

    it("should ignore_null_scalar", () => {
        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 4; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ],
                rank: null
            };
        }

        const json_contents = Buffer.from(JSON.stringify(library));

        // Ignore null scalar
        for (let i = 0; i < 4; i++) {
            library.books[i].rank = 0;
        }

        testFlatbuffers(addon.js({
            schema: DEFAULT_RANKED_SCHEMA
        }), addon.binary({
            schema: DEFAULT_RANKED_SCHEMA,
            json: json_contents,
            ignore_null_scalar: true
        }), library);
    });

    it("should skip_unexpected_fields_in_json", () => {
        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 4; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ],
                rank: i + 1
            };
        }

        const json = "library.json";
        const json_contents = Buffer.from(JSON.stringify(library));

        // Skip unexpected fields in json
        for (let i = 0; i < 4; i++) {
            delete library.books[i].rank;
        }

        expect(() => {
            addon.binary({
                schema_contents: DEFAULT_SCHEMA_BUFFER,
                json,
                json_contents
            });
        }).to.throw(TypeError);

        testFlatbuffers(addon.js({
            schema: DEFAULT_SCHEMA,
        }), addon.binary({
            schema: DEFAULT_SCHEMA,
            json,
            json_contents,
            skip_unexpected_fields_in_json: true
        }), library);
    });

    it("should skip_js_exports", () => {
        const sandbox = {};

         // eslint-disable-next-line no-new-func
        const nsp = (new Function(addon.js({
            schema: DEFAULT_SCHEMA_BUFFER,
            skip_js_exports: true
        }) + "; return some;")).call(sandbox).nested.namespace;
        plainAccessor(nsp);

        expect(sandbox.some).to.equal(undefined);

        const binary = addon.binary({
            schema: DEFAULT_SCHEMA,
            json: DEFAULT_LIBRARY
        });

        testLibrary(nsp.Library, binary, DEFAULT_LIBRARY);
    });

    it("should js_ts_global_prefix", () => {
        const js = addon.js({
            schema: DEFAULT_SCHEMA_BUFFER,
            js_ts_global_prefix: "this."
        });

        const binary = addon.binary({
            schema: DEFAULT_SCHEMA_BUFFER,
            json_contents: DEFAULT_LIBRARY_JSON_BUFFER
        });

        const some = {};

         // eslint-disable-next-line no-new-func
        (new Function(js)).call({
            some
        });

        const nsp = some.nested.namespace;
        plainAccessor(nsp);

        testLibrary(nsp.Library, binary, DEFAULT_LIBRARY);
    });
});
