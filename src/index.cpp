// http://www.puritys.me/docs-blog/article-286-How-to-pass-the-paramater-of-Node.js-or-io.js-into-native-C/C++-function..html
// https://community.risingstack.com/using-buffers-node-js-c-plus-plus/
// https://github.com/bodokaiser/node-addons

#include <nan.h>

#include "flatbuffers/flatbuffers.h"
#include "flatbuffers/idl.h"

using namespace Nan;
using namespace v8;
using namespace node;

namespace NODE_GYP_MODULE_NAME {

#define ASSERT_GET_STRING_OPT(options, opt, name, identifier)   \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (!options->Has(opt)) {                                   \
        ThrowTypeError(name " option is required");             \
        return;                                                 \
    }                                                           \
                                                                \
    value = options->Get(opt);                                  \
    if (!value->IsString()) {                                   \
        ThrowTypeError(name " option must be a string");        \
        return;                                                 \
    }                                                           \
    String::Utf8Value identifier(value)

#define ASSERT_GET_BUFFER_OPT(options, opt, name, identifier)   \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (!options->Has(opt)) {                                   \
        ThrowTypeError(name " option is required");             \
        return;                                                 \
    }                                                           \
                                                                \
    value = options->Get(opt);                                  \
    if (!value->IsObject()) {                                   \
        ThrowTypeError(name " option must be a buffer");        \
        return;                                                 \
    }                                                           \
    char* identifier = (char*) Buffer::Data(value->ToObject())

#define ASSERT_GET_UINT32_OPT(options, opt, name, identifier)   \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (!options->Has(opt)) {                                   \
        ThrowTypeError(name " option is required");             \
        return;                                                 \
    }                                                           \
                                                                \
    value = options->Get(opt);                                  \
    if (!value->IsUint32()) {                                   \
        ThrowTypeError(name " option must be a positive integer");\
        return;                                                 \
    }                                                           \
    unsigned int identifier = value->Uint32Value()

#define ASSERT_GET_STRING_ARRAY_OPT(options, opt, name, identifier)\
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (!options->Has(opt)) {                                   \
        ThrowTypeError(name " option is required");             \
        return;                                                 \
    }                                                           \
                                                                \
    value = options->Get(opt);                                  \
    if (!value->IsArray()) {                                    \
        ThrowTypeError(name " option must be an array");        \
        return;                                                 \
    }                                                           \
    array = Local<Array>::Cast(value);                          \
                                                                \
    std::vector<const char *> identifier;                       \
    for (unsigned int i = 0, len = array->Length(); i < len; i++) { \
        value = array->Get(i);                                  \
        if (!value->IsString()) {                               \
            std::stringstream err;                              \
            err << "element " << (i + 1) << " of " << name << " must be a string"; \
            ThrowTypeError(err.str().c_str());                  \
            return;                                             \
        }                                                       \
        String::Utf8Value utf8str(value);                       \
        identifier.push_back(std::string(*utf8str).c_str());    \
    }

#define ASSERT_GET_BOOLEAN_OPT(options, opt, name, identifier)  \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (!options->Has(opt)) {                                   \
        ThrowTypeError(name " option is required");             \
        return;                                                 \
    }                                                           \
                                                                \
    value = options->Get(opt);                                  \
    if (!value->IsBoolean()) {                                  \
        ThrowTypeError(name " option must be a boolean");       \
        return;                                                 \
    }                                                           \
    bool identifier = value->BooleanValue()

#define SET_BOOLEAN_OPT(options, opt, opts, name, identifier)   \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (options->Has(opt)) {                                    \
        ASSERT_GET_BOOLEAN_OPT(options, opt, name, identifier); \
        opts.identifier = identifier;                           \
    }

