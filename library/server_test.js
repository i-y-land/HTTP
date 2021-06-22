import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { decode, encode, parseRequest } from "./utilities.js";
import { serve } from "./server.js";

const factorizeConnectionMock = (p) => {
  let i = 0;

  return {
    p,
    rid: p.rid,
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (i > 0) {
            return Promise.resolve({ done: true });
          }
          i++;
          return Promise.resolve({ value: p, done: false });
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
      async (ys) => {
        const request = parseRequest(ys);

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

        const body = JSON.stringify({ "fullName": "John Doe" });

        return encode(
          `HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${body.length}\r\n\r\n${body}`,
        );
      },
    );

    await Deno.seek(r.rid, 0, Deno.SeekMode.Start);

    const zs = new Uint8Array(1024);
    const n = await Deno.read(r.rid, zs);

    assertEquals(
      decode(zs.subarray(0, n)),
      `HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: 23\r\n\r\n{"fullName":"John Doe"}`,
    );

    Deno.remove(`${Deno.cwd()}/.buffer`);
    Deno.close(r.rid);
  },
);
