
import { serve } from "./library/server.js";
import { decodeRequest, encodeResponse } from "./library/utilities.js";

const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

if (import.meta.main) {
  const port = Number(Deno.args[0]) || 8080;
  serve(
    Deno.listen({ port }),
    (xs) => {
      const { method, path } = decodeRequest(xs);

      if (method === "GET" && path === "/")
        return encodeResponse({
          body: encode("Hello, World"),
          headers: {
            "Content-Length": 12,
            "Content-Type": "text/plain"
          },
          statusCode: 200
        });

      return encodeResponse({
        body: new Uint8Array(0),
        headers: {
          "Content-Length": 0
        },
        statusCode: 404
      });
    }
  )
    .catch(e => console.error(e));
}
