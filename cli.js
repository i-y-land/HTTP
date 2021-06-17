import { serve } from "./server.js";

const $decoder = new TextDecoder();
const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

if (import.meta.main) {
  const port = Number(Deno.args[0]) || 8080;
  serve(
    Deno.listen({ port }),
    (xs) => {
      const request = decode(xs);
      const [ requestLine, ...lines ] = request.split("\r\n");
      const [ method, path ] = requestLine.split(" ");
      const separatorIndex = lines.findIndex(l => l === "");
      const headers = lines
        .slice(0, separatorIndex)
        .map(l => l.split(": "))
        .reduce(
          (hs, [ key, value ]) =>
            Object.defineProperty(
              hs,
              key.toLowerCase(),
              { enumerable: true, value, writable: false }
            ),
          {}
        );

      if (method === "GET" && path === "/") {
        if (headers.accept.includes("*/*") || headers.accept.includes("plain/text"))
          return encode(
            `HTTP/1.1 200 OK\r\nContent-Length: 12\r\nContent-Type: text/plain\r\n\r\nHello, World`
          );
        else
          return encode(
            `HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n`
          );
      }

      return encode(
        `HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n`
      );
    }
  )
    .catch(e => console.error(e));
}
