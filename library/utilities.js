import { statusCodes } from "./status-codes.js";

const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);

const $decoder = new TextDecoder();
export const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
export const encode = $encoder.encode.bind($encoder);

export const factorizeBuffer = (r, mk = 1024, ml = 1024) => {
  if (r.r && r.rid) return r;

  let i = 0; // bytes read so far
  let k = 0, l = 0; // bytes read to buffer so far
  let p = 0, q = 0; // position within the buffer
  const readerBuffer = new Uint8Array(mk), writeBuffer = new Uint8Array(ml);

  const read = async (xs) => {
    let byteRead = 0;

    if (p < k && k !== 0) {
      const ys = readerBuffer.subarray(p, k);
      xs.set(ys, 0);
      p += ys.byteLength;
      k = Math.min(mk, k + p);
      byteRead = ys.byteLength;
      if (byteRead < mk) {
        return byteRead;
      }
    }

    if (byteRead === xs.byteLength) {
      return byteRead;
    }

    const ys = new Uint8Array(xs.byteLength - byteRead);
    const n = await Deno.read(r.rid, ys);

    if (!n) return byteRead;

    xs.set(ys, byteRead);
    i += n;
    byteRead += n;

    const z = Math.max(0, p - n);
    if (p === k && k !== 0) {
      readerBuffer.set(readerBuffer.subarray(n), z);
      readerBuffer.set(ys.subarray(0, n), Math.min(z + n, mk - n));
    } else {
      readerBuffer.set(ys.subarray(0, n), p);
    }
    k = Math.min(mk, k + n);
    p = Math.min(k, p + n);

    return byteRead;
  };

  const write = async (xs) => {
    await Deno.write(r.rid, xs);
    if (l < ml) {
      const ys = xs.subarray(0, Math.min(xs.byteLength, ml - l));
      writeBuffer.set(ys, l);
      l = Math.min(l + ys.byteLength, ml);
      q = Math.min(l, q + ys.byteLength);
    }
  };

  return {
    r,
    rid: r.rid,
    getReader() {
      return {
        async peek(xs) {
          this.seek(-(xs.byteLength));
          const n = await this.read(xs);
          this.seek(-(xs.byteLength));
          return n;
        },
        seek(n) {
          p = Math.max(0, p + n);
        },
        read,
      };
    },
    getWriter() {
      return {
        async peek(xs) {
          this.seek(-(xs.byteLength));
          const n = await this.read(xs);
          this.seek(-(xs.byteLength));
          return n;
        },
        seek(n) {
          q = Math.max(0, q + n);
        },
        read(xs) {
          if (q === ml) return null;
          const ys = writeBuffer.subarray(0, Math.min(l, xs.byteLength));
          xs.set(ys, 0);
          q = Math.min(ml, q + ys.byteLength);

          return Promise.resolve(ys.byteLength);
        },
        write,
      };
    },
    read,
    write,
  };
};

export const concat = (...chunks) => {
  const zs = new Uint8Array(chunks.reduce((z, ys) => z + ys.byteLength, 0));
  chunks.reduce((i, xs) => zs.set(xs, i) || i + xs.byteLength, 0);
  return zs;
};

export const copy = async (r, w) => {
  const xs = new Uint8Array(1024);
  let n;
  let i = 0;
  do {
    n = await r.read(xs);
    await w.write(xs.subarray(0, n));
    i += n;
  } while (n === 1024);

  return i;
};

export const findIndexOfSequence = (xs, ys) => {
  let i = xs.indexOf(ys[0]);
  let z = false;

  while (i >= 0 && i < xs.byteLength) {
    let j = 0;
    while (j < ys.byteLength) {
      if (xs[j + i] !== ys[j]) break;
      j++;
    }
    if (j === ys.byteLength) {
      z = true;
      break;
    }
    i++;
  }

  return z ? i : null;
};

export const readLine = (xs) => xs.subarray(0, xs.indexOf(LF) + 1);

export const normalizeHeaderKey = (key) =>
  key.replaceAll(/(?<=^|-)[a-z]/g, (x) => x.toUpperCase());

export const parseRequest = (xs) => {
  const request = decode(xs);
  const [h, body] = request.split("\r\n\r\n");
  const [requestLine, ...ls] = h.split("\r\n");
  const [method, path] = requestLine.split(" ");
  const headers = ls
    .map((l) => l.split(": "))
    .reduce(
      (hs, [key, value]) =>
        Object.defineProperty(
          hs,
          key.toLowerCase(),
          { enumerable: true, value, writable: false },
        ),
      {},
    );

  return { method, path, headers, body };
};

export const readAll = async (r) => {
  const chunks = [];
  let n;
  do {
    const xs = new Uint8Array(1024);
    n = await r.read(xs);
    chunks.push(xs.subarray(0, n));
  } while (n === 1024);

  return concat(...chunks);
};

export const readChunk = async (r, l) => {
  const xs = new Uint8Array(l);
  const n = await r.read(xs);

  return xs.subarray(0, n);
};

export const stringifyHeaders = (headers = {}) =>
  Object.entries(headers)
    .reduce(
      (hs, [key, value]) => `${hs}\r\n${normalizeHeaderKey(key)}: ${value}`,
      "",
    );

export const stringifyResponse = (response) =>
  `HTTP/1.1 ${statusCodes[response.statusCode]}${
    stringifyHeaders(response.headers)
  }\r\n\r\n${response.body || ""}`;

export const decodeRequest = (xs) => {
  const headers = {};
  let body, method, path;
  const n = xs.byteLength;
  let i = 0;
  let seekedPassedHeader = false;
  while (i < n) {
    if (seekedPassedHeader) {
      body = xs.subarray(i, n);
      i = n;
      continue;
    }

    const ys = readLine(xs.subarray(i, n));

    if (i === 0) {
      if (!findIndexOfSequence(ys, encode(" HTTP/"))) break;
      [method, path] = decode(ys).split(" ");
    } else if (
      ys.byteLength === 2 &&
      ys[0] === CR &&
      ys[1] === LF &&
      xs[i] === CR &&
      xs[i + 1] === LF
    ) {
      seekedPassedHeader = true;
    } else if (ys.byteLength === 0) break;
    else {
      const [key, value] = decode(
        ys.subarray(0, ys.indexOf(CR) || ys.indexOf(LF)),
      ).split(/(?<=^[A-Za-z-]+)\s*:\s*/);
      headers[key.toLowerCase()] = value;
    }

    i += ys.byteLength;
  }

  return { body, headers, method, path };
};

export const encodeResponse = (response) =>
  concat(
    encode(
      `HTTP/1.1 ${statusCodes[response.statusCode]}${
        stringifyHeaders(response.headers)
      }\r\n\r\n`,
    ),
    response.body || new Uint8Array(0),
  );
