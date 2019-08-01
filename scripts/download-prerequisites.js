const fs = require("fs");
const sysPath = require("path");

const eachOfLimit = require("async/eachOfLimit");
const queue = require("async/queue");
const waterfall = require("async/waterfall");

const mkdirp = require("mkdirp");
const request = require("request");
const tar = require("tar");
const {diff_match_patch} = require("../patches/diff-match-patch");

const hasProp = Object.prototype.hasOwnProperty;

const diff_linesToCharsMunge_ = (lineArray, lineHash, text) => {
    const chars = [];

    // Walk the text, pulling out a substring for each line.
    // text.split('\n') would would temporarily double our memory footprint.
    // Modifying text would create many large strings to garbage collect.
    let lineStart = 0;
    let lineEnd = -1;

    // Keeping our own length variable is faster than looking it up.
    let lineArrayLength = lineArray.length;

    let line;

    while (lineEnd < text.length - 1) {
        lineEnd = text.indexOf("\n", lineStart);
        if (lineEnd === -1) {
            lineEnd = text.length - 1;
        }
        line = text.slice(lineStart, lineEnd + 1);
        lineStart = lineEnd + 1;

        if (hasProp.call(lineHash, line)) {
            chars.push(String.fromCharCode(lineHash[line]));
        } else {
            chars.push(String.fromCharCode(lineArrayLength));
            lineHash[line] = lineArrayLength;
            lineArray[lineArrayLength++] = line;
        }
    }

    return chars.join("");
};

const applyPatch = (dmp, file, cwd, patch, done) => {
    const filepath = sysPath.join(cwd, file);

    fs.readFile(filepath, (err, original) => {
        if (err) {
            done(err);
            return;
        }

        const lineArray = []; // e.g. lineArray[4] == 'Hello\n'
        const lineHash = {}; // e.g. lineHash['Hello\n'] == 4

        // '\x00' is a valid character, but various debuggers don't like it.
        // So we'll insert a junk entry to avoid generating a null character.
        lineArray[0] = "";
        const paddingLength = dmp.Patch_Margin;
        for (let x = 1; x <= paddingLength; x++) {
            lineArray[x] = "";
        }

        const patchList = dmp.patch_fromText(patch);

        const patchLines = [];
        patchList.forEach(({diffs}) => {
            diffs.forEach(diff => {
                patchLines.push(diff[1]);
            });
        });

        original = diff_linesToCharsMunge_(lineArray, lineHash, original.toString());
        diff_linesToCharsMunge_(lineArray, lineHash, `${ patchLines.join("\n") }\n`);

        patchList.forEach(({diffs}) => {
            diffs.forEach(diff => {
                diff[1] = String.fromCharCode(lineHash[`${ diff[1] }\n`]);
            });
        });

        const result = dmp.patch_apply(patchList, original);

        const text = [];
        let i;
        for (i = 0; i < result[0].length; i++) {
            text[i] = lineArray[result[0].charCodeAt(i)];
        }
        result[0] = text.join("");

        const [patched, [applied]] = result;

        if (!applied) {
            // console.log(`Error while patching '${ file }'`);
            done();
            return;
        }

        console.log("patching file", file);
        fs.writeFile(filepath, patched, done);
    });
};

