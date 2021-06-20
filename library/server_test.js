import { assert, assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { concat, decodeRequest, findIndexOfSequence } from "./utilities.js";
import { serve } from "./server.js";

const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);

const $decoder = new TextDecoder();
const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);


const factorizeConnectionMock = async p => {
  let i = 0;

  return {
    p,
    rid: p.rid,
    [Symbol.asyncIterator]() {

      return {
        async next() {
          if (i > 0) {

            return Promise.resolve({ done: true });
          }
          i++;
          return Promise.resolve({ value: p, done: false });
        },
        values: null
      }
    }
  };
};

Deno.test(
  "serve",
  async () => {
    const r = await Deno.open(`${Deno.cwd()}/.buffer`, { create: true, read: true, write: true });

    const xs = await Deno.readFile(`${Deno.cwd()}/library/assets_test/image.png`);
    const ys = concat(
      encode(`GET / HTTP/1.1\r\nContent-Type: image/png\r\nContent-Length: ${xs.byteLength}\r\n\r\n`),
      xs
    );

    await Deno.write(r.rid, ys);

    await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

    const connectionMock = await factorizeConnectionMock(r);

    await serve(
      connectionMock,
      async zs => {
        const request = decodeRequest(zs);

        assertEquals(
          request.method,
          "GET",
          `The request method was expected to be \`GET\`. Got \`${request.method}\``
        );
        assertEquals(
          request.path,
          "/",
          `The request path was expected to be \`/\`. Got \`${request.path}\``
        );
        assertEquals(
          request.headers["content-length"],
          String(xs.byteLength),
          `The request content length was expected to be \`${zs.byteLength}\`. Got \`${request["content-length"]}\``
        );
        assertEquals(request.headers["content-type"], "image/png");

        await Deno.ftruncate(r.rid, 0);
        await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

        return concat(
          encode(`HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${xs.byteLength}\r\n\r\n`),
          zs
        );
      }
    );

    await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

    const zs = new Uint8Array(1024);
    const n = await Deno.read(r.rid, zs);

    // The file would be larger than a KB, so the Array should be filled.
    assertEquals(n, 1024, `The handler might have thrown: ${decode(zs)}`);
    assertEquals(
      decode(zs.subarray(0, findIndexOfSequence(zs, new Uint8Array([ CR, LF, CR, LF ])) + 4)),
      `HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${xs.byteLength}\r\n\r\n`
    );

    Deno.remove(`${Deno.cwd()}/.buffer`);
    Deno.close(r.rid);
  }
);
