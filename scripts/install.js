const path = require("path");
const waterfall = require("async/waterfall");
const download = require("./download-prerequisites");
const {exec, spawn} = require("child_process");
const win32 = require("os").platform() === "win32";

waterfall([
    next => {
        exec(`node-gyp-build-test${ win32 ? ".cmd" : "" }`, (err, stdout, stderr) => {
            next(null, !err);
        });
    },

    (passed, next) => {
        if (passed) {
            next(null, passed);
            return;
        }

        download(err => {
            next(err, passed);
        });
    },

    (passed, next) => {
        if (passed) {
            next();
            return;
        }

        const child = spawn(`node-gyp-build${ win32 ? ".cmd" : "" }`, {
            stdio: "inherit",
            env: Object.assign({}, process.env, {
                PATH: path.resolve(__dirname, "../node_modules/.bin") + path.delimiter + process.env.PATH
            })
        });

        child.on("error", next);
        child.on("exit", next);
    }
], err => {
    if (err) {
        if (typeof err === "number") {
            process.exit(err);
        }
        throw err;
    }
});