static bool ParseFile(flatbuffers::Parser &parser, const std::string &filename, const char *contents, std::vector<const char *> &include_directories) {
    auto local_include_directory = flatbuffers::StripFileName(filename);
    include_directories.push_back(local_include_directory.c_str());
    include_directories.push_back(nullptr);
    if (!parser.Parse(contents, &include_directories[0], filename.c_str())) {
        return false;
    }
    include_directories.pop_back();
    include_directories.pop_back();
    return true;
}

NAN_METHOD(GenerateBinary) {
    Nan::HandleScope scope;

    if (!info[0]->IsObject()) {
        ThrowTypeError("First argument should be an Object.");
        return;
    }

    Local<Object> options = info[0]->ToObject();
    Local<String> opt;
    Local<Value> value;
    Local<Array> array;

    ASSERT_GET_STRING_OPT(options, opt, "schema", schema);
    ASSERT_GET_BUFFER_OPT(options, opt, "schema_contents", schema_contents);
    ASSERT_GET_UINT32_OPT(options, opt, "schema_length", schema_length);

    ASSERT_GET_STRING_OPT(options, opt, "json", json);
    ASSERT_GET_BUFFER_OPT(options, opt, "json_contents", json_contents);
    ASSERT_GET_UINT32_OPT(options, opt, "json_length", json_length);

    ASSERT_GET_STRING_ARRAY_OPT(options, opt, "include_directories", include_directories);

    flatbuffers::IDLOptions opts;
    opts.lang = flatbuffers::IDLOptions::kBinary;

    SET_BOOLEAN_OPT(options, opt, opts, "strict_json", strict_json);
    SET_BOOLEAN_OPT(options, opt, opts, "allow_non_utf8", allow_non_utf8);
    SET_BOOLEAN_OPT(options, opt, opts, "skip_unexpected_fields_in_json", skip_unexpected_fields_in_json);
    SET_BOOLEAN_OPT(options, opt, opts, "union_value_namespacing", union_value_namespacing);
    SET_BOOLEAN_OPT(options, opt, opts, "binary_schema_comments", binary_schema_comments);

    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));

    parser->SetSize(true, schema_length);
    if (!ParseFile(*parser.get(), std::string(*schema), schema_contents, include_directories)) {
        ThrowTypeError(parser->error_.c_str());
        return;
    }

    if (options->Has(Local<String>(New<String>("conform").ToLocalChecked()))) {
        ASSERT_GET_STRING_OPT(options, opt, "conform", conform);

        if (!std::string(*conform).empty()) {
            ASSERT_GET_BUFFER_OPT(options, opt, "conform_contents", conform_contents);
            ASSERT_GET_UINT32_OPT(options, opt, "conform_length", conform_length);
            ASSERT_GET_STRING_ARRAY_OPT(options, opt, "conform_include_directories", conform_include_directories);

            flatbuffers::Parser conform_parser;
            conform_parser.SetSize(true, conform_length);
            ParseFile(conform_parser, std::string(*conform), conform_contents, conform_include_directories);
            auto err = parser->ConformTo(conform_parser);
            if (!err.empty()) {
                std::stringstream errss;
                errss << "schemas don\'t conform: " << err;
                ThrowTypeError(errss.str().c_str());
                return;
            }
        }
    }

    bool schema_binary = false;

    if (options->Has(Local<String>(New<String>("schema_binary").ToLocalChecked()))) {
        ASSERT_GET_BOOLEAN_OPT(options, opt, "schema_binary", schema_binary_);
        schema_binary = schema_binary_;

        if (schema_binary_) {
            parser->Serialize();
            parser->file_extension_ = reflection::SchemaExtension();
        }
    }

    if (!schema_binary) {
        parser->SetSize(true, json_length);
        if (!ParseFile(*parser.get(), std::string(*json), json_contents, include_directories)) {
            ThrowTypeError(parser->error_.c_str());
            return;
        }
    }

    Local<Object> ret;

    if (parser->builder_.GetSize() != 0) {
        char *buffer = reinterpret_cast<char *>(parser->builder_.GetBufferPointer());
        size_t len = parser->builder_.GetSize();
        ret = CopyBuffer(buffer, len).ToLocalChecked(); // Make v8 allocator handle gc when needed
        parser->builder_.Reset(); // Free duplicated memory
    } else {
        ret = NewBuffer(0).ToLocalChecked();
    }

    info.GetReturnValue().Set(ret);
}

