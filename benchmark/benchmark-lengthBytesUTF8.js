const assert = require("assert");

function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        }
        if (u <= 127) {
            ++len;
        } else if (u <= 2047) {
            len += 2;
        } else if (u <= 65535) {
            len += 3;
        } else {
            len += 4;
        }
    }
    return len;
}

function byteLength(str) {
    return Buffer.byteLength(str);
}

const size = 100000;
const blocks = new Array(size);
for (let i = 0; i < size; i++) {
    blocks[i] = Math.random().toString(36).slice(2);
}

const str = blocks.join("&é\"'-è_çà)=~#{[|`\\^@]}$£¤*µ!§:/;.,?<>²'");

const functions = [
    lengthBytesUTF8,
    byteLength,
];

const fnLen = functions.length;
const lastFnName = functions[fnLen - 1].name;
const longestName = (() => {
    let max = 0;
    functions.forEach(({name}) => {
        if (max < name.length) {
            max = name.length;
        }
    });
    return max;
})();

// check functions before benchmarking
functions.forEach(fn => {
    assert.strictEqual(fn(str), Buffer.byteLength(str));
});

const {Benchmark, Suite} = require("benchmark");
const suite = new Suite();

Benchmark.options.maxTime = process.env.MAX_TIME && /^\d+$/.test(process.env.MAX_TIME) ? parseInt(process.env.MAX_TIME, 10) : 5;

const suiteAdd = string => {
    const length = string.length;

    functions.forEach(fn => {
        const {name} = fn;
        suite.add(name.padEnd(longestName, " ") + " " + String(length).padEnd(8, " "), () => {
            fn(string);
        });
    });
};

for (let i = 10; i < 50; i += 10) {
    suiteAdd(str.slice(0, i));
}

for (let i = 50; i < 300; i += 50) {
    suiteAdd(str.slice(0, i));
}

for (let i = 300; i < 1000; i += 100) {
    suiteAdd(str.slice(0, i));
}

for (let i = 3; i <= 6; i++) {
    suiteAdd(str.slice(0, Math.pow(10, i)));
}

let i = 0;

suite
    .on("cycle", function(event) {
        i++;
        console.log(String(event.target));
        const name = event.target.name.replace(/\s*\d+\s*$/, "");
        if (name === lastFnName) {
            const fastest = Array.prototype.slice.call(this, i - fnLen, i).filter(bench => {
                return bench.cycles && typeof bench.hz === "number" && isFinite(bench.hz) && !bench.error;
            }).sort(({stats: a}, {stats: b}) => {
                return a.mean + a.moe > b.mean + b.moe ? 1 : -1;
            }).filter((bench, i, arr) => {
                return i === 0 || arr[0].compare(bench) === 0;
            });

            console.log(`${ "Fastest is".padEnd(longestName, " ") } ${ " ".repeat(8) } ${ fastest.map(({name}) => name.replace(/\s*\d+\s*$/, "")) }\n`);
        }
    })
    .on("complete", function() {
        // eslint-disable-next-line no-invalid-this
        // console.log(`Fastest is ${ this.filter("fastest").map("name").toString().trim() }`);
    })
    .run({
        async: true
    });
