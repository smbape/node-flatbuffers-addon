cmake_minimum_required(VERSION 2.8)

# Name of the project (will be the name of the plugin)
project(flatbuffers_addon)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE "Release")
  # set(CMAKE_BUILD_TYPE "Release" CACHE STRING "Build type: Debug, RelWithDebInfo, Release, MinSizeRel" FORCE)
endif()

add_definitions(-DNODE_GYP_MODULE_NAME=${PROJECT_NAME})

set(FlatBuffers_Library_SRCS
  deps/flatbuffers/include/flatbuffers/code_generators.h
  deps/flatbuffers/include/flatbuffers/base.h
  deps/flatbuffers/include/flatbuffers/flatbuffers.h
  deps/flatbuffers/include/flatbuffers/hash.h
  deps/flatbuffers/include/flatbuffers/idl.h
  deps/flatbuffers/include/flatbuffers/util.h
  deps/flatbuffers/include/flatbuffers/reflection.h
  deps/flatbuffers/include/flatbuffers/reflection_generated.h
  deps/flatbuffers/include/flatbuffers/stl_emulation.h
  deps/flatbuffers/include/flatbuffers/flexbuffers.h
  # deps/flatbuffers/include/flatbuffers/registry.h
  # deps/flatbuffers/include/flatbuffers/minireflect.h
  deps/flatbuffers/src/code_generators.cpp
  deps/flatbuffers/src/idl_parser.cpp
  # deps/flatbuffers/src/idl_gen_text.cpp
  # deps/flatbuffers/src/reflection.cpp
  deps/flatbuffers/src/util.cpp
)

set(FlatBuffers_Compiler_SRCS
  ${FlatBuffers_Library_SRCS}
  # deps/flatbuffers/src/idl_gen_cpp.cpp
  # deps/flatbuffers/src/idl_gen_dart.cpp
  # deps/flatbuffers/src/idl_gen_general.cpp
  # deps/flatbuffers/src/idl_gen_go.cpp
  deps/flatbuffers/src/idl_gen_js_ts.cpp
  # deps/flatbuffers/src/idl_gen_php.cpp
  # deps/flatbuffers/src/idl_gen_python.cpp
  # deps/flatbuffers/src/idl_gen_lobster.cpp
  # deps/flatbuffers/src/idl_gen_lua.cpp
  # deps/flatbuffers/src/idl_gen_rust.cpp
  # deps/flatbuffers/src/idl_gen_fbs.cpp
  # deps/flatbuffers/src/idl_gen_grpc.cpp
  # deps/flatbuffers/src/idl_gen_json_schema.cpp
  # deps/flatbuffers/src/flatc.cpp
  # deps/flatbuffers/src/flatc_main.cpp
  # deps/flatbuffers/grpc/src/compiler/schema_interface.h
  # deps/flatbuffers/grpc/src/compiler/cpp_generator.h
  # deps/flatbuffers/grpc/src/compiler/cpp_generator.cc
  # deps/flatbuffers/grpc/src/compiler/go_generator.h
  # deps/flatbuffers/grpc/src/compiler/go_generator.cc
  # deps/flatbuffers/grpc/src/compiler/java_generator.h
  # deps/flatbuffers/grpc/src/compiler/java_generator.cc
)

set(SOURCE_FILES
  ${FlatBuffers_Compiler_SRCS}
  src/index.cpp
)

set(EMSOURCE_FILES
  ${FlatBuffers_Compiler_SRCS}
  src/embind.cpp
)

if(EXISTS "${CMAKE_TOOLCHAIN_FILE}" AND NOT BUILD_EMBIND)
  # do not apply any global settings if the toolchain
  # is being configured externally
  message(STATUS "Using toolchain file: ${CMAKE_TOOLCHAIN_FILE}.")
elseif("${CMAKE_GENERATOR}" MATCHES "^Visual Studio.*")
  # Visual Studio pedantic build settings
  # warning C4512: assignment operator could not be generated
  # warning C4316: object allocated on the heap may not be aligned
  # warning C4100: unreferenced formal parameter
  # warning C4251: identifier' : class 'type' needs to have dll-interface to be used by clients of class 'type2'
  # warning C4267: var' : conversion from 'size_t' to 'type', possible loss of data
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /WX /wd4512 /wd4316")
elseif(APPLE)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11 -stdlib=libc++")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -pedantic -Werror -Wextra -Wno-unused-parameter")
  set(FLATBUFFERS_PRIVATE_CXX_FLAGS "-Wold-style-cast")
elseif(CMAKE_COMPILER_IS_GNUCXX)
  if(CYGWIN)
    set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -std=gnu++11")
  else(CYGWIN)
    set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -std=c++0x")
  endif(CYGWIN)
  set(CMAKE_CXX_FLAGS
    "${CMAKE_CXX_FLAGS} -Wall -pedantic -Werror -Wextra -Werror=shadow")
  set(FLATBUFFERS_PRIVATE_CXX_FLAGS "-Wold-style-cast")
  if (CMAKE_CXX_COMPILER_VERSION VERSION_GREATER 4.4)
    if (CMAKE_CXX_COMPILER_VERSION VERSION_GREATER 7.0)
      set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -faligned-new -Werror=implicit-fallthrough=2")
    endif()
    set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -Wunused-result -Werror=unused-result -Wunused-parameter -Werror=unused-parameter")
  endif()

  # Certain platforms such as ARM do not use signed chars by default
  # which causes issues with certain bounds checks.
  set(CMAKE_CXX_FLAGS
    "${CMAKE_CXX_FLAGS} -fsigned-char")

