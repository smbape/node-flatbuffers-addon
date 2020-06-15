@ECHO OFF

@SETLOCAL EnableExtensions
@SETLOCAL EnableDelayedExpansion

@CD /D "%~dp0.."

@SET ROOT_DIR=%CD%
@SET WORK_DIR=%CD%\.work

@IF NOT EXIST "%WORK_DIR%\emsdk-win" (
    @MKDIR "%WORK_DIR%\emsdk-win"
    @CD /D "%WORK_DIR%\emsdk-win"
    @ATTRIB +h "%WORK_DIR%"
    @CALL git clone --depth 1 https://github.com/emscripten-core/emsdk.git .
)

@IF NOT EXIST "%WORK_DIR%\emsdk-win\emsdk_env.bat" @ECHO "Failed to clone emscripten-core" 2>&1 & EXIT /B !ERRORLEVEL!

@CD /D "%WORK_DIR%\emsdk-win"

@CALL emsdk_env.bat

@SET CMAKE_TOOLCHAIN_FILE=%EMSDK%\upstream\emscripten\cmake\Modules\Platform\Emscripten.cmake

@IF NOT EXIST "%CMAKE_TOOLCHAIN_FILE%" (
    @CALL emsdk install latest || @ECHO "Failed installing latest emsdk" 2>&1 & EXIT /B !ERRORLEVEL!
    @CALL emsdk activate --embedded latest || @ECHO "Failed to activate latest emsdk" 2>&1 & EXIT /B !ERRORLEVEL!
)

@IF NOT EXIST "%EMSDK%\mingw\7.1.0_64bit\bin\mingw32-make.exe" (
    @CALL emsdk install mingw-7.1.0-64bit || @ECHO "Failed to install mingw-7.1.0-64bit" 2>&1 & EXIT /B !ERRORLEVEL!
    @CALL emsdk activate --embedded mingw-7.1.0-64bit || @ECHO "Failed to activate mingw-7.1.0-64bit" 2>&1 & EXIT /B !ERRORLEVEL!
)

@IF NOT EXIST "%WORK_DIR%\flatbuffers" (
    @MKDIR "%WORK_DIR%\flatbuffers" || @ECHO "Failed to create '%WORK_DIR%\flatbuffers'" 2>&1 & EXIT /B !ERRORLEVEL!
)

@IF NOT EXIST "%EMSDK%\upstream\emscripten\.git" (
    @CD /D "%EMSDK%\upstream\emscripten"
    @CALL git init
    @CALL git remote add origin https://github.com/emscripten-core/emscripten.git
    @CALL git fetch origin master --depth 1
    @CALL git clean -xdf
    @CALL git checkout master
    @CALL git apply -v "%ROOT_DIR%\patches\emscripten-optimze-nodejs-env.patch" || @ECHO "Failed to patch emscripten" 2>&1 & EXIT /B !ERRORLEVEL!
) ELSE (
    @CALL git pull || @ECHO "Failed to pull emscripten" 2>&1 & EXIT /B !ERRORLEVEL!
)

@IF NOT EXIST "%EMSDK%\upstream\emscripten\node_modules" (
    @CD /D "%EMSDK%\upstream\emscripten"
    @CALL npm ci --production || @ECHO "Failed to install npm modules" 2>&1 & EXIT /B !ERRORLEVEL!
)

@CD /D "%WORK_DIR%\flatbuffers"

@CALL cmake -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release -DBUILD_EMBIND=ON "-DCMAKE_TOOLCHAIN_FILE=%CMAKE_TOOLCHAIN_FILE%" "%ROOT_DIR%" || @ECHO "Failed to create MinGW Makefiles" 2>&1 & EXIT /B !ERRORLEVEL!
@CALL cmake --build . || @ECHO "Failed to build" 2>&1 & EXIT /B !ERRORLEVEL!

@CALL ROBOCOPY /TBD /NS /NC /NFL /NDL /NP /NJH /NJS "%WORK_DIR%\flatbuffers" "%ROOT_DIR%\lib" flatbuffers_addon_*
@IF %ERRORLEVEL% EQU 16 @ECHO "Failed to copy generated files to lib: ***FATAL ERROR***" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 15 @ECHO "Failed to copy generated files to lib: OKCOPY + FAIL + MISMATCHES + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 14 @ECHO "Failed to copy generated files to lib: FAIL + MISMATCHES + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 13 @ECHO "Failed to copy generated files to lib: OKCOPY + FAIL + MISMATCHES" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 12 @ECHO "Failed to copy generated files to lib: FAIL + MISMATCHE" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 11 @ECHO "Failed to copy generated files to lib: OKCOPY + FAIL + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 10 @ECHO "Failed to copy generated files to lib: FAIL + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 9  @ECHO "Failed to copy generated files to lib: OKCOPY + FAIL" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 8  @ECHO "Failed to copy generated files to lib: FAIL" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 7  @ECHO "Failed to copy generated files to lib: OKCOPY + MISMATCHES + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 6  @ECHO "Failed to copy generated files to lib: MISMATCHES + XTRA" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 5  @ECHO "Failed to copy generated files to lib: OKCOPY + MISMATCHES" 2>&1 & EXIT /B %ERRORLEVEL%
@IF %ERRORLEVEL% EQU 4  @ECHO "Failed to copy generated files to lib: MISMATCHES" 2>&1 & EXIT /B %ERRORLEVEL%
