cmake_minimum_required(VERSION 2.8)

# Name of the project (will be the name of the plugin)
project(addon)

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
  deps/flatbuffers/include/flatbuffers/registry.h
  deps/flatbuffers/include/flatbuffers/minireflect.h
  deps/flatbuffers/src/code_generators.cpp
  deps/flatbuffers/src/idl_parser.cpp
  deps/flatbuffers/src/idl_gen_text.cpp
  deps/flatbuffers/src/reflection.cpp
  deps/flatbuffers/src/util.cpp
)

set(FlatBuffers_Compiler_SRCS
  ${FlatBuffers_Library_SRCS}
  deps/flatbuffers/src/idl_gen_cpp.cpp
  deps/flatbuffers/src/idl_gen_general.cpp
  deps/flatbuffers/src/idl_gen_go.cpp
  deps/flatbuffers/src/idl_gen_js.cpp
  deps/flatbuffers/src/idl_gen_php.cpp
  deps/flatbuffers/src/idl_gen_python.cpp
  deps/flatbuffers/src/idl_gen_fbs.cpp
  deps/flatbuffers/src/idl_gen_grpc.cpp
  deps/flatbuffers/src/idl_gen_json_schema.cpp
  # deps/flatbuffers/src/flatc.cpp
  # deps/flatbuffers/src/flatc_main.cpp
  deps/flatbuffers/grpc/src/compiler/schema_interface.h
  deps/flatbuffers/grpc/src/compiler/cpp_generator.h
  deps/flatbuffers/grpc/src/compiler/cpp_generator.cc
  deps/flatbuffers/grpc/src/compiler/go_generator.h
  deps/flatbuffers/grpc/src/compiler/go_generator.cc
  deps/flatbuffers/grpc/src/compiler/java_generator.h
  deps/flatbuffers/grpc/src/compiler/java_generator.cc
)

set(SOURCE_FILES
  ${FlatBuffers_Compiler_SRCS}
  src/index.cpp
)

if(EXISTS "${CMAKE_TOOLCHAIN_FILE}")
  # do not apply any global settings if the toolchain
  # is being configured externally
elseif(APPLE)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11 -stdlib=libc++")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -pedantic -Werror -Wextra -Wno-unused-parameter")
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
  if (CMAKE_CXX_COMPILER_VERSION VERSION_GREATER 4.4)
    if (CMAKE_CXX_COMPILER_VERSION VERSION_GREATER 7.0)
      set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -faligned-new")
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
  if(NOT "${CMAKE_SYSTEM_NAME}" MATCHES "Linux")
    set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -stdlib=libc++")
  endif()
  if(NOT ("${CMAKE_SYSTEM_NAME}" MATCHES "FreeBSD" OR
          "${CMAKE_SYSTEM_NAME}" MATCHES "Linux"))
    set(CMAKE_EXE_LINKER_FLAGS
        "${CMAKE_EXE_LINKER_FLAGS} -lc++abi")
  endif()

  # Certain platforms such as ARM do not use signed chars by default
  # which causes issues with certain bounds checks.
  set(CMAKE_CXX_FLAGS
    "${CMAKE_CXX_FLAGS} -fsigned-char")

elseif(MSVC)
  # Visual Studio pedantic build settings
  # warning C4512: assignment operator could not be generated
  # warning C4316: object allocated on the heap may not be aligned
  # warning C4100: unreferenced formal parameter
  # warning C4251: identifier' : class 'type' needs to have dll-interface to be used by clients of class 'type2'
  # warning C4267: var' : conversion from 'size_t' to 'type', possible loss of data
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /WX /wd4512 /wd4316 /wd4100 /wd4251 /wd4267")
endif()

include_directories(src)
include_directories(deps/flatbuffers/include)
include_directories(deps/flatbuffers/grpc)

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