elseif(${CMAKE_CXX_COMPILER_ID} MATCHES "Clang")
  set(CMAKE_CXX_FLAGS
      "${CMAKE_CXX_FLAGS} -std=c++0x -Wall -pedantic -Werror -Wextra -Wno-unused-parameter")
  set(FLATBUFFERS_PRIVATE_CXX_FLAGS "-Wold-style-cast")
  if(NOT CMAKE_CXX_COMPILER_VERSION VERSION_LESS 3.8)
    list(APPEND FLATBUFFERS_PRIVATE_CXX_FLAGS "-Wimplicit-fallthrough" "-Wextra-semi" "-Werror=unused-private-field") # enable warning
  endif()
  if(FLATBUFFERS_LIBCXX_WITH_CLANG)
  if(NOT "${CMAKE_SYSTEM_NAME}" MATCHES "Linux")
    set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -stdlib=libc++")
  endif()
  if(NOT ("${CMAKE_SYSTEM_NAME}" MATCHES "FreeBSD" OR
          "${CMAKE_SYSTEM_NAME}" MATCHES "Linux"))
    set(CMAKE_EXE_LINKER_FLAGS
        "${CMAKE_EXE_LINKER_FLAGS} -lc++abi")
  endif()
  endif()

  # Certain platforms such as ARM do not use signed chars by default
  # which causes issues with certain bounds checks.
  set(CMAKE_CXX_FLAGS
    "${CMAKE_CXX_FLAGS} -fsigned-char")
elseif(MSVC)
  # Visual Studio pedantic build settings
  # warning C4512: assignment operator could not be generated
  # warning C4316: object allocated on the heap may not be aligned
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /WX /wd4512 /wd4316")
endif()

include_directories(src)
include_directories(deps/flatbuffers/include)
# include_directories(deps/flatbuffers/grpc)

if(BUILD_EMBIND)
  # set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wno-gnu-zero-variadic-macro-arguments")
  # set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s VERBOSE=1")

  if (CMAKE_BUILD_TYPE STREQUAL Debug)
    set(LINK_FLAGS "-s DISABLE_EXCEPTION_THROWING=0 -s DEMANGLE_SUPPORT=1")
  else() # Either MinSizeRel, RelWithDebInfo or Release, all which run with optimizations enabled.
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions -s DISABLE_EXCEPTION_THROWING=1")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-rtti -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -flto")
    set(LINK_FLAGS "-s ERROR_ON_UNDEFINED_SYMBOLS=0")
  endif()

  set(CMAKE_C_FLAGS_RELEASE "-DNDEBUG -O3")
  set(CMAKE_C_FLAGS_RELWITHDEBINFO "-O3")
  set(CMAKE_CXX_FLAGS_RELEASE "-DNDEBUG -O3")
  set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "-O3")

  set(CMAKE_EXE_LINKER_FLAGS_RELEASE "-O3")
  set(CMAKE_EXE_LINKER_FLAGS_RELWITHDEBINFO "-O3 -g")
  set(CMAKE_SHARED_LINKER_FLAGS_RELEASE "-O3")
  set(CMAKE_SHARED_LINKER_FLAGS_RELWITHDEBINFO "-O3 -g")
  set(CMAKE_MODULE_LINKER_FLAGS_RELEASE "-O3")
  set(CMAKE_MODULE_LINKER_FLAGS_RELWITHDEBINFO "-O3 -g")

  set(LINK_FLAGS "${LINK_FLAGS} --bind --no-entry -s STRICT=1")
  set(LINK_FLAGS "${LINK_FLAGS} -s INVOKE_RUN=0 -s ALLOW_MEMORY_GROWTH=1")
  set(LINK_FLAGS "${LINK_FLAGS} -s NODERAWFS=1 -lnodefs.js -lnoderawfs.js")
  set(LINK_FLAGS "${LINK_FLAGS} -s EXTRA_EXPORTED_RUNTIME_METHODS=\"['stackSave', 'stackAlloc', 'stackRestore', 'writeArrayToMemory']\"")

  add_executable("${PROJECT_NAME}_wasm" ${EMSOURCE_FILES})
  set_target_properties("${PROJECT_NAME}_wasm" PROPERTIES LINK_FLAGS  "${LINK_FLAGS} -s WASM=1")
  # target_compile_definitions("${PROJECT_NAME}_wasm" PUBLIC NODERAWFS)

  add_executable("${PROJECT_NAME}_asmjs" ${EMSOURCE_FILES})
  set_target_properties("${PROJECT_NAME}_asmjs" PROPERTIES LINK_FLAGS "${LINK_FLAGS} -s WASM=0 -s LEGACY_VM_SUPPORT=1")
  # target_compile_definitions("${PROJECT_NAME}_asmjs" PUBLIC NODERAWFS)

else()
  # Build a shared library named after the project from the files in `src/`
  add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES})

  # Gives our library file a .node extension without any "lib" prefix
  set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

  # Essential include files to build a node addon,
  # You should add this line in every CMake.js based project
  target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})

  # Essential library files to link to a node addon
  # You should add this line in every CMake.js based project
  target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
endif()
