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

#define GET_STRING_OPT(name, identifier)                        \
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

#define GET_BUFFER_OPT(name, identifier)                        \
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

#define GET_UINT32_OPT(name, identifier)                        \
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

#define GET_STRING_ARRAY_OPT(name, identifier)                  \
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

#define GET_BOOLEAN_OPT(name, identifier)                       \
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

#define SET_BOOLEAN_OPT(name, identifier)                       \
    opt = Local<String>(New<String>(name).ToLocalChecked());    \
    if (options->Has(opt)) {                                    \
        GET_BOOLEAN_OPT(name, identifier);                      \
        opts.identifier = identifier;                           \
    }

static bool ParseFile(flatbuffers::Parser &parser, const std::string &filename,
                      const char *contents,
                      std::vector<const char *> &include_directories) {
    auto local_include_directory = flatbuffers::StripFileName(filename);
    include_directories.push_back(local_include_directory.c_str());
    include_directories.push_back(nullptr);
    if (!parser.Parse(contents, &include_directories[0],
                      filename.c_str()))
        return false;
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

    GET_STRING_OPT("schema", schema);
    GET_BUFFER_OPT("schema_contents", schema_contents);
    GET_UINT32_OPT("schema_length", schema_length);

    GET_STRING_OPT("json", json);
    GET_BUFFER_OPT("json_contents", json_contents);
    GET_UINT32_OPT("json_length", json_length);

    GET_STRING_ARRAY_OPT("include_directories", include_directories);

    flatbuffers::IDLOptions opts;
    opts.lang = flatbuffers::IDLOptions::kBinary;

    SET_BOOLEAN_OPT("strict_json", strict_json);
    SET_BOOLEAN_OPT("allow_non_utf8", allow_non_utf8);
    SET_BOOLEAN_OPT("skip_unexpected_fields_in_json", skip_unexpected_fields_in_json);
    SET_BOOLEAN_OPT("union_value_namespacing", union_value_namespacing);
    SET_BOOLEAN_OPT("binary_schema_comments", binary_schema_comments);

    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));

    parser->SetSize(true, schema_length);
    if (!ParseFile(*parser.get(), std::string(*schema), schema_contents, include_directories)) {
        ThrowTypeError(parser->error_.c_str());
        return;
    }

    opt = Local<String>(New<String>("conform").ToLocalChecked());
    if (options->Has(opt)) {
        GET_STRING_OPT("conform", conform);

        if (std::string(*conform).empty()) {
            GET_BUFFER_OPT("conform_contents", conform_contents);
            GET_UINT32_OPT("conform_length", conform_length);
            GET_STRING_ARRAY_OPT("conform_include_directories", conform_include_directories);

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

    if (options->Has(Local<String>(New<String>("schema_binary").ToLocalChecked()))) {
        GET_BOOLEAN_OPT("schema_binary", schema_binary);

        if (schema_binary) {
            parser->Serialize();
            parser->file_extension_ = reflection::SchemaExtension();
        }
    }

    parser->SetSize(true, json_length);
    if (!ParseFile(*parser.get(), std::string(*json), json_contents, include_directories)) {
        ThrowTypeError(parser->error_.c_str());
        return;
    }

    Local<Object> ret;

    if (parser->builder_.GetSize() != 0) {
        char *buffer = reinterpret_cast<char *>(parser->builder_.GetBufferPointer());
        size_t len = parser->builder_.GetSize();
        ret = CopyBuffer(buffer, len).ToLocalChecked();
    } else {
        ret = NewBuffer(0).ToLocalChecked();
    }

    info.GetReturnValue().Set(ret);
}

NAN_MODULE_INIT(Init) {
    Nan::Set(target,
        New<String>("binary").ToLocalChecked(),
        New<FunctionTemplate>(GenerateBinary)->GetFunction()
    );
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)

}