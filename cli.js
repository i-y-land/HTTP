import { serve } from "./library/server.js";
import {
  encode,
  parseRequest,
  stringifyResponse,
} from "./library/utilities.js";

if (import.meta.main) {
  const port = Number(Deno.args[0]) || 8080;
  serve(
    Deno.listen({ port }),
    (xs) => {
      const request = parseRequest(xs);

      if (request.method === "GET" && request.path === "/") {
        if (
          request.headers.accept.includes("*/*") ||
          request.headers.accept.includes("plain/text")
        ) {
          return Promise.resolve(
            encode(
              stringifyResponse({
                body: "Hello, World",
                headers: {
                  "content-length": 12,
                  "content-type": "text/plain",
                },
                statusCode: 200,
              }),
            ),
          );
        } else {
          return Promise.resolve(
            encode(stringifyResponse({ statusCode: 204 })),
          );
        }
      }

      return Promise.resolve(
        encode(
          stringifyResponse({
            headers: {
              "content-length": 0,
            },
            statusCode: 404,
          }),
        ),
      );
    },
  )
    .catch((e) => console.error(e));
}
