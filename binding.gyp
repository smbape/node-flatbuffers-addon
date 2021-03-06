{
  "targets": [{
    "target_name": "addon",
    "include_dirs" : [
      "src",
      "deps/flatbuffers/include",
      "deps/flatbuffers/grpc"
    ],
    "sources": [
      "deps/flatbuffers/include/flatbuffers/code_generators.h",
      "deps/flatbuffers/include/flatbuffers/base.h",
      "deps/flatbuffers/include/flatbuffers/flatbuffers.h",
      "deps/flatbuffers/include/flatbuffers/hash.h",
      "deps/flatbuffers/include/flatbuffers/idl.h",
      "deps/flatbuffers/include/flatbuffers/util.h",
      "deps/flatbuffers/include/flatbuffers/reflection.h",
      "deps/flatbuffers/include/flatbuffers/reflection_generated.h",
      "deps/flatbuffers/include/flatbuffers/stl_emulation.h",
      "deps/flatbuffers/include/flatbuffers/flexbuffers.h",
      # "deps/flatbuffers/include/flatbuffers/registry.h",
      # "deps/flatbuffers/include/flatbuffers/minireflect.h",
      "deps/flatbuffers/src/code_generators.cpp",
      "deps/flatbuffers/src/idl_parser.cpp",
      # "deps/flatbuffers/src/idl_gen_text.cpp",
      # "deps/flatbuffers/src/reflection.cpp",
      "deps/flatbuffers/src/util.cpp",
      # "deps/flatbuffers/src/idl_gen_cpp.cpp",
      # "deps/flatbuffers/src/idl_gen_dart.cpp",
      # "deps/flatbuffers/src/idl_gen_general.cpp",
      # "deps/flatbuffers/src/idl_gen_go.cpp",
      "deps/flatbuffers/src/idl_gen_js_ts.cpp",
      # "deps/flatbuffers/src/idl_gen_php.cpp",
      # "deps/flatbuffers/src/idl_gen_python.cpp",
      # "deps/flatbuffers/src/idl_gen_lobster.cpp",
      # "deps/flatbuffers/src/idl_gen_lua.cpp",
      # "deps/flatbuffers/src/idl_gen_rust.cpp",
      # "deps/flatbuffers/src/idl_gen_fbs.cpp",
      # "deps/flatbuffers/src/idl_gen_grpc.cpp",
      # "deps/flatbuffers/src/idl_gen_json_schema.cpp",
      # "deps/flatbuffers/src/flatc.cpp",
      # "deps/flatbuffers/src/flatc_main.cpp",
      # "deps/flatbuffers/grpc/src/compiler/schema_interface.h",
      # "deps/flatbuffers/grpc/src/compiler/cpp_generator.h",
      # "deps/flatbuffers/grpc/src/compiler/cpp_generator.cc",
      # "deps/flatbuffers/grpc/src/compiler/go_generator.h",
      # "deps/flatbuffers/grpc/src/compiler/go_generator.cc",
      # "deps/flatbuffers/grpc/src/compiler/java_generator.h",
      # "deps/flatbuffers/grpc/src/compiler/java_generator.cc",
      "src/index.cpp"
    ],

    # Visual Studio pedantic build settings
    # warning C4512: assignment operator could not be generated
    # warning C4316: object allocated on the heap may not be aligned
    "msvs_disabled_warnings": [4512, 4316],

    "msvs_settings": {
      "VCCLCompilerTool": {
        "WarnAsError": "true", # /WX
        "WarningLevel": 4 # /W4
      }
    },
    "cflags_cc": ["-pedantic", "-Werror", "-Wold-style-cast"],
    "conditions": [
      ["OS=='mac'", {
        "cflags_cc": ["-std=c++11", "-stdlib=libc++"],
      }, {
        # Certain platforms such as ARM do not use signed chars by default
        # which causes issues with certain bounds checks.
        "cflags_cc": ["-std=c++0x", "-fsigned-char"],
      }],
      ["clang==1 and OS!='linux'", {
        "cflags_cc": ["-stdlib=libc++"],
      }],
      ["clang==1 and OS!='linux' and OS!='freebsd'", {
        "cflags_cc": ["-lc++abi"],
      }]
    ],
  }]
}