const patchFromBuffer = (dmp, tokenizer, q, cwd, patchfile, options, buffer, len, eof) => {
    let match, file, left, right, lines1, lines2, lf, start, end, tmp, lastEnd, i, j;

    let lastIndex = -1;

    tokenizer.lastIndex = 0;

    // eslint-disable-next-line no-cond-assign
    while (match = tokenizer.exec(buffer)) {
        if (lastIndex === tokenizer.lastIndex) {
            break;
        }

        lastIndex = tokenizer.lastIndex;

        if (match.index >= len) {
            break;
        }
        [, tmp, left, right, lf] = match;

        if (tmp && options.strip) {
            i = options.strip;
            j = -1;
            while (i-- > 0) {
                j = tmp.indexOf("/", j + 1);
            }
            tmp = tmp.slice(j + 1);
        }

        if (tmp && match[0].startsWith("--- ")) {
            if (file) {
                lastEnd = end + 1;
                q.push({
                    fn: applyPatch,
                    args: [dmp, file, cwd, buffer.slice(start, end).toString().replace(/%/g, "%25")]
                });
                start = undefined;
                end = undefined;
                lines1 = undefined;
                lines2 = undefined;
            }
            file = tmp;
        }

        if (left) {
            if (start == null) {
                start = match.index;
            }
            lines1 = parseInt(left, 10);
            lines2 = parseInt(right, 10);
        }

        if (lf) {
            if (lines1 >= 0 && (lf === " " || lf === "-")) {
                lines1--;
            }

            if (lines2 >= 0 && (lf === " " || lf === "+")) {
                lines2--;
            }

            if (lf === "\n" && lines1 === 0 && lines2 === 0) {
                lines1--;
                lines2--;
                end = match.index + 1;
            }
        }
    }

    if (eof) {
        if (start) {
            q.push({
                fn: applyPatch,
                args: [dmp, file, cwd, buffer.slice(start, end).toString().replace(/%/g, "%25")]
            });
        }
    } else if (lastEnd) {
        buffer.copy(buffer, 0, lastEnd);
        len = buffer.length - lastEnd + 1;
        buffer.fill("\0", len, buffer.length, "binary");
    }

    return len;
};

const patch = (dmp, tokenizer, q, cwd, patchfile, options, done) => {
    let len = 0;
    let buffer = Buffer.alloc(0);
    const readable = fs.createReadStream(patchfile);

    readable.on("data", chunk => {
        if (len + chunk.length <= buffer.length) {
            chunk.copy(buffer, len);
            len += chunk.length;
        } else {
            buffer = Buffer.concat([buffer.slice(0, len), chunk]);
            len = buffer.length;
        }

        len = patchFromBuffer(dmp, tokenizer, q, cwd, patchfile, options, buffer, len);
    });

    readable.on("close", () => {
        patchFromBuffer(dmp, tokenizer, q, cwd, patchfile, options, buffer, len, true);
        q.push(null, done);
    });
};

const version = "1.11.0";
const cwd = sysPath.resolve(__dirname, "../deps/flatbuffers");

const dmp = new diff_match_patch();
dmp.Patch_Margin = 3;
dmp.Match_Threshold = 0;
dmp.Match_Distance = -100;
dmp.noPatchPadding = true;

const tokenizer = /(?:(?:^(?:---|\+\+\+) ([^\r\n]+))|(?:^@@ -\d+,(\d+) \+\d+,(\d+) @@)|(^[- +]|\n)|$)/mg;

const q = queue((task, next) => {
    if (task == null) {
        next();
        return;
    }

    const {fn, args} = task;

    fn(...args.concat([next]));
});

q.error((err, task) => {
    throw err;
});

waterfall([
    mkdirp.bind(mkdirp, cwd),

    (performed, next) => {
        if (!performed) {
            next(null, performed);
            return;
        }

        request(`https://github.com/google/flatbuffers/archive/v${ version }.tar.gz`).pipe(tar.x({
            strip: 1,
            C: cwd
        })).on("close", () => {
            next(null, performed);
        }).on("error", next);
    },

    (performed, next) => {
        if (!performed) {
            next();
            return;
        }

        eachOfLimit([
            sysPath.resolve(__dirname, "../patches/fix-numeric_limits-to-avoid-conflict-with-windows.h-header.patch"),
            sysPath.resolve(__dirname, "../patches/flatbuffers-1.11.x-add_buffer_parsing.patch"),
        ], 1, (file, i, next) => {
            patch(dmp, tokenizer, q, cwd, file, {
                strip: 1
            }, next);
        }, next);
    }
], err => {
    if (err) {
        throw err;
    }
});
