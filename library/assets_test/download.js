import { sendStaticFile, serve } from "../server.js";

if (import.meta.main) {
  serve(
    Deno.listen({ port: 8080 }),
    (r) => {
      return sendStaticFile(r, { sourcePath: Deno.cwd() });
    },
  )
    .catch((e) => console.error(e));
}
