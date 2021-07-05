import { mimeTypes } from "./mime-types.js";
import {
  copy,
  decodeRequest,
  encode,
  encodeResponse,
  findIndexOfSequence,
  readChunk,
} from "./utilities.js";

const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
const CRLF = new Uint8Array([CR, LF, CR, LF]);

export const receiveStaticFile = async (
  connection,
  { maximumSize = 1024 * 1024 * 100, targetPath },
) => {
  let xs = await readChunk(connection, 1024);
  const request = decodeRequest(xs);

  // 100MB
  if (Number(request.headers["content-length"]) > maximumSize) {
    await connection.write(
      encodeResponse({ statusCode: 413 }),
    );
    return;
  }

  const { fileName } = request.path.match(
    /.*?\/(?<fileName>(?:[^%]|%[0-9A-Fa-f]{2})+\.[A-Za-z0-9]+?)$/,
  )?.groups || {};

  if (!fileName) {
    await connection.write(
      encodeResponse({
        headers: {
          "Content-Length": 0,
        },
        statusCode: 400,
      }),
    );
    return;
  }

  const file = await Deno.open(`${targetPath}/${fileName}`, {
    create: true,
    write: true,
  });

  if (request.headers.expect === "100-continue") {
    await connection.write(encodeResponse({ statusCode: 100 }));

    xs = await readChunk(connection, 1024);
  }

  const i = findIndexOfSequence(xs, CRLF);

  if (i > 0) {
    await Deno.write(file.rid, xs.subarray(i + 4));
    if (xs.byteLength === 1024) {
      await copy(connection, file);
    }
  }

  await connection.write(
    encodeResponse({ statusCode: 204 }),
  );
};

export const sendStaticFile = async (connection, { sourcePath }) => {
  const xs = await readChunk(connection, 1024);
  const request = decodeRequest(xs);

  const { fileName } = request.path.match(
    /.*?\/(?<fileName>(?:[^%]|%[0-9A-Fa-f]{2})+\.[A-Za-z0-9]+?)$/,
  )?.groups || {};

  if (!fileName) {
    await connection.write(
      encodeResponse({
        headers: {
          ["Content-Length"]: 0,
        },
        statusCode: 400,
      }),
    );
    return;
  }

  try {
    const { size } = await Deno.stat(`${sourcePath}/${fileName}`);

    await connection.write(
      encodeResponse({
        headers: {
          ["Content-Type"]: mimeTypes[
            fileName.match(/(?<extension>\.[a-z0-9]+$)/)?.groups?.extension
              .toLowerCase()
          ].join(",") || "plain/text",
          ["Content-Length"]: size,
        },
        statusCode: 200,
      }),
    );

    if (request.method === "GET") {
      const file = await Deno.open(`${sourcePath}/${fileName}`);
      await copy(file, connection);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      await connection.write(
        encodeResponse({
          headers: {
            ["Content-Length"]: 0,
            "x-test": "test",
          },
          statusCode: 404,
        }),
      );
      return;
    }

    throw e;
  }
};

export const serve = async (listener, f) => {
  for await (const connection of listener) {
    try {
      await f(connection);
    } catch (e) {
      try {
        console.error(e);
        await Deno.write(
          connection.rid,
          encodeResponse({
            body: encode(`Error: ${e.message}`),
            headers: {
              ["Content-Type"]: "text/plain",
              ["Content-Length"]: 7 + e.message.length,
            },
            statusCode: 500,
          }),
        );
      } catch (e) {
        await Deno.write(
          Deno.stdout.rid,
          encode(
            `\x1b[31mFailed to write to the connection because of an error: ${e.message}\x1b[0m\r\n`,
          ),
        );
      }
    } finally {
      connection.close();
    }
  }
};
