import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { concat, findIndexOfSequence, decodeRequest, encodeResponse, parseHeaderKey } from "./utilities.js";

const $decoder = new TextDecoder();
const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

Deno.test(
  "concat",
  () => {
    assertEquals(
      concat(encode("Hello"), encode("World")),
      new Uint8Array([ ...encode("Hello"), ...encode("World") ])
    );
  }
);

Deno.test(
  "findIndexOfSequence",
  () => {
    let i = findIndexOfSequence(encode("GET / HTTP/1.1"), encode("HTTP"));

    assertEquals(i, 6);
  }
);

Deno.test(
  "decodeRequest",
  () => {
    const xs = encode(`GET / HTTP/1.1\nHost: localhost:8080\nUser-Agent: test\nAccept: */*\r\n\r\n`);
    const request = decodeRequest(xs);

    assertEquals(
      request,
      {
        headers: {
          accept: "*/*",
          host: "localhost:8080",
          ["user-agent"]: "test"
        },
        method: "GET",
        path: "/"
      }
    );
  }
);

Deno.test(
  "decodeRequest: body",
  () => {
    const xs = encode(`POST /users HTTP/1.1\nHost: localhost:8080\nUser-Agent: test\nAccept: */*\nContent-Type: application/json\nContent-Length: 23\r\n\r\n{"fullName":"John Doe"}`);
    const request = decodeRequest(xs);

    assertEquals(
      request,
      {
        body: encode(JSON.stringify({fullName: "John Doe"})),
        headers: {
          accept: "*/*",
          ["content-length"]: "23",
          ["content-type"]: "application/json",
          host: "localhost:8080",
          ["user-agent"]: "test"
        },
        method: "POST",
        path: "/users"
      }
    );
  }
);

Deno.test(
  "encodeResponse",
  () => {
    // `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${request.body.length}\r\n\r\n${request.body}`
    const xs = encode(JSON.stringify({ fullName: "John Doe" }));
    const response = {
      body: xs,
      headers: {
        ["content-type"]: "application/json",
        ["content-length"]: xs.byteLength,
      },
      statusCode: 200
    };
    const ys = encodeResponse(response);

    assertEquals(
      ys,
      encode(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 23\r\n\r\n{"fullName":"John Doe"}`),
    )
  }
);

Deno.test(
  "parseHeaderKey",
  () => {
    assertEquals(parseHeaderKey("link"), "Link");
    assertEquals(parseHeaderKey("Location"), "Location");
    assertEquals(parseHeaderKey("content-type"), "Content-Type");
    assertEquals(parseHeaderKey("cache-Control"), "Cache-Control");
  }
);
