import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";

import {
  concat,
  copy,
  decodeRequest,
  encode,
  encodeResponse,
  factorizeBuffer,
  findIndexOfSequence,
  normalizeHeaderKey,
  parseRequest,
  readAll,
  readChunk,
  stringifyResponse,
} from "./utilities.js";

Deno.test(
  "concat",
  () => {
    assertEquals(
      concat(encode("Hello"), encode("World")),
      new Uint8Array([...encode("Hello"), ...encode("World")]),
    );
  },
);

Deno.test(
  "concat: Large file chunks",
  async () => {
    const r = await Deno.open(`${Deno.cwd()}/library/assets_test/image.png`);
    const chunks = [];
    let n = 1024;

    while (n === 1024) {
      const xs = new Uint8Array(1024);
      n = await Deno.read(r.rid, xs);
      chunks.push(xs.subarray(0, n));
    }

    assertEquals(
      concat(...chunks),
      await Deno.readFile(`${Deno.cwd()}/library/assets_test/image.png`),
    );

    Deno.close(r.rid);
  },
);

Deno.test(
  "encodeResponse",
  () => {
    const body = encode(JSON.stringify({ fullName: "John Doe" }));
    const response = {
      body,
      headers: {
        ["content-type"]: "application/json",
        ["content-length"]: body.length,
      },
      statusCode: 200,
    };
    const xs = encodeResponse(response);

    assertEquals(
      xs,
      encode(
        `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 23\r\n\r\n{"fullName":"John Doe"}`,
      ),
    );
  },
);

Deno.test(
  "decodeRequest",
  () => {
    const request = decodeRequest(
      encode(`GET / HTTP/1.1\r\nHost: localhost:8080\r\nAccept: */*\r\n\r\n`),
    );

    assertEquals(request.method, "GET");
    assertEquals(request.path, "/");
    assertEquals(request.headers.host, "localhost:8080");
    assertEquals(request.headers.accept, "*/*");
  },
);

Deno.test(
  "decodeRequest: with body",
  () => {
    const body = encode(`{"fullName":"John Doe"}`);
    const request = decodeRequest(
      concat(
        encode(
          `POST /users HTTP/1.1\r\nHost: localhost:8080\r\nAccept: */*\r\n\r\n`,
        ),
        body,
      ),
    );

    assertEquals(request.method, "POST");
    assertEquals(request.path, "/users");
    assertEquals(request.headers.host, "localhost:8080");
    assertEquals(request.headers.accept, "*/*");
    assertEquals(request.body, encode(`{"fullName":"John Doe"}`));
  },
);

[
  "short-bacon.txt",
  "long-bacon.txt",
]
  .forEach((name) => {
    Deno.test(
      `factorizeBuffer (${name}): Read All`,
      async () => {
        const file = await Deno.readFile(
          `${Deno.cwd()}/library/assets_test/${name}`,
        );
        const r = await Deno.open(`${Deno.cwd()}/library/assets_test/${name}`);
        const s = factorizeBuffer(r);

        const xs = await readAll(s);

        assertEquals(xs, file);

        Deno.close(s.rid);
      },
    );

    Deno.test(
      `factorizeBuffer#.getReader (${name}): Read All`,
      async () => {
        const file = await Deno.readFile(
          `${Deno.cwd()}/library/assets_test/${name}`,
        );
        const r = await Deno.open(`${Deno.cwd()}/library/assets_test/${name}`);
        const s = factorizeBuffer(r);

        const xs = await readAll(s.getReader());

        assertEquals(xs, file);

        Deno.close(s.rid);
      },
    );

    Deno.test(
      `factorizeBuffer (${name}): Seek`,
      async () => {
        const file = await Deno.readFile(
          `${Deno.cwd()}/library/assets_test/${name}`,
        );
        const r = await Deno.open(`${Deno.cwd()}/library/assets_test/${name}`);
        const s = factorizeBuffer(r);
        const reader = s.getReader();
        const xs = await readChunk(reader, 1024);
        reader.seek(-1024);

        const ys = await readAll(s.getReader());

        assertEquals(xs, file.subarray(0, 1024), "The first chunk is missing");
        assertEquals(ys, file, "Quiet you.");

        Deno.close(s.rid);
      },
    );

    Deno.test(
      `factorizeBuffer (${name}): Copy`,
      async () => {
        const file = await Deno.open(
          `${Deno.cwd()}/library/assets_test/${name}`,
        );
        const r = await Deno.open(
          `${Deno.cwd()}/library/assets_test/copy_${name}`,
          { create: true, write: true },
        );
        const s = factorizeBuffer(r);
        const writer = s.getWriter();

        await copy(file, writer);

        writer.seek(-1024);
        await Deno.seek(file.rid, 0, Deno.SeekMode.Start);

        const xs = await readAll(writer);
        const ys = await readAll(file);

        assertEquals(
          xs,
          ys.subarray(0, Math.min(xs.byteLength || 1024)),
          "shuu",
        );

        Deno.close(file.rid);
        Deno.close(s.rid);
        await Deno.remove(`${Deno.cwd()}/library/assets_test/copy_${name}`);
      },
    );
  });

Deno.test(
  "findIndexOfSequence",
  () => {
    const i = findIndexOfSequence(encode("GET / HTTP/1.1"), encode("HTTP"));

    assertEquals(i, 6);
  },
);

Deno.test(
  "normalizeHeaderKey",
  () => {
    assertEquals(normalizeHeaderKey("link"), "Link");
    assertEquals(normalizeHeaderKey("Location"), "Location");
    assertEquals(normalizeHeaderKey("content-type"), "Content-Type");
    assertEquals(normalizeHeaderKey("cache-Control"), "Cache-Control");
  },
);

Deno.test(
  "parseRequest",
  () => {
    const request = parseRequest(
      encode(`GET / HTTP/1.1\r\nHost: localhost:8080\r\nAccept: */*\r\n\r\n`),
    );

    assertEquals(request.method, "GET");
    assertEquals(request.path, "/");
    assertEquals(request.headers.host, "localhost:8080");
    assertEquals(request.headers.accept, "*/*");
  },
);

Deno.test(
  "parseRequest: with body",
  () => {
    const request = parseRequest(
      encode(
        `POST /users HTTP/1.1\r\nHost: localhost:8080\r\nAccept: */*\r\n\r\n{"fullName":"John Doe"}`,
      ),
    );

    assertEquals(request.method, "POST");
    assertEquals(request.path, "/users");
    assertEquals(request.headers.host, "localhost:8080");
    assertEquals(request.headers.accept, "*/*");
    assertEquals(request.body, `{"fullName":"John Doe"}`);
  },
);

Deno.test(
  "stringifyResponse",
  () => {
    const body = JSON.stringify({ fullName: "John Doe" });
    const response = {
      body,
      headers: {
        ["content-type"]: "application/json",
        ["content-length"]: body.length,
      },
      statusCode: 200,
    };
    const r = stringifyResponse(response);

    assertEquals(
      r,
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 23\r\n\r\n{"fullName":"John Doe"}`,
    );
  },
);
