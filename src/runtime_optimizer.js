function isTypedArray(obj) {
  return (obj instanceof Int8Array) ||
    (obj instanceof Uint8Array) ||
    (obj instanceof Uint8ClampedArray) ||
    (obj instanceof Int16Array) ||
    (obj instanceof Uint16Array) ||
    (obj instanceof Int32Array) ||
    (obj instanceof Uint32Array) ||
    (obj instanceof Float32Array) ||
    (obj instanceof Float64Array) ||
    (typeof BigInt64Array === "function" && obj instanceof BigInt64Array) ||
    (typeof BigUint64Array === "function" && obj instanceof BigUint64Array);
}

if (ENVIRONMENT_IS_NODE) {
    function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
        var buf = Buffer.from(isTypedArray(u8Array) ? u8Array.buffer : u8Array);
        var buffer = buf.slice(idx, maxBytesToRead && idx + maxBytesToRead < buf.length ? idx + maxBytesToRead : buf.length);
        var endPtr = buffer.indexOf(0);
        return buffer.toString("utf8", 0, endPtr === -1 ? buffer.length : endPtr);
    }
}
