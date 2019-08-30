const sysPath = require("path");
const waterfall = require("async/waterfall");
const rimraf = require("rimraf");
waterfall([
    rimraf.bind(rimraf, sysPath.resolve(__dirname, "../build")),
    rimraf.bind(rimraf, sysPath.resolve(__dirname, "../deps/flatbuffers")),
    rimraf.bind(rimraf, sysPath.resolve(__dirname, "../.work/flatbuffers")),
], err => {
    if (err && err.code !== "ENOENT") {
        throw err;
    }
});
