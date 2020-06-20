#!/bin/bash

#Absolute path to this script
SCRIPT=$(readlink -f "$0")
#Absolute path this script is in
SCRIPTPATH=$(dirname "$SCRIPT")

# faster version of uname on cygwin like shells
while read -r line; do
    MACHINE_KERNEL="${line%% *}"
    break
done < /proc/version

case "$MACHINE_KERNEL" in
  CYGWIN* | MINGW* | MSYS* )
    # We are running a new console, therefore, this is no more an MSYSTEM
    MSYSTEM='' cmd.exe /c "$(cygpath -w "${SCRIPTPATH}/embind.bat")"
    exit $?
    ;;
esac

die() {
    local msg="${1}"
    local code=${2:-1}
    echo "$msg" 1>&2
    exit $code
}

cd "${SCRIPTPATH}/.."

ROOT_DIR="$PWD"
WORK_DIR="$ROOT_DIR/.work"
repodir=emsdk

if [ ! -d "${WORK_DIR}/${repodir}" ]; then
    mkdir -p "${WORK_DIR}/${repodir}"
    cd "${WORK_DIR}/${repodir}"
    git init
    git remote add origin https://github.com/emscripten-core/emsdk.git
    git fetch origin
    git checkout master
fi

test -f "${WORK_DIR}/${repodir}/emsdk_env.sh" || die 'Failed to clone emscripten-core' $?

cd "${WORK_DIR}/${repodir}"

# Activate PATH and other environment variables in the current terminal
source ./emsdk_env.sh

CMAKE_TOOLCHAIN_FILE="${EMSDK}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"

command -v emcc &>/dev/null && emcc -v &>/dev/null
if [ $? -ne 0 ]; then
    # Download and install the latest SDK tools.
    ./emsdk install latest || die 'Failed to install latest emsdk' $?

    # Make the "latest" SDK "active" for the current user. (writes ~/.emscripten file)
    ./emsdk activate --embedded latest || die 'Failed to activate latest emsdk' $?

    # Activate PATH and other environment variables in the current terminal
    source ./emsdk_env.sh
fi

if [ ! -d "${EMSDK}/upstream/emscripten/.git" ]; then
    cd "${EMSDK}/upstream/emscripten"
    git init
    git remote add origin https://github.com/emscripten-core/emscripten.git
    git fetch origin master --depth 1
    git clean -xdf
    git checkout master
    git apply -v "${ROOT_DIR}/patches/emscripten-optimze-nodejs-env.patch" || die 'Failed to patch emscripten' $?
else
    git pull || die 'Failed to pull emscripten' $?
fi

if [ ! -d "${EMSDK}/upstream/emscripten/node_modules" ]; then
    cd "${EMSDK}/upstream/emscripten"
    npm ci --production || die 'Failed to install npm modules' $?
fi

mkdir -p "${WORK_DIR}/flatbuffers" && \
cd "${WORK_DIR}/flatbuffers" && \
cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_EMBIND=ON -DCMAKE_TOOLCHAIN_FILE="${CMAKE_TOOLCHAIN_FILE}" "${ROOT_DIR}" && \
cmake --build . || die 'Failed to build.'

cp -f "${WORK_DIR}/flatbuffers/flatbuffers_addon_"* "$ROOT_DIR/lib/"
