import { statusCodes } from "./status-codes.js";

const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);

const $decoder = new TextDecoder();
const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

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

export const readLine = xs => xs.subarray(0, xs.indexOf(LF) + 1);

export const decodeRequest = (xs, bodyDecoder = x => x) => {
  const request = { headers: {} };
  const n = xs.byteLength;
  let i = 0;
  let seekedPassedHeader = false;
  while (i < n) {
    if (seekedPassedHeader) {
      request.body = bodyDecoder(xs.subarray(i, n));
      i = n;
      continue;
    }

    const ys = readLine(xs.subarray(i, n));

    if (i === 0) {
      if (!findIndexOfSequence(ys, encode(" HTTP/"))) break;
      const [ method, path ] = decode(ys).split(" ");
      request.method = method;
      request.path = path;
    } else if (
      ys.byteLength === 2
      && ys[0] === CR
      && ys[1] === LF
      && xs[i] === CR
      && xs[i + 1] === LF
    ) {
      seekedPassedHeader = true;
    }
    else if (ys.byteLength === 0) break;
    else {
      const [ key, value ] = decode(ys.subarray(0, ys.indexOf(CR) || ys.indexOf(LF))).split(/(?<=^[A-Za-z-]+)\s*:\s*/);
      request.headers[key.toLowerCase()] = value;
    }

    i += ys.byteLength;
  }

  return request;
};

export const concat = (...chunks) => {
  const zs = new Uint8Array(chunks.reduce((z, ys) => z + ys.byteLength, 0));
  chunks.reduce((i, xs) => zs.set(xs, i) || i + xs.byteLength, 0);
  return zs;
};

export const parseHeaders = headers => Object.entries(headers)
  .reduce(
    (accumulator, [ key, value ]) => `${accumulator}\r\n${parseHeaderKey(key)}: ${value}`,
    ""
  );

export const parseHeaderKey = key => key.replaceAll(/(?<=^|-)[a-z]/g, x => x.toUpperCase());

export const parseHTTPStatus = statusCode => statusCodes[statusCode];

export const encodeResponse = (response, bodyEncoder = x => x) =>
  concat(encode(`HTTP/1.1 ${parseHTTPStatus(response.statusCode)}${parseHeaders(response.headers)}\r\n\r\n`), bodyEncoder(response.body));
