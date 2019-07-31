const { expect } = require("chai");
const { flatbuffers } = require("flatbuffers");
const addon = require("../");

const parseLong = (value) => {
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

const DEFAULT_SCHEMA = `
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

describe("generate-js", function () {
    it("should generate js", () => {
        const schema = "Library.fbs";
        const schema_contents = Buffer.from(`
            namespace some.nested.namespace;

            file_extension "dat";

            table Book {
                id:string (id: 0);
                title:string (id: 1);
                authors:[string] (id: 2);
                release:ulong (id: 3);
                genres: [ulong] (id: 4);
                rank:uint (id: 5);
            }

            table Library {
                name:string (id: 0);
                books: [Book] (id: 1);
            }

            root_type Library;
        `);

        const js = addon.js({
            schema,
            schema_contents,
            schema_length: schema_contents.length
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ]
            };
        }

        const json = "library.json";
        const json_contents = Buffer.from(JSON.stringify(library));

        const binary = addon.binary({
            schema,
            schema_contents,
            schema_length: schema_contents.length,
            json,
            json_contents,
            json_length: json_contents.length
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

    it("should generate js with only schema,json", () => {
        const schema_contents = Buffer.from(DEFAULT_SCHEMA);

        const js = addon.js({
            schema: schema_contents
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ]
            };
        }

        const json_contents = Buffer.from(JSON.stringify(library));

        const binary = addon.binary({
            schema: schema_contents,
            json: json_contents
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

    it("should generate js with string schema and object json", () => {
        const schema_contents = DEFAULT_SCHEMA;

        const js = addon.js({
            schema: schema_contents
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ]
            };
        }

        const binary = addon.binary({
            schema: schema_contents,
            json: library
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

    it("should ignore_null_scalar generate js", () => {
        const schema_contents = Buffer.from(`
            namespace some.nested.namespace;

            file_extension "dat";

            table Book {
                id:string (id: 0);
                title:string (id: 1);
                authors:[string] (id: 2);
                release:ulong (id: 3);
                genres: [ulong] (id: 4);
                rank: uint (id: 5);
            }

            table Library {
                name:string (id: 0);
                books: [Book] (id: 1);
            }

            root_type Library;
        `);

        const js = addon.js({
            schema: schema_contents
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
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
        for (let i = 0; i < 10; i++) {
            delete library.books[i].rank;
        }

        const binary = addon.binary({
            schema: schema_contents,
            json: json_contents,
            ignore_null_scalar: true
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

    it("should generate schema binary", () => {
        const schema = "Library.bfbs";
        let schema_contents = Buffer.from(`
            namespace some.nested.namespace;

            file_extension "dat";

            table Book {
                id:string (id: 0);
                title:string (id: 1);
                authors:[string] (id: 2);
                release:ulong (id: 3);
                genres: [ulong] (id: 4);
                rank:uint (id: 5);
            }

            table Library {
                name:string (id: 0);
                books: [Book] (id: 1);
            }

            root_type Library;
        `);

        schema_contents = addon.binary({
            schema: schema.replace(".bfbs", ".fbs"),
            schema_contents,
            schema_length: schema_contents.length,
            schema_binary: true
        });

        const js = addon.js({
            schema,
            schema_contents,
            schema_length: schema_contents.length
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
            library.books[i] = {
                id: `book-${ i }`,
                title: `Book ${ i }`,
                authors: [`Author ${ i }`],
                release: Math.floor(Date.now() / 1000),
                genres: [ Math.floor(Math.random() * 1000) ]
            };
        }

        const json = "library.json";
        const json_contents = Buffer.from(JSON.stringify(library));

        const binary = addon.binary({
            schema,
            schema_contents,
            schema_length: schema_contents.length,
            json,
            json_contents,
            json_length: json_contents.length
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

    it("should generate js", () => {
        const schema = "Library.fbs";
        const schema_contents = Buffer.from(DEFAULT_SCHEMA);

        const js = addon.js({
            schema,
            schema_contents,
            schema_length: schema_contents.length
        });

        const library = {
            name: "BookShop 0",
            books: []
        };

        for (let i = 0; i < 10; i++) {
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
        for (let i = 0; i < 10; i++) {
            delete library.books[i].rank;
        }

        expect(() => {
            addon.binary({
                schema,
                schema_contents,
                schema_length: schema_contents.length,
                json,
                json_contents,
                json_length: json_contents.length
            });
        }).to.throw(TypeError);

        const binary = addon.binary({
            schema,
            schema_contents,
            schema_length: schema_contents.length,
            json,
            json_contents,
            json_length: json_contents.length,
            skip_unexpected_fields_in_json: true
        });

        const sandbox = {};
        (new Function(js)).call(sandbox);
        const nsp = sandbox.some.nested.namespace;
        plainAccessor(nsp);

        const bytes = new Uint8Array(binary);
        const buf = new flatbuffers.ByteBuffer(bytes);
        const actual = pick(nsp.Library.getRootAsLibrary(buf), ["name", "books"]);

        for (var i = 0, len = actual.books.length; i < len; i++) {
            actual.books[i] = pick(actual.books[i], ["id", "title", "authors", "release", "genres"]);
        }

        expect(actual.name).to.equal(library.name);
        expect(actual.books).to.deep.equal(library.books);
    });

});
