const assert = require("assert");

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

const c_str = str => {
    const len = Buffer.byteLength(str, "utf8");
    const buffer = Buffer.allocUnsafe(len + 1);
    buffer.write(str, "utf8");
    buffer[len] = 0;
    return new Uint8Array(buffer);
};

var isTypedArray = typeof BigInt64Array === "function" ? function(obj) {
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

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
    } else {
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
    }
    return str;
}

function UTF8ArrayToStringNode(u8Array, idx, maxBytesToRead, buffer, HEAPBUFFER) {
  var buf = isTypedArray(u8Array) ? u8Array.buffer === buffer ? HEAPBUFFER : Buffer.from(u8Array.buffer) : Buffer.from(u8Array);
  buf = buf.slice(idx, maxBytesToRead > 0 && idx + maxBytesToRead < buf.length ? idx + maxBytesToRead : buf.length);
  var endPtr = buf.indexOf(0);
  return buf.toString(undefined, 0, endPtr === -1 ? buf.length : endPtr);
}

const size = 100000;
const blocks = new Array(size);
for (let i = 0; i < size; i++) {
    blocks[i] = Math.random().toString(36).slice(2);
}

const str = blocks.join("&é\"'-è_çà)=~#{[|`\\^@]}$£¤*µ!§:/;.,?<>²'");

assert.strictEqual(UTF8ArrayToString(c_str(str), 0), str);
assert.strictEqual(UTF8ArrayToStringNode(c_str(str), 0), str);

const benchmark = require("benchmark");
const suite = new benchmark.Suite();

const suiteAdd = string => {
    const c_string = c_str(string);
    const u8ArrayBuffer = Buffer.from(c_string.buffer);
    suite
        .add(`UTF8ArrayToString     ${ string.length }`.padEnd(32, " "), () => {
            UTF8ArrayToString(c_string, 0, Number.POSITIVE_INFINITY, c_string.buffer, u8ArrayBuffer);
        })
        .add(`UTF8ArrayToStringNode ${ string.length }`.padEnd(32, " "), () => {
            UTF8ArrayToStringNode(c_string, 0, Number.POSITIVE_INFINITY, c_string.buffer, u8ArrayBuffer);
        });
};

for (let i = 1, string; i <= 5; i++) {
    suiteAdd(str.slice(0, 10 * i));
}

for (let i = 2, string; i <= 6; i++) {
    suiteAdd(str.slice(0, Math.pow(10, i)));
}

suite
    .on("cycle", event => {
        console.log(String(event.target));
    })
    .on("complete", function() {
        // eslint-disable-next-line no-invalid-this
        console.log(`Fastest is ${ this.filter("fastest").map("name").toString().trim() }`);
    })
    .run({
        async: true
    });