NAN_METHOD(GenerateJs) {
    Nan::HandleScope scope;

    if (!info[0]->IsObject()) {
        ThrowTypeError("First argument should be an Object.");
        return;
    }

    Local<Object> options = info[0]->ToObject();
    Local<String> opt;
    Local<Value> value;
    Local<Array> array;

    ASSERT_GET_STRING_OPT(options, opt, "schema", schema);
    ASSERT_GET_BUFFER_OPT(options, opt, "schema_contents", schema_contents);
    ASSERT_GET_UINT32_OPT(options, opt, "schema_length", schema_length);

    ASSERT_GET_STRING_ARRAY_OPT(options, opt, "include_directories", include_directories);

    flatbuffers::IDLOptions opts;

    opts.lang = flatbuffers::IDLOptions::kJs;

    if (options->Has(Local<String>(New<String>("type").ToLocalChecked()))) {
        ASSERT_GET_STRING_OPT(options, opt, "type", type);
        if (std::string(*type) == "ts") {
            opts.lang = flatbuffers::IDLOptions::kTs;
        }
    }

    SET_BOOLEAN_OPT(options, opt, opts, "strict_json", strict_json);
    SET_BOOLEAN_OPT(options, opt, opts, "allow_non_utf8", allow_non_utf8);
    SET_BOOLEAN_OPT(options, opt, opts, "union_value_namespacing", union_value_namespacing);
    SET_BOOLEAN_OPT(options, opt, opts, "skip_js_exports", skip_js_exports);
    SET_BOOLEAN_OPT(options, opt, opts, "use_goog_js_export_format", use_goog_js_export_format);
    SET_BOOLEAN_OPT(options, opt, opts, "skip_flatbuffers_import", skip_flatbuffers_import);
    SET_BOOLEAN_OPT(options, opt, opts, "reexport_ts_modules", reexport_ts_modules);

    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));

    parser->SetSize(true, schema_length);
    if (!ParseFile(*parser.get(), std::string(*schema), schema_contents, include_directories)) {
        ThrowTypeError(parser->error_.c_str());
        return;
    }

    if (options->Has(Local<String>(New<String>("conform").ToLocalChecked()))) {
        ASSERT_GET_STRING_OPT(options, opt, "conform", conform);

        if (!std::string(*conform).empty()) {
            ASSERT_GET_BUFFER_OPT(options, opt, "conform_contents", conform_contents);
            ASSERT_GET_UINT32_OPT(options, opt, "conform_length", conform_length);
            ASSERT_GET_STRING_ARRAY_OPT(options, opt, "conform_include_directories", conform_include_directories);

            flatbuffers::Parser conform_parser;
            conform_parser.SetSize(true, conform_length);
            ParseFile(conform_parser, std::string(*conform), conform_contents, conform_include_directories);
            auto err = parser->ConformTo(conform_parser);
            if (!err.empty()) {
                std::stringstream errss;
                errss << "schemas don\'t conform: " << err;
                ThrowTypeError(errss.str().c_str());
                return;
            }
        }
    }

    std::string code = flatbuffers::GenerateJSCode(*parser.get());
    info.GetReturnValue().Set(New<String>(code.c_str()).ToLocalChecked());
}

NAN_MODULE_INIT(Init) {
    Nan::Set(target,
        New<String>("binary").ToLocalChecked(),
        New<FunctionTemplate>(GenerateBinary)->GetFunction()
    );

    Nan::Set(target,
        New<String>("js").ToLocalChecked(),
        New<FunctionTemplate>(GenerateJs)->GetFunction()
    );
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}