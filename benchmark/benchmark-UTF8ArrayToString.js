const assert = require("assert");

const UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

const c_str = str => {
    const len = Buffer.byteLength(str, "utf8");
    const buffer = Buffer.allocUnsafe(len + 1);
    buffer.write(str, "utf8");
    buffer[len] = 0;
    return new Uint8Array(buffer);
};

const isTypedArray = typeof BigInt64Array === "function" ? function(obj) {
    return (obj instanceof Int8Array) ||
        (obj instanceof Uint8Array) ||
        (obj instanceof Uint8ClampedArray) ||
        (obj instanceof Int16Array) ||
        (obj instanceof Uint16Array) ||
        (obj instanceof Int32Array) ||
        (obj instanceof Uint32Array) ||
        (obj instanceof Float32Array) ||
        (obj instanceof Float64Array) ||
        (obj instanceof BigInt64Array) ||
        (obj instanceof BigUint64Array);
} : function(obj) {
    return (obj instanceof Int8Array) ||
        (obj instanceof Uint8Array) ||
        (obj instanceof Uint8ClampedArray) ||
        (obj instanceof Int16Array) ||
        (obj instanceof Uint16Array) ||
        (obj instanceof Int32Array) ||
        (obj instanceof Uint32Array) ||
        (obj instanceof Float32Array) ||
        (obj instanceof Float64Array);
};

function UTF8ArrayToStringUTF8DecoderLoop(u8Array, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
}

function UTF8ArrayToStringUTF8DecoderIndexOf(u8Array, idx, maxBytesToRead) {
    var endIdx = maxBytesToRead > 0 && idx + maxBytesToRead < u8Array.length ? idx + maxBytesToRead : u8Array.length;
    var subarray = u8Array.subarray(idx, endIdx);
    var endPtr = subarray.indexOf(0);
    return UTF8Decoder.decode(endPtr === -1 ? subarray : subarray.subarray(0, endPtr));
}

function UTF8ArrayToStringUTF8DecoderKnown(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
    var endPtr = idx + HEAPBUFFER.length - 1;
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
}

function UTF8ArrayToStringFromCharCode(u8Array, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    var str = "";
    while (idx < endPtr) {
        var u0 = u8Array[idx++];
        if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
        }
        var u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
        }
        var u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
        } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
        }
        if (u0 < 65536) {
            str += String.fromCharCode(u0);
        } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        }
    }
    return str;
}

function UTF8ArrayToStringFromCharCodeKnown(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
    var endPtr = idx + HEAPBUFFER.length - 1;
    var str = "";
    while (idx < endPtr) {
        var u0 = u8Array[idx++];
        if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
        }
        var u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
        }
        var u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
        } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
        }
        if (u0 < 65536) {
            str += String.fromCharCode(u0);
        } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        }
    }
    return str;
}

function UTF8ArrayToStringBufferLoop(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    var buf = isTypedArray(u8Array) ? u8Array.buffer === buffer ? HEAPBUFFER : Buffer.from(u8Array.buffer) : Buffer.from(u8Array);
    return buf.toString("utf8", idx, endPtr);
}

function UTF8ArrayToStringBufferIndexOf(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
    var buf = isTypedArray(u8Array) ? u8Array.buffer === buffer ? HEAPBUFFER : Buffer.from(u8Array.buffer) : Buffer.from(u8Array);
    var endIdx = maxBytesToRead > 0 && idx + maxBytesToRead < buf.length ? idx + maxBytesToRead : buf.length;
    buf = buf.slice(idx, endIdx);
    var endPtr = buf.indexOf(0);
    return buf.toString("utf8", 0, endPtr === -1 ? buf.length : endPtr);
}

function UTF8ArrayToStringBufferKnown(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
    var endPtr = idx + HEAPBUFFER.length - 1;
    return HEAPBUFFER.toString("utf8", idx, endPtr);
}

const size = 100000;
const blocks = new Array(size);
for (let i = 0; i < size; i++) {
    blocks[i] = Math.random().toString(36).slice(2);
}

const str = blocks.join("&é\"'-è_çà)=~#{[|`\\^@]}$£¤*µ!§:/;.,?<>²'");

const functions = [
    UTF8ArrayToStringUTF8DecoderLoop,
    UTF8ArrayToStringUTF8DecoderIndexOf,
    UTF8ArrayToStringUTF8DecoderKnown,
    UTF8ArrayToStringFromCharCode,
    UTF8ArrayToStringFromCharCodeKnown,
    UTF8ArrayToStringBufferLoop,
    UTF8ArrayToStringBufferIndexOf,
    UTF8ArrayToStringBufferKnown,
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
    const c_string = c_str(str);
    const u8ArrayBuffer = Buffer.from(c_string.buffer);
    assert.strictEqual(fn(c_string, 0, Number.POSITIVE_INFINITY, c_string.buffer, u8ArrayBuffer), str);
});

const {Benchmark, Suite} = require("benchmark");
const suite = new Suite();

Benchmark.options.maxTime = process.env.MAX_TIME && /^\d+$/.test(process.env.MAX_TIME) ? parseInt(process.env.MAX_TIME, 10) : 5;

const suiteAdd = string => {
    const c_string = c_str(string);
    const u8ArrayBuffer = Buffer.from(c_string.buffer);

    functions.forEach(fn => {
        const {name} = fn;
        suite.add(name.padEnd(longestName, " ") + " " + String(length).padEnd(8, " "), () => {
            fn(c_string, 0, Number.POSITIVE_INFINITY, c_string.buffer, u8ArrayBuffer);
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
