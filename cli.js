import {
  decode,
  encodeResponse,
  factorizeBuffer,
  readLine,
} from "./library/utilities.js";
import { receiveStaticFile, sendStaticFile, serve } from "./library/server.js";

if (import.meta.main) {
  const port = Number(Deno.args[0]) || 8080;
  const sourcePath =
    (await Deno.permissions.query({ name: "env", variable: "SOURCE_PATH" }))
      .state === "granted" && Deno.env.get("SOURCE_PATH") ||
    `${Deno.cwd()}/library/assets_test`;
  const targetPath =
    (await Deno.permissions.query({ name: "env", variable: "TARGET_PATH" }))
      .state === "granted" && Deno.env.get("TARGET_PATH") ||
    `${Deno.cwd()}/library/assets_test`;
  serve(
    Deno.listen({ port }),
    async (connection) => {
      const r = factorizeBuffer(connection);

      const xs = new Uint8Array(1024);
      const reader = r.getReader();
      await reader.peek(xs);
      const [ method ] = decode(readLine(xs)).split(" ");

      if (method !== "GET" && method !== "POST" && method !== "HEAD") {
        return connection.write(
          encodeResponse({ statusCode: 400 }),
        );
      }

      if (method === "POST") {
        return receiveStaticFile(r, { targetPath });
      } else {
        return sendStaticFile(r, { sourcePath });
      }
    },
  )
    .catch((e) => console.error(e));
}
