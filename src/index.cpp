#include <node_api.h>
#include <assert.h>

#include "flatbuffers/flatbuffers.h"
#include "flatbuffers/idl.h"

#define ASSERT_DECL_BUFFER_OPT(name, buffer, buffer_len)    \
    status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key); \
    assert(status == napi_ok);                              \
                                                            \
    status = napi_get_property(env, options, key, &value);  \
    assert(status == napi_ok);                              \
                                                            \
    status = napi_is_buffer(env, value, &is_buffer);        \
    assert(status == napi_ok);                              \
                                                            \
    if (!is_buffer) {                                       \
        napi_throw_type_error(env, nullptr, name " option must be a buffer"); \
        return nullptr;                                     \
    }                                                       \
                                                            \
    char *buffer;                                           \
    size_t buffer_len;                                      \
    napi_get_buffer_info(env, value, reinterpret_cast<void **>(&buffer), &buffer_len); \
    assert(status == napi_ok)

#define ASSERT_DECL_BUFFER_STRING_OPT(name, identifier, null_terminated) \
    ASSERT_DECL_BUFFER_OPT(name, identifier##_buffer, identifier##_len); \
    std::string identifier(identifier##_buffer, null_terminated ? identifier##_len - 1 : identifier##_len);

#define SET_STRING_OPT(name, identifier)                   \
    status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key);\
    assert(status == napi_ok);                              \
                                                            \
    status = napi_has_property(env, options, key, &has_prop); \
    assert(status == napi_ok);                              \
                                                            \
    if (has_prop) {                                         \
        ASSERT_DECL_BUFFER_STRING_OPT(name, identifier, true);    \
        opts.identifier = identifier;                       \
    }

#define ASSERT_ASSIGN_BOOLEAN_OPT(name, identifier)           \
    status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key); \
    assert(status == napi_ok);                              \
                                                            \
    status = napi_get_property(env, options, key, &value);  \
    assert(status == napi_ok);                              \
                                                            \
    status = napi_typeof(env, value, &valuetype);           \
    assert(status == napi_ok);                              \
                                                            \
    if (valuetype != napi_boolean) {                        \
        napi_throw_type_error(env, nullptr, name " option must be a boolean");\
        return nullptr;                                     \
    }                                                       \
                                                            \
    status = napi_get_value_bool(env, value, &identifier);  \
    assert(status == napi_ok)

#define ASSERT_DECL_BOOLEAN_OPT(name, identifier) \
    bool identifier;                                \
    ASSERT_ASSIGN_BOOLEAN_OPT(name, identifier)

#define SET_BOOLEAN_OPT(name, identifier)                   \
    status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key);\
    assert(status == napi_ok);                              \
                                                            \
    status = napi_has_property(env, options, key, &has_prop); \
    assert(status == napi_ok);                              \
                                                            \
    if (has_prop) {                                         \
        ASSERT_DECL_BOOLEAN_OPT(name, identifier);          \
        opts.identifier = identifier;                       \
    }

