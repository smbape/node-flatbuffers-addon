const fs = require("fs");
const path = require("path");
const concat = require("async/concat");
const waterfall = require("async/waterfall");

const check = cb => {
    waterfall([
        next => {
            concat([
                path.resolve(__dirname, "../prebuilds/linux-x64/node.napi.node"),
                path.resolve(__dirname, "../prebuilds/win32-x64/node.napi.node"),
                path.resolve(__dirname, "../package.json"),
            ], fs.stat, next);
        },

        ([{mtime: linux}, {mtime: win32}, {mtime: pkg}], next) => {
            next(linux < pkg || win32 < pkg ? new Error("prebuilds should be regenerated") : null);
        }
    ], cb);
};

module.exports = check;

if (process.argv[1] === __filename) {
    check(err => {
        if (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
