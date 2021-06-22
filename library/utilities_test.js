import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import {
  encode,
  normalizeHeaderKey,
  parseRequest,
  stringifyResponse,
} from "./utilities.js";

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
