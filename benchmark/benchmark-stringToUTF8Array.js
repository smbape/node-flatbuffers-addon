const assert = require("assert");

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx;
}

function stringToUTF8ArrayNode(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    var length = HEAPBUFFER.utf8Write(str, outIdx, maxBytesToWrite);
    heap[outIdx + length] = 0;
    return length;
}

const size = 100000;
const blocks = new Array(size);
for (let i = 0; i < size; i++) {
    blocks[i] = Math.random().toString(36).slice(2);
}

const str = blocks.join("&é\"'-è_çà)=~#{[|`\\^@]}$£¤*µ!§:/;.,?<>²'");

const TOTAL_MEMORY = 16 * Math.pow(1024, 2);
const arrayByffer = new ArrayBuffer(TOTAL_MEMORY);

const byteLength = Buffer.byteLength(str.slice(0, 100000)) + 1;
const heap = new Uint8Array(arrayByffer);
const HEAPBUFFER = Buffer.from(arrayByffer);

stringToUTF8Array(str.slice(0, 100000), heap, 0, byteLength);
stringToUTF8ArrayNode(str.slice(0, 100000), heap, byteLength + 3, byteLength);
assert.strictEqual(HEAPBUFFER.slice(0, byteLength).equals(HEAPBUFFER.slice(byteLength + 3, 2 * byteLength + 3)), true);

const {Benchmark, Suite} = require("benchmark");
const suite = new Suite();
Benchmark.options.maxTime = process.env.MAX_TIME && /^\d+$/.test(process.env.MAX_TIME) ? parseInt(process.env.MAX_TIME, 10) : 5;

const outIdx = (TOTAL_MEMORY >> 1) - (Buffer.byteLength(str.slice(0, 1000000)) >> 1);

const suiteAdd = string => {
    const maxBytesToWrite = Buffer.byteLength(string) + 1;
    suite
        .add(`stringToUTF8Array     ${ string.length }`.padEnd(32, " "), () => {
            stringToUTF8Array(string, heap, outIdx, maxBytesToWrite);
        })
        .add(`stringToUTF8ArrayNode ${ string.length }`.padEnd(32, " "), () => {
            stringToUTF8ArrayNode(string, heap, outIdx, maxBytesToWrite);
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
