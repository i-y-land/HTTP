import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import {
  decode,
  decodeRequest,
  encode,
  encodeResponse,
  readAll,
} from "./utilities.js";
import { serve } from "./server.js";

const factorizeConnectionMock = (r) => {
  let i = 0;

  return {
    r,
    rid: r.rid,
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (i > 0) {
            return Promise.resolve({ done: true });
          }
          i++;
          return Promise.resolve({ value: r, done: false });
        },
        values: null,
      };
    },
  };
};

Deno.test(
  "serve",
  async () => {
    const r = await Deno.open(`${Deno.cwd()}/.buffer`, {
      create: true,
      read: true,
      write: true,
    });

    const xs = encode(`GET /users/1 HTTP/1.1\r\nAccept: */*\r\n\r\n`);

    await Deno.write(r.rid, xs);

    await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

    const connectionMock = await factorizeConnectionMock(r);

    await serve(
      connectionMock,
      async (r) => {
        const request = decodeRequest(await readAll(r));

        assertEquals(
          request.method,
          "GET",
          `The request method was expected to be \`GET\`. Got \`${request.method}\``,
        );
        assertEquals(
          request.path,
          "/users/1",
          `The request path was expected to be \`/users/1\`. Got \`${request.path}\``,
        );
        assertEquals(
          request.headers.accept,
          "*/*",
        );

        await Deno.ftruncate(r.rid, 0);
        await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

        await r.write(
          encodeResponse({
            body: encode(JSON.stringify({ "fullName": "John Doe" })),
            headers: {
              "content-length": 23,
              "content-type": "application/json",
            },
            statusCode: 200,
          }),
        );
      },
    );

    const s = await Deno.open(`${Deno.cwd()}/.buffer`, { read: true });

    const zs = new Uint8Array(1024);
    const n = await Deno.read(s.rid, zs);

    assertEquals(
      decode(zs.subarray(0, n)),
      `HTTP/1.1 200 OK\r\nContent-Length: 23\r\nContent-Type: application/json\r\n\r\n{"fullName":"John Doe"}`,
    );

    Deno.close(s.rid);
    await Deno.remove(`${Deno.cwd()}/.buffer`);
  },
);
