const fs = require("fs");
const sysPath = require("path");
const anyspawn = require("anyspawn");
const mkdirp = require("mkdirp");

const cwd = sysPath.resolve(__dirname, "../deps");
const version = "1.9.0";

anyspawn.spawnSeries([
    mkdirp.bind(null, cwd),

    next => {
        fs.access(sysPath.join(cwd, "flatbuffers"), err => {
            let cmd, ccwd;
            if (err) {
                cmd = [`git clone --depth 1 --branch v${ version } https://github.com/google/flatbuffers.git`];
                ccwd = cwd;
            } else {
                cmd = [
                    "git clean -xdf",
                    "git reset --hard HEAD",
                    `git fetch origin v${ version } --update-shallow`,
                    `git checkout v${ version }`,
                ];
                ccwd = sysPath.join(cwd, "flatbuffers");
            }

            anyspawn.spawnSeries(cmd, {
                cwd: ccwd,
                prompt: true,
                stdio: "inherit"
            }, next);
        });
    },

    ["git", ["apply", "-v", sysPath.resolve(__dirname, "../patches/flatbuffers-1.9.x-add_buffer_parsing.patch")], {
        cwd: sysPath.join(cwd, "flatbuffers"),
        prompt: true,
        stdio: "inherit"
    }]
]);
