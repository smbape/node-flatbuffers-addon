const {toString} = Object.prototype;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray#Syntax
const isTypedArray = obj => {
    switch(toString.call(obj)) {
        case "[object Int8Array]":
        case "[object Uint8Array]":
        case "[object Uint8ClampedArray]":
        case "[object Int16Array]":
        case "[object Uint16Array]":
        case "[object Int32Array]":
        case "[object Uint32Array]":
        case "[object Float32Array]":
        case "[object Float64Array]":
        case "[object BigInt64Array]":
        case "[object BigUint64Array]":
            return true;
        default:
            return false;
    }
};

const isTypedArrayInstance = typeof BigInt64Array === "function" ? obj => {
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
} : obj => {
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

const bestCase = new Int8Array(8);
const worstCase = new BigUint64Array(8);

const benchmark = require("benchmark");
const suite = new benchmark.Suite();

suite
    .add("isTypedArrayInstance best case", () => {
        isTypedArrayInstance(bestCase);
    })
    .add("isTypedArrayInstance worst case", () => {
        isTypedArrayInstance(worstCase);
    })
    .add("isTypedArray", () => {
        isTypedArray(worstCase);
    })
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