#define ASSERT_ASSIGN_BUFFER_ARRAY(name, identifier)         \
    status = napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &key);\
    assert(status == napi_ok);                                          \
                                                                        \
    status = napi_get_property(env, options, key, &value);              \
    assert(status == napi_ok);                                          \
                                                                        \
    status = napi_is_array(env, value, &is_array);                      \
    assert(status == napi_ok);                                          \
                                                                        \
    if (!is_array) {                                                    \
        napi_throw_type_error(env, nullptr, name " option must be an Array"); \
        return nullptr;                                                 \
    }                                                                   \
                                                                        \
    napi_get_array_length(env, value, &array_len);                      \
    assert(status == napi_ok);                                          \
                                                                        \
    char *identifier##_buffer;                                          \
    size_t identifier##_buffer_len;                                     \
    for (uint32_t i = 0; i < array_len; i++) {                          \
        napi_get_element(env, value, i, &key);                          \
        status = napi_is_buffer(env, key, &is_buffer);                  \
        assert(status == napi_ok);                                      \
                                                                        \
        if (!is_buffer) {                                               \
            std::stringstream err;                                      \
            err << "element " << (i + 1) << " of " << name << " must be a buffer"; \
            napi_throw_type_error(env, nullptr, err.str().c_str());     \
            return nullptr;                                             \
        }                                                               \
                                                                        \
        napi_get_buffer_info(env, key, reinterpret_cast<void **>(&identifier##_buffer), &identifier##_buffer_len); \
        assert(status == napi_ok);                                      \
        identifier.push_back(identifier##_buffer);        \
    }

#define ASSERT_DECL_BUFFER_ARRAY(name, identifier)  \
    std::vector<const char *> identifier;           \
    ASSERT_ASSIGN_BUFFER_ARRAY(name, identifier);

static bool ParseFile(
    flatbuffers::Parser &parser,
    const std::string &filename,
    const char *contents,
    const size_t size,
    std::vector<const char *> &include_directories
) {

    if (reflection::SchemaExtension() == flatbuffers::GetExtension(filename)) {
        return parser.Deserialize(reinterpret_cast<const uint8_t *>(contents), size);
    }

    auto local_include_directory = flatbuffers::StripFileName(filename);
    include_directories.push_back(local_include_directory.c_str());
    include_directories.push_back(nullptr);
    bool ret = parser.Parse(contents, &include_directories[0], filename.c_str());
    include_directories.pop_back();
    include_directories.pop_back();
    return ret;
}

struct PreparedState {
    napi_status status;
    PreparedState(std::nullptr_t) : status(napi_invalid_arg) {};
    PreparedState() : status(napi_ok) {}
};

static PreparedState prepareParser(
    const napi_env &env,
    const napi_value &options,
    flatbuffers::Parser &parser,
    std::vector<const char *> &schema_include_directories
) {
    napi_status status;
    napi_value key;
    napi_value value;
    bool is_buffer;
    bool is_array;
    bool has_prop;
    uint32_t array_len;

    ASSERT_DECL_BUFFER_STRING_OPT("schema", schema, true);
    ASSERT_DECL_BUFFER_STRING_OPT("schema_contents", schema_contents, false);
    ASSERT_ASSIGN_BUFFER_ARRAY("include_directories", schema_include_directories);

    parser.SetContentLength(true, schema_contents_len);

    if (!ParseFile(parser, schema, schema_contents.c_str(), schema_contents.length(), schema_include_directories)) {
        auto err = parser.error_.c_str();
        parser.builder_.Reset();
        napi_throw_type_error(env, nullptr, err);
        return nullptr;
    }

    status = napi_create_string_utf8(env, "conform", NAPI_AUTO_LENGTH, &key);
    assert(status == napi_ok);

    status = napi_has_property(env, options, key, &has_prop);
    assert(status == napi_ok);

    if (has_prop) {
        ASSERT_DECL_BUFFER_STRING_OPT("conform", conform, true);
        ASSERT_DECL_BUFFER_STRING_OPT("conform_contents", conform_contents, false);
        if (!conform_contents.empty()) {
            ASSERT_DECL_BUFFER_ARRAY("conform_include_directories", conform_include_directories);

            flatbuffers::Parser conform_parser;
            conform_parser.SetContentLength(true, conform_contents_len);
            if (!ParseFile(conform_parser, conform, conform_contents.c_str(), conform_contents.length(), conform_include_directories)) {
                auto err = conform_parser.error_.c_str();
                conform_parser.builder_.Reset();
                napi_throw_type_error(env, nullptr, err);
                return nullptr;
            }

            auto err = parser.ConformTo(conform_parser);
            conform_parser.builder_.Reset();
            if (!err.empty()) {
                std::stringstream errss;
                errss << "schemas don\'t conform: " << err;
                napi_throw_type_error(env, nullptr, errss.str().c_str());
                return nullptr;
            }
        }
    }

    return PreparedState();
}

napi_value GenerateBinary(napi_env env, napi_callback_info info) {
    napi_status status;

    size_t argc = 1;
    napi_value args[1];
    status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    assert(status == napi_ok);

    if (argc < 1) {
        napi_throw_type_error(env, nullptr, "Wrong number of arguments");
        return nullptr;
    }

    napi_valuetype valuetype;
    status = napi_typeof(env, args[0], &valuetype);
    assert(status == napi_ok);

    if (valuetype != napi_object) {
        napi_throw_type_error(env, nullptr, "Wrong arguments");
        return nullptr;
    }

    napi_value options;
    status = napi_coerce_to_object(env, args[0], &options);
    assert(status == napi_ok);

    napi_value key;
    napi_value value;
    bool is_buffer;
    // bool is_array;
    bool has_prop;

    flatbuffers::IDLOptions opts;
    opts.lang = flatbuffers::IDLOptions::kBinary;

    SET_BOOLEAN_OPT("strict_json", strict_json);
    SET_BOOLEAN_OPT("ignore_null_scalar", ignore_null_scalar);
    SET_BOOLEAN_OPT("allow_non_utf8", allow_non_utf8);
    SET_BOOLEAN_OPT("skip_unexpected_fields_in_json", skip_unexpected_fields_in_json);
    SET_BOOLEAN_OPT("size_prefixed", size_prefixed);
    SET_BOOLEAN_OPT("proto_mode", proto_mode);
    SET_BOOLEAN_OPT("proto_oneof_union", proto_oneof_union);
    SET_BOOLEAN_OPT("binary_schema_comments", binary_schema_comments);
    SET_BOOLEAN_OPT("binary_schema_builtins", binary_schema_builtins);
    SET_BOOLEAN_OPT("force_defaults", force_defaults);

    // Not documented in flatbuffers
    SET_BOOLEAN_OPT("union_value_namespacing", union_value_namespacing);

    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));
    std::vector<const char *> schema_include_directories;
    PreparedState state = prepareParser(env, options, *parser.get(), schema_include_directories);

    if (state.status != napi_ok) {
        parser->builder_.Reset();
        return nullptr;
    }

    parser->MarkGenerated();

    bool schema_binary = false;

    status = napi_create_string_utf8(env, "schema_binary", NAPI_AUTO_LENGTH, &key);
    assert(status == napi_ok);

    status = napi_has_property(env, options, key, &has_prop);
    assert(status == napi_ok);

    if (has_prop) {
        ASSERT_ASSIGN_BOOLEAN_OPT("schema_binary", schema_binary);
    }

    if (schema_binary) {
        parser->Serialize();
        parser->file_extension_ = reflection::SchemaExtension();
    } else {
        ASSERT_DECL_BUFFER_STRING_OPT("json", json, true);
        ASSERT_DECL_BUFFER_STRING_OPT("json_contents", json_contents, false);

        parser->SetContentLength(true, json_contents_len);
        if (!ParseFile(*parser.get(), json, json_contents.c_str(), json_contents.length(), schema_include_directories)) {
            auto err = parser->error_.c_str();
            parser->builder_.Reset();
            napi_throw_type_error(env, nullptr, err);
            return nullptr;
        }
    }

    size_t len = parser->builder_.GetSize();
    if (len == 0) {
        parser->builder_.Reset();
        napi_throw_type_error(env, nullptr, "input file is neither json nor a .fbs (schema) file");
        return nullptr;
    }

    char *buffer = reinterpret_cast<char *>(parser->builder_.GetBufferPointer());

    napi_value res;
    status = napi_create_buffer_copy(env, len, buffer, NULL, &res);
    assert(status == napi_ok);

    parser->builder_.Reset();

    return res;
}

napi_value GenerateJS(napi_env env, napi_callback_info info) {
    napi_status status;

    size_t argc = 1;
    napi_value args[1];
    status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    assert(status == napi_ok);

    if (argc < 1) {
        napi_throw_type_error(env, nullptr, "Wrong number of arguments");
        return nullptr;
    }

    napi_valuetype valuetype;
    status = napi_typeof(env, args[0], &valuetype);
    assert(status == napi_ok);

    if (valuetype != napi_object) {
        napi_throw_type_error(env, nullptr, "Wrong arguments");
        return nullptr;
    }

    napi_value options;
    status = napi_coerce_to_object(env, args[0], &options);
    assert(status == napi_ok);

    napi_value key;
    napi_value value;
    bool is_buffer;
    // bool is_array;
    bool has_prop;

    flatbuffers::IDLOptions opts;

    SET_BOOLEAN_OPT("allow_non_utf8", allow_non_utf8);
    SET_BOOLEAN_OPT("mutable_buffer", mutable_buffer);
    SET_BOOLEAN_OPT("generate_all", generate_all);
    SET_BOOLEAN_OPT("skip_js_exports", skip_js_exports);
    SET_BOOLEAN_OPT("use_goog_js_export_format", use_goog_js_export_format);
    SET_BOOLEAN_OPT("use_ES6_js_export_format", use_ES6_js_export_format);
    SET_BOOLEAN_OPT("size_prefixed", size_prefixed);
    SET_BOOLEAN_OPT("proto_mode", proto_mode);
    SET_BOOLEAN_OPT("proto_oneof_union", proto_oneof_union);
    SET_BOOLEAN_OPT("keep_include_path", keep_include_path);
    SET_BOOLEAN_OPT("skip_flatbuffers_import", skip_flatbuffers_import);
    SET_BOOLEAN_OPT("reexport_ts_modules", reexport_ts_modules);
    SET_BOOLEAN_OPT("js_ts_short_names", js_ts_short_names);
    SET_BOOLEAN_OPT("union_value_namespacing", union_value_namespacing);

    // Not documented in flatbuffers
    SET_BOOLEAN_OPT("union_value_namespacing", union_value_namespacing);

    SET_STRING_OPT("include_prefix", include_prefix);
    if (!opts.include_prefix.empty()) {
        opts.include_prefix = flatbuffers::ConCatPathFileName(flatbuffers::PosixPath(opts.include_prefix.c_str()), "");
    }

    opts.lang = flatbuffers::IDLOptions::kJs;

    status = napi_create_string_utf8(env, "type", NAPI_AUTO_LENGTH, &key);
    assert(status == napi_ok);

    status = napi_has_property(env, options, key, &has_prop);
    assert(status == napi_ok);

    if (has_prop) {
        status = napi_get_property(env, options, key, &value);
        assert(status == napi_ok);

        status = napi_typeof(env, value, &valuetype);
        assert(status == napi_ok);

        if (valuetype != napi_string) {
            napi_throw_type_error(env, nullptr, "type" " option must be a string");
            return nullptr;
        }

        char buffer[3];
        size_t buffer_size = 3;
        size_t copied;

        status = napi_get_value_string_utf8(env, value, buffer, buffer_size, &copied);
        assert(status == napi_ok);

        if (std::string(buffer, copied) == "ts") {
            opts.lang = flatbuffers::IDLOptions::kTs;
        }
    }

    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));
    std::vector<const char *> schema_include_directories;
    PreparedState state = prepareParser(env, options, *parser.get(), schema_include_directories);
    if (state.status != napi_ok) {
        parser->builder_.Reset();
        return nullptr;
    }

    std::string code = flatbuffers::GenerateJSTSCode(*parser.get());

    napi_value res;
    status = napi_create_string_utf8(env, code.c_str(), code.length(), &res);
    assert(status == napi_ok);

    parser->builder_.Reset();

    return res;
}

#define DECLARE_NAPI_METHOD(name, func) { name, 0, func, 0, 0, 0, napi_default, 0 }

napi_value Init(napi_env env, napi_value exports) {
    napi_status status;

    napi_property_descriptor desc[] = {
        DECLARE_NAPI_METHOD("binary", GenerateBinary),
        DECLARE_NAPI_METHOD("js", GenerateJS),
    };
    status = napi_define_properties(env, exports, sizeof(desc) / sizeof(*desc), desc);

    assert(status == napi_ok);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
