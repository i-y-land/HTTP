import { receiveStaticFile, serve } from "../server.js";

if (import.meta.main) {
  serve(
    Deno.listen({ port: 8080 }),
    (r) => {
      return receiveStaticFile(r, { targetPath: `${Deno.cwd()}/.upload` });
    },
  )
    .catch((e) => console.error(e));
}
