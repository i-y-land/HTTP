import { mimeTypes } from "./mime-types.js";
import { concat, decodeRequest, encodeResponse } from "./utilities.js";

const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

export const serveStatic = async xs => {
  const request = decodeRequest(xs);
  if (request.method !== "GET") return Promise.reject(new Error(`The static server can only respond to GET request. Got ${request.method}.`));

  try {
    const ys = await Deno.readFile(Deno.cwd() + request.path);

    return encodeResponse({
      body: ys,
      headers: {
        ["Content-Type"]: mimeTypes[request.path.match(/(?<extension>\.[a-z0-9]+$)/)?.groups?.extension.toLowerCase()].join(",") || "plain/text",
        ["Content-Length"]: ys.byteLength
      },
      statusCode: 200
    });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound)
      return encodeResponse({
        body: new Uint8Array(0),
        headers: {
          ["Content-Length"]: 0
        },
        statusCode: 404
      });

    throw e;
  }
};

export const serve = async (listener, f) => {
  for await (const connection of listener) {
    const chunks = [];
    let n = 1024;

    while (n === 1024) {
      let xs = new Uint8Array(1024);
      n = await Deno.read(connection.rid, xs);
      chunks.push((n < 1024) ? xs.subarray(0, n) : xs);
    }

    try {
      const ys = await f(concat(...chunks));

      if (!ys || !ys.byteLength) throw new Error(`The Request handler function should return a TypedArray, got ${typeof ys}.`);

      let i = 0;
      while (i < ys.byteLength) {
        await Deno.write(connection.rid, ys.subarray(i, i += 1024));
      }
    } catch (e) {
      try {
        await Deno.write(
          connection.rid,
          encodeResponse({
            body: encode(`Error: ${e.message}`),
            headers: {
              ["Content-Type"]: "text/plain",
              ["Content-Length"]: 7 + e.message.length,
            },
            statusCode: 500
          })
        );
      } catch (e) {
        await Deno.write(Deno.stdout.rid, encode("\x1b[31mFailed to write to the connection\x1b[0m\r\n"));
      }
    }
  }
};
