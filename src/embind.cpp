#include <emscripten/bind.h>

#if defined(__BORLANDC__)
    typedef unsigned char uint8_t;
    typedef __int64 int64_t;
    typedef unsigned long uintptr_t;
#elif defined(_MSC_VER)
    typedef unsigned char uint8_t;
    typedef __int64 int64_t;
#else
    #include <stdint.h>
#endif

#include "flatbuffers/flatbuffers.h"
#include "flatbuffers/idl.h"

using namespace emscripten;

static bool ParseFile(
    flatbuffers::Parser &parser,
    const std::string &filename,
    const char *contents,
    const size_t size,
    std::vector<const char *> &include_directories
) {
    if (flatbuffers::GetExtension(filename) == reflection::SchemaExtension()) {
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

struct ResultState {
    unsigned int code;
    std::string message;
    std::string Error;

    ResultState() : code(0), Error("TypeError") {}
};

static ResultState prepareParser(
    flatbuffers::Parser &parser,
    const std::string &schema,
    const char *schema_contents,
    const size_t schema_length,
    std::vector<const char *> &schema_include_directories,
    const std::string &conform,
    const char *conform_contents,
    const size_t conform_length,
    std::vector<const char *> &conform_include_directories
) {
    ResultState state;

    parser.SetContentLength(true, schema_length);

    if (!ParseFile(parser, schema, schema_contents, schema_length, schema_include_directories)) {
        state.message = parser.error_;
        state.code = 1;
        parser.builder_.Reset();
        return state;
    }

    if (conform_contents && conform_length) {
        flatbuffers::Parser conform_parser;
        conform_parser.SetContentLength(true, conform_length);

        if (!ParseFile(conform_parser, conform, conform_contents, conform_length, conform_include_directories)) {
            state.message = conform_parser.error_;
            state.code = 1;
            conform_parser.builder_.Reset();
            return state;
        }

        state.message = parser.ConformTo(conform_parser);
        conform_parser.builder_.Reset();
        if (!state.message.empty()) {
            state.code = 1;
            return state;
        }
    }

    return state;
}

static ResultState GenerateJSTSCode(
    const std::string &schema,
    const char *schema_contents,
    const size_t schema_length,
    std::vector<const char *> &schema_include_directories,
    const std::string &conform,
    const char *conform_contents,
    const size_t conform_length,
    std::vector<const char *> &conform_include_directories,
    flatbuffers::IDLOptions &opts
) {
    std::unique_ptr<flatbuffers::Parser> parser(new flatbuffers::Parser(opts));
    ResultState state = prepareParser(
        *parser.get(),
        schema,
        schema_contents,
        schema_length,
        schema_include_directories,
        conform,
        conform_contents,
        conform_length,
        conform_include_directories
    );

    if (state.code) {
        return state;
    }

    state.message = flatbuffers::GenerateJSTSCode(*parser.get());
    parser->builder_.Reset();
    return state;
}

EMSCRIPTEN_BINDINGS(NODE_GYP_MODULE_NAME) {
    value_object<flatbuffers::IDLOptions>("IDLOptions")
        .field("use_flexbuffers", &flatbuffers::IDLOptions::use_flexbuffers)
        .field("strict_json", &flatbuffers::IDLOptions::strict_json)
        .field("ignore_null_scalar", &flatbuffers::IDLOptions::ignore_null_scalar)
        .field("skip_js_exports", &flatbuffers::IDLOptions::skip_js_exports)
        .field("use_goog_js_export_format", &flatbuffers::IDLOptions::use_goog_js_export_format)
        .field("use_ES6_js_export_format", &flatbuffers::IDLOptions::use_ES6_js_export_format)
        .field("output_default_scalars_in_json", &flatbuffers::IDLOptions::output_default_scalars_in_json)
        .field("indent_step", &flatbuffers::IDLOptions::indent_step)
        .field("output_enum_identifiers", &flatbuffers::IDLOptions::output_enum_identifiers)
        .field("prefixed_enums", &flatbuffers::IDLOptions::prefixed_enums)
        .field("scoped_enums", &flatbuffers::IDLOptions::scoped_enums)
        .field("include_dependence_headers", &flatbuffers::IDLOptions::include_dependence_headers)
        .field("mutable_buffer", &flatbuffers::IDLOptions::mutable_buffer)
        .field("one_file", &flatbuffers::IDLOptions::one_file)
        .field("proto_mode", &flatbuffers::IDLOptions::proto_mode)
        .field("proto_oneof_union", &flatbuffers::IDLOptions::proto_oneof_union)
        .field("generate_all", &flatbuffers::IDLOptions::generate_all)
        .field("skip_unexpected_fields_in_json", &flatbuffers::IDLOptions::skip_unexpected_fields_in_json)
        .field("generate_name_strings", &flatbuffers::IDLOptions::generate_name_strings)
        .field("generate_object_based_api", &flatbuffers::IDLOptions::generate_object_based_api)
        .field("gen_compare", &flatbuffers::IDLOptions::gen_compare)
        // .field("cpp_object_api_pointer_type", &flatbuffers::IDLOptions::cpp_object_api_pointer_type)
        // .field("cpp_object_api_string_type", &flatbuffers::IDLOptions::cpp_object_api_string_type)
        // .field("cpp_object_api_string_flexible_constructor", &flatbuffers::IDLOptions::cpp_object_api_string_flexible_constructor)
        .field("gen_nullable", &flatbuffers::IDLOptions::gen_nullable)
        .field("java_checkerframework", &flatbuffers::IDLOptions::java_checkerframework)
        .field("gen_generated", &flatbuffers::IDLOptions::gen_generated)
        .field("object_prefix", &flatbuffers::IDLOptions::object_prefix)
        .field("object_suffix", &flatbuffers::IDLOptions::object_suffix)
        .field("union_value_namespacing", &flatbuffers::IDLOptions::union_value_namespacing)
        .field("allow_non_utf8", &flatbuffers::IDLOptions::allow_non_utf8)
        .field("natural_utf8", &flatbuffers::IDLOptions::natural_utf8)
        .field("include_prefix", &flatbuffers::IDLOptions::include_prefix)
        .field("keep_include_path", &flatbuffers::IDLOptions::keep_include_path)
        .field("binary_schema_comments", &flatbuffers::IDLOptions::binary_schema_comments)
        .field("binary_schema_builtins", &flatbuffers::IDLOptions::binary_schema_builtins)
        .field("binary_schema_gen_embed", &flatbuffers::IDLOptions::binary_schema_gen_embed)
        .field("skip_flatbuffers_import", &flatbuffers::IDLOptions::skip_flatbuffers_import)
        // .field("go_import", &flatbuffers::IDLOptions::go_import)
        // .field("go_namespace", &flatbuffers::IDLOptions::go_namespace)
        .field("reexport_ts_modules", &flatbuffers::IDLOptions::reexport_ts_modules)
        .field("js_ts_short_names", &flatbuffers::IDLOptions::js_ts_short_names)
        .field("protobuf_ascii_alike", &flatbuffers::IDLOptions::protobuf_ascii_alike)
        .field("size_prefixed", &flatbuffers::IDLOptions::size_prefixed)
        .field("root_type", &flatbuffers::IDLOptions::root_type)
        .field("force_defaults", &flatbuffers::IDLOptions::force_defaults)
        .field("java_primitive_has_method", &flatbuffers::IDLOptions::java_primitive_has_method)
        .field("cs_gen_json_serializer", &flatbuffers::IDLOptions::cs_gen_json_serializer)
        // .field("cpp_includes", &flatbuffers::IDLOptions::cpp_includes)
        // .field("cpp_std", &flatbuffers::IDLOptions::cpp_std)
        .field("proto_namespace_suffix", &flatbuffers::IDLOptions::proto_namespace_suffix)
        .field("filename_suffix", &flatbuffers::IDLOptions::filename_suffix)
        .field("filename_extension", &flatbuffers::IDLOptions::filename_extension)
        .field("js_ts_global_prefix", &flatbuffers::IDLOptions::js_ts_global_prefix)

        .field("lang", &flatbuffers::IDLOptions::lang)
        .field("mini_reflect", &flatbuffers::IDLOptions::mini_reflect)
        .field("lang_to_generate", &flatbuffers::IDLOptions::lang_to_generate)
        .field("set_empty_strings_to_null", &flatbuffers::IDLOptions::set_empty_strings_to_null)
        .field("set_empty_vectors_to_null", &flatbuffers::IDLOptions::set_empty_vectors_to_null)
    ;

    enum_<flatbuffers::IDLOptions::Language>("Language")
        .value("kJava", flatbuffers::IDLOptions::kJava)
        .value("kCSharp", flatbuffers::IDLOptions::kCSharp)
        .value("kGo", flatbuffers::IDLOptions::kGo)
        .value("kCpp", flatbuffers::IDLOptions::kCpp)
        .value("kJs", flatbuffers::IDLOptions::kJs)
        .value("kPython", flatbuffers::IDLOptions::kPython)
        .value("kPhp", flatbuffers::IDLOptions::kPhp)
        .value("kJson", flatbuffers::IDLOptions::kJson)
        .value("kBinary", flatbuffers::IDLOptions::kBinary)
        .value("kTs", flatbuffers::IDLOptions::kTs)
        .value("kJsonSchema", flatbuffers::IDLOptions::kJsonSchema)
        .value("kDart", flatbuffers::IDLOptions::kDart)
        .value("kLua", flatbuffers::IDLOptions::kLua)
        .value("kLobster", flatbuffers::IDLOptions::kLobster)
        .value("kRust", flatbuffers::IDLOptions::kRust)
        .value("kKotlin", flatbuffers::IDLOptions::kKotlin)
        .value("kSwift", flatbuffers::IDLOptions::kSwift)
        .value("kMAX", flatbuffers::IDLOptions::kMAX)
        ;

    enum_<flatbuffers::IDLOptions::MiniReflect>("MiniReflect")
        .value("kNone", flatbuffers::IDLOptions::kNone)
        .value("kTypes", flatbuffers::IDLOptions::kTypes)
        .value("kTypesAndNames", flatbuffers::IDLOptions::kTypesAndNames)
        ;

    class_<flatbuffers::Parser>("Parser")
        .constructor<flatbuffers::IDLOptions>()
        .function("SetContentLength", &flatbuffers::Parser::SetContentLength)
        .function("ConformTo", &flatbuffers::Parser::ConformTo)
        .function("MarkGenerated", &flatbuffers::Parser::MarkGenerated)
        .function("ParseFile", optional_override([](
            flatbuffers::Parser& self,
            const std::string &filename,
            const uintptr_t &contents,
            const size_t &size,
            std::vector<uintptr_t> &include_directories_ptr
        ) {
            // https://stackoverflow.com/a/41463034
            std::vector<const char *> include_directories;
            for(auto &ptr : include_directories_ptr){
                include_directories.push_back(reinterpret_cast<const char *>(ptr));
            }

            return ParseFile(self, filename, reinterpret_cast<const char *>(contents), size, include_directories);
        }))
        .function("SetRootType", optional_override([](flatbuffers::Parser& self, const uintptr_t &root_type) {
            return self.SetRootType(reinterpret_cast<const char *>(root_type));
        }))
        .function("SchemaBinary", optional_override([](flatbuffers::Parser& self) {
            self.Serialize();
            self.file_extension_ = reflection::SchemaExtension();
        }))
        .function("GenerateJSTSCode", optional_override([](flatbuffers::Parser& self) {
            return flatbuffers::GenerateJSTSCode(self);
        }))
        .function("GetSize", optional_override([](flatbuffers::Parser& self) {
            return self.builder_.GetSize();
        }))
        .function("GetBuffer", optional_override([](flatbuffers::Parser& self) {
            unsigned char *byteBuffer = reinterpret_cast<unsigned char *>(self.builder_.GetBufferPointer());
            size_t bufferLength = self.builder_.GetSize();
            return val(typed_memory_view(bufferLength, byteBuffer));
        }))
        .function("Reset", optional_override([](flatbuffers::Parser& self) {
            self.builder_.Reset();
        }))
        .function("error_", optional_override([](flatbuffers::Parser& self) {
            return self.error_;
        }))
        ;

    value_object<ResultState>("ResultState")
        .field("message", &ResultState::message)
        .field("code", &ResultState::code)
        .field("Error", &ResultState::Error)
        ;

    function("js", optional_override([](
        const std::string &schema,
        const uintptr_t &schema_contents,
        const size_t &schema_length,
        std::vector<uintptr_t> &schema_include_directories_ptr,
        const std::string &conform,
        const uintptr_t &conform_contents,
        const size_t &conform_length,
        std::vector<uintptr_t> &conform_include_directories_ptr,
        flatbuffers::IDLOptions &opts
    ) {
        // https://stackoverflow.com/a/41463034
        std::vector<const char *> schema_include_directories;
        for(auto &ptr : schema_include_directories_ptr){
            schema_include_directories.push_back(reinterpret_cast<const char *>(ptr));
        }

        std::vector<const char *> conform_include_directories;
        for(auto &ptr : conform_include_directories_ptr){
            conform_include_directories.push_back(reinterpret_cast<const char *>(ptr));
        }

        return GenerateJSTSCode(
            schema,
            reinterpret_cast<const char *>(schema_contents),
            schema_length,
            schema_include_directories,
            conform,
            reinterpret_cast<const char *>(conform_contents),
            conform_length,
            conform_include_directories,
            opts
        );
    }));

    register_vector<uintptr_t>("vector<uintptr_t>");
    // register_vector<std::string>("vector<std::string>");
}
