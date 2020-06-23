(function(global, factory) {
    if (typeof exports !== "undefined") {
        // Node/CommonJS
        factory.call(global, module);
    } else if (typeof define === "function" && define.amd) {
        // AMD
        define(["module"], function(module) {
            factory.call(global, module);
        });
    } else {
        // global variable
        var mod = {
          exports: {}
        };
        factory.call(global, mod);
        global.flatbuffers_addon = mod.exports;
    }
})((function(_this) {
  var g;

  if (typeof window !== "undefined") {
    g = window;
  } else if (typeof global !== "undefined") {
    g = global;
  } else if (typeof self !== "undefined") {
    g = self;
  } else {
    g = _this;
  }

  return g; // eslint-disable-next-line no-invalid-this
}(this)), function(module) {
    "use strict";

    var global = this;
    var exports = module.exports;
    var hasProp = Object.prototype.hasOwnProperty;

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
    if (typeof Object.assign !== "function") {
        Object.assign = function(target) {
            "use strict";
            if (target == null) { // TypeError if undefined or null
                throw new TypeError("Cannot convert undefined or null to object");
            }

            var to = Object(target);

            for (var index = 1, len = arguments.length; index < len; index++) {
                var nextSource = arguments[index];

                if (nextSource != null) { // Skip over if undefined or null
                    for (var nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if (hasProp.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        };
    }

    var createArrayIterator = function(arr) {
        var i = 0;
        var len = arr.length;

        return function next() {
            return i < len ? {
                key: i,
                value: arr[i++],
            } : null;
        };
    };

    var createObjectIterator = function(obj) {
        var i = 0;
        var keys = Object.keys(obj);
        var len = keys.length;

        return function next() {
            return i < len ? {
                key: keys[i],
                value: obj[keys[i++]]
            } : null;
        };
    };

    var createIterableIterator = function(iterable) {
        var iterator = iterable[Symbol.iterator]();
        return function next() {
            var item = iterator.next();
            return item === null || typeof item !== "object" ? item : item.done ? null : item;
        };
    };

    var iterator = function(obj) {
        if (obj === null || typeof obj !== "object") {
            return null;
        }

        return Array.isArray(obj) ? createArrayIterator(obj) : Symbol.iterator in obj ? createIterableIterator(obj) : createObjectIterator(obj);
    };

    var onlyOnce = function(fn) {
        return function() {
            if (fn === null) {
                throw new Error("Callback was already called.");
            }

            var callFn = fn;
            fn = null;
            callFn.apply(null, arguments);
        };
    };

    var eachOfLimit = function(obj, limit, iteratee, cb) {
        if (cb == null) {
            cb = Function.prototype;
        }

        if (limit <= 0) {
            cb();
            return;
        }

        var it = iterator(obj);
        if (it == null) {
            cb();
            return;
        }

        var done = false;
        var running = 0;
        var looping = false;

        function iterate(err, value) {
            running--;
            if (err) {
                if (!done) {
                    done = true;
                    cb(err);
                }
            } else if (done && running <= 0) {
                cb();
            } else if (!looping) {
                replenish();
            }
        }

        function replenish() {
            looping = true;

            var nextElem;

            while (running < limit && !done) {
                nextElem = it();

                if (nextElem == null) {
                    done = true;
                    if (running <= 0) {
                        cb();
                    }
                    return;
                }

                running++;
                iteratee(nextElem.value, nextElem.key, onlyOnce(iterate));
            }

            looping = false;
        }

        replenish();
    };

    var waterfall = function(coll, cb) {
        if (cb == null) {
            cb = Function.prototype;
        }

        var nextArgs = [];

        eachOfLimit(coll, 1, function(iterate, key, next) {
            iterate.apply(null, nextArgs.concat(function(err) {
                nextArgs = Array.prototype.slice.call(arguments, 1);
                next(err);
            }));
        }, function(err) {
            cb.apply(null, [err].concat(nextArgs));
        });
    };

    // A web environment like Electron.js can have Node enabled, so we must
    // distinguish between Node-enabled environments and Node environments per se.
    // This will allow the former to do things like mount NODEFS.
    // Extended check using process.versions fixes issue #8816.
    // (Also makes redundant the original check that 'require' is a function.)
    var ENVIRONMENT_HAS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
    var ENVIRONMENT_IS_WEB = typeof window === 'object';
    var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
    var ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;

    var readTextFile, readBinaryFile, scriptDirectory;

    if (ENVIRONMENT_IS_NODE) {
        scriptDirectory = __dirname + require("path").sep;
    } else {
        if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
            scriptDirectory = self.location.href;
        } else if (document.currentScript) { // web
            scriptDirectory = document.currentScript.src;
        }

        // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
        // otherwise, slice off the final part of the url to find the script directory.
        // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
        // and scriptDirectory will correctly be replaced with an empty string.
        if (scriptDirectory.indexOf('blob:') !== 0) {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/') + 1);
        } else {
            scriptDirectory = '';
        }
    }

    var evaluate;

    if (ENVIRONMENT_IS_NODE) {
        var vm = require("vm");
        var sysPath = require("path");

        var makeRequireFunction = function(localModule) {
            var Module = localModule.constructor;
            var localRequire = localModule.require.bind(localModule);

            localRequire.resolve = function(request) {
                return Module._resolveFilename(request, localModule);
            };

            localRequire.main = process.mainModule;

            // Enable support to add extra extension types.
            localRequire.extensions = Module._extensions;

            localRequire.cache = Module._cache;

            return localRequire;
        };

        var makeModule = function(filename, parent) {
            filename = sysPath.resolve(filename);
            var Module = parent.constructor;
            var localModule = new Module(filename, parent);
            var dirname = sysPath.dirname(filename);
            localModule.filename = filename;
            localModule.paths = Module._nodeModulePaths(dirname);
            var localRequire = makeRequireFunction(localModule);

            return {
                exports: localModule.exports,
                module: localModule,
                require: localRequire,
                __filename: filename,
                __dirname: dirname
            };
        };

        evaluate = function(code, filename, Module) {
            var mod = makeModule(filename, module);
            var script = new vm.Script("(function(require, module, exports, __filename, __dirname, Module) {" + code + "})", { filename: filename });
            var fn = script.runInThisContext();
            return fn(mod.require, mod.module, mod.exports, mod.__filename, mod.__dirname, Module);
        };
    } else {
        evaluate = function(code, filename, Module) {
            var fn = new Function("Module", code);
            return fn(Module);
        };
    }

    if (ENVIRONMENT_IS_NODE) {
        var fs = require("fs");
        readTextFile = function(url, callback) {
            fs.readFile(url, "utf8", callback);
        };

        readBinaryFile = fs.readFile;
    } else if (typeof XMLHttpRequest === "undefined") {
        readTextFile = function(url, callback) {
            fetch(url, { credentials: 'same-origin' }).then(function(response) {
                if (!response.ok) {
                    callback(new Error("failed to load text file at '" + url + "'"));
                    return;
                }

                response.text().then(function(text) {
                    callback(null, text);
                }, callback);
            });
        };

        readBinaryFile = function(url, callback) {
            fetch(url, { credentials: 'same-origin' }).then(function(response) {
                if (!response.ok) {
                    callback(new Error("failed to load binary file at '" + url + "'"));
                    return;
                }

                response.arrayBuffer().then(function(buffer) {
                    callback(null, buffer);
                }, callback);
            });
        };
    } else {
        readTextFile = function(url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.onerror = callback;
            xhr.onload = function xhr_onload() {
                if (this.status === 200 || this.status === 0 && this.responseText) {
                    callback(null, this.responseText);
                    return;
                }
                callback(new Error("failed to load text file at '" + url + "'"));
            };
            xhr.send(null);
            return xhr;
        };

        readBinaryFile = function(url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onerror = callback;
            xhr.onload = function xhr_onload() {
                if (this.status === 200 || this.status === 0 && this.response) {
                    callback(null, this.response);
                    return;
                }
                callback(new Error("failed to load binary file at '" + url + "'"));
            };
            xhr.send(null);
            return xhr;
        };
    }

    function initialize(Module) {
        [
            "vector<uintptr_t>",
            "vector<std::string>",
        ].forEach(function(className) {
            var classNameEsc = className.replace(/\W/g, "$");
            if (hasProp.call(Module, classNameEsc)) {
                Module[className] = Module[classNameEsc];;
            }
        });

        var stackAlloc = Module.stackAlloc;
        var stackRestore = Module.stackRestore;
        var stackSave = Module.stackSave;
        var writeArrayToMemory = Module.writeArrayToMemory;
        var Language = Module.Language;
        var MiniReflect = Module.MiniReflect;
        var Parser = Module.Parser;

        var uintptr_t = function(typedarray) {
            if (!typedarray || typedarray.length === 0) {
                return 0;
            }

            var ptr = stackAlloc(typedarray.length);
            writeArrayToMemory(typedarray, ptr);
            return ptr;
        };

        var getIDLOptions = function() {
            return {
                use_flexbuffers: false,
                strict_json: false,
                ignore_null_scalar: false,
                skip_js_exports: false,
                use_goog_js_export_format: false,
                use_ES6_js_export_format: false,
                output_default_scalars_in_json: false,
                indent_step: 2,
                output_enum_identifiers: true,
                prefixed_enums: true,
                scoped_enums: false,
                include_dependence_headers: true,
                mutable_buffer: false,
                one_file: false,
                proto_mode: false,
                proto_oneof_union: false,
                generate_all: false,
                skip_unexpected_fields_in_json: false,
                generate_name_strings: false,
                generate_object_based_api: false,
                gen_compare: false,
                // cpp_object_api_pointer_type: "std::unique_ptr",
                // cpp_object_api_string_type: "",
                // cpp_object_api_string_flexible_constructor: false,
                gen_nullable: false,
                java_checkerframework: false,
                gen_generated: false,
                object_prefix: "",
                object_suffix: "T",
                union_value_namespacing: true,
                allow_non_utf8: false,
                natural_utf8: false,
                include_prefix: "",
                keep_include_path: false,
                binary_schema_comments: false,
                binary_schema_builtins: false,
                binary_schema_gen_embed: false,
                skip_flatbuffers_import: false,
                // go_import: "",
                // go_namespace: "",
                reexport_ts_modules: true,
                js_ts_short_names: false,
                protobuf_ascii_alike: false,
                size_prefixed: false,
                root_type: "",
                force_defaults: false,
                java_primitive_has_method: false,
                cs_gen_json_serializer: false,
                // cpp_includes: new Module["vector<std::string>"](),
                // cpp_std: "",
                proto_namespace_suffix: "",
                filename_suffix: "_generated",
                filename_extension: "",
                js_ts_global_prefix: "",
                lang: Language.kJs,
                mini_reflect: MiniReflect.kNone,
                lang_to_generate: 0,
                set_empty_strings_to_null: true,
                set_empty_vectors_to_null: true,
            };
        };

        var prepareParser = function(
            parser,
            schema,
            schema_contents,
            schema_length,
            schema_include_directories_arr,
            conform,
            conform_contents,
            conform_length,
            conform_include_directories_arr
        ) {
            parser.SetContentLength(true, schema_length);

            var schema_include_directories = new Module["vector<uintptr_t>"]();
            if (Array.isArray(schema_include_directories_arr)) {
                schema_include_directories_arr.forEach(function(include) {
                    schema_include_directories.push_back(uintptr_t(include));
                });
            }

            if (!parser.ParseFile(schema, uintptr_t(schema_contents), schema_length, schema_include_directories)) {
                var err = parser.error_();
                parser.Reset();
                throw new TypeError(err);
            }

            if (conform_contents && conform_length) {
                var conform_include_directories = new Module["vector<uintptr_t>"]();
                if (Array.isArray(conform_include_directories_arr)) {
                    conform_include_directories_arr.forEach(function(include) {
                        conform_include_directories.push_back(uintptr_t(include));
                    });
                }

                var conform_parser = new Parser(getIDLOptions());
                conform_parser.SetContentLength(true, conform_length);

                try {
                    conform_parser.ParseFile(conform, uintptr_t(conform_contents), conform_length, conform_include_directories);
                    var err = parser.ConformTo(conform_parser);
                    conform_parser.Reset();
                } finally {
                    if (conform_parser) {
                        conform_parser.delete();
                    }
                }

                if (err) {
                    throw new TypeError("schemas don\'t conform: " + err);
                }
            }

            return schema_include_directories;
        }

        Module.GenerateJSTSCode_Internal = function(
            schema,
            schema_contents,
            schema_length,
            schema_include_directories_arr,
            conform,
            conform_contents,
            conform_length,
            conform_include_directories_arr,
            options
        ) {
            
            var opts = getIDLOptions();
            if (options !== null && typeof options === "object") {
                if (options.lang && options.lang !== Language.kJs && options.lang !== Language.kTs) {
                    throw new TypeError("lang must be one of Language.kJs and Language.kTs");
                }
                Object.assign(opts, options);
            }

            var stack = stackSave();

            try {
                var schema_include_directories = new Module["vector<uintptr_t>"]();
                if (Array.isArray(schema_include_directories_arr)) {
                    schema_include_directories_arr.forEach(function(include) {
                        schema_include_directories.push_back(uintptr_t(include));
                    });
                }

                var conform_include_directories = new Module["vector<uintptr_t>"]();
                if (conform_contents && conform_length && Array.isArray(conform_include_directories_arr)) {
                    conform_include_directories_arr.forEach(function(include) {
                        conform_include_directories.push_back(uintptr_t(include));
                    });
                }

                var state = Module.js(
                    schema,
                    uintptr_t(schema_contents),
                    schema_length,
                    schema_include_directories,
                    conform || "",
                    uintptr_t(conform_contents),
                    conform_length || 0,
                    conform_include_directories,
                    opts
                );

                if (state.code) {
                    throw global[state.Error](state.message);
                }

                return state.message;
            } finally {
                stackRestore(stack);
            }
        };

        Module.GenerateJSTSCode_External = function(
            schema,
            schema_contents,
            schema_length,
            schema_include_directories,
            conform,
            conform_contents,
            conform_length,
            conform_include_directories,
            options
        ) {
            var opts = getIDLOptions();
            if (options !== null && typeof options === "object") {
                if (options.lang && options.lang !== Language.kJs && options.lang !== Language.kTs) {
                    throw new TypeError("lang must be one of Language.kJs and Language.kTs");
                }
                Object.assign(opts, options);
            }

            var stack = stackSave();

            try {
                var parser = new Parser(opts);

                prepareParser(
                    parser,
                    schema,
                    schema_contents,
                    schema_length,
                    schema_include_directories,
                    conform,
                    conform_contents,
                    conform_length,
                    conform_include_directories
                );

                var code = parser.GenerateJSTSCode();
                parser.Reset();
                return code;
            } finally {
                if (parser) {
                    parser.delete();
                }
                stackRestore(stack);
            }
        };

        Module.GenerateJSTSCode = Module.GenerateJSTSCode_External;

        Module.GenerateBinary = function(
            schema,
            schema_contents,
            schema_length,
            schema_include_directories,
            conform,
            conform_contents,
            conform_length,
            conform_include_directories,
            json,
            json_contents,
            json_length,
            options
        ) {
            var opts = getIDLOptions();
            if (options !== null && typeof options === "object") {
                if (options.lang && options.lang !== Language.kJs && options.lang !== Language.kTs) {
                    throw new TypeError("lang must be one of Language.kJs and Language.kTs");
                }
                Object.assign(opts, options);
            }
            opts.lang = Language.kBinary;

            var schema_binary = opts.schema_binary;

            var stack = stackSave();

            try {
                var parser = new Parser(opts);

                var include_directories = prepareParser(
                    parser,
                    schema,
                    schema_contents,
                    schema_length,
                    schema_include_directories,
                    conform,
                    conform_contents,
                    conform_length,
                    conform_include_directories
                );

                parser.MarkGenerated();

                if (schema_binary) {
                    parser.SchemaBinary();
                } else {
                    parser.SetContentLength(true, json_length);
                    if (!parser.ParseFile(json, uintptr_t(json_contents), json_length, include_directories)) {
                        var err = parser.error_();
                        parser.Reset();
                        throw new TypeError(err);
                    }
                }

                if (parser.GetSize() == 0) {
                    parser.Reset();
                    throw new TypeError("input file is not a json file");
                }

                var typedarray = parser.GetBuffer();
                // return typedarray;

                var ret = new Uint8Array(typedarray.length);
                ret.set(typedarray);

                parser.Reset();

                return ret;
            } finally {
                if (parser) {
                    parser.delete();
                }
                stackRestore(stack);
            }
        };
    }

    exports.init = function(options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = null;
        }

        if (typeof callback !== "function") {
            callback = Function.prototype;
        }

        var Module = Object.assign({
            wasmBinaryFile: scriptDirectory + "flatbuffers_addon_wasm.wasm",
            wasmCodeFile: scriptDirectory + "flatbuffers_addon_wasm.js",
            asmjsCodeFile: scriptDirectory + "flatbuffers_addon_asmjs.js"
        }, options);

        var onRuntimeInitialized = Module.onRuntimeInitialized;
        Module.onRuntimeInitialized = function() {
            initialize(Module);
            if (typeof onRuntimeInitialized === "function") {
                onRuntimeInitialized();
            }
            callback(null, Module);
        };

        var codeFile;

        waterfall([
            next => {
                if (typeof WebAssembly !== "object" || !Module.wasmBinaryFile || !Module.wasmCodeFile) {
                    codeFile = Module.asmjsCodeFile;
                    next(null, null);
                    return;
                }

                codeFile = Module.wasmCodeFile;

                // on browser where fetch is not supported (IE11), wasmBinaryFile is read synchronously
                // which may not be allowed by the browser or block the UI until the end of loading.
                // read the wasmBinaryFile asynchronously before evaluating wasm code
                readBinaryFile(Module.wasmBinaryFile, next);
            },

            (bytes, next) => {
                if (bytes) {
                    Module.wasmBinary = bytes;

                    if (ENVIRONMENT_IS_NODE) {
                        Module.instantiateWasm = function(importObject, receiveInstance) {
                            var mod = new WebAssembly.Module(bytes);
                            var instance = new WebAssembly.Instance(mod, importObject);
                            receiveInstance(instance, mod);
                            return instance.exports;
                        };
                    }
                }

                readTextFile(codeFile, next);
            }
        ], function(err, code) {
            if (err) {
                callback(err);
            } else {
                evaluate(code, codeFile, Module);
            }
        });
    }
});
