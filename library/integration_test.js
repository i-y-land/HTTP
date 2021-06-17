import { assert, assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { decodeRequest } from "./utilities.js";

const p = await Deno.run({
  cmd: [ "deno", "run", "--allow-all", `${Deno.cwd()}/library/assets_test/generate-assets.js` ],
  stdout: "null"
});

const { success } = await p.status();

assert(success, "Failed to generate asset request files");

const withStaticServer = (port, f) => async () => {
  const p = await Deno.run({
    cmd: [ "deno", "run", "--allow-all", `${Deno.cwd()}/cli.js`, String(port) ],
    cwd: `${Deno.cwd()}/library/assets_test/`,
    env: { LOG_LEVEL: "ERROR", "NO_COLOR": "1" },
    stdout: "null"
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    await f(p);
  } finally {
    Deno.close(p.rid);
  }
};

Deno.test(
  "Integration: Download - 01 Short Text",
  withStaticServer(
    8080,
    async () => {
      const { headers, method, path } = decodeRequest(await Deno.readFile(`${Deno.cwd()}/library/assets_test/01_short-text.http`));
      const response = await fetch(path, { method, headers });

      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/plain");
      assertEquals(await response.text(), await Deno.readTextFile(`${Deno.cwd()}/library/assets_test/short-bacon.txt`));
    }
  )
);

Deno.test(
  "Integration: Download - 02 Long Text",
  withStaticServer(
    8080,
    async () => {
      const { headers, method, path } = decodeRequest(await Deno.readFile(`${Deno.cwd()}/library/assets_test/02_long-text.http`));
      const response = await fetch(path, { method, headers });

      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/plain");
      assertEquals(await response.text(), await Deno.readTextFile(`${Deno.cwd()}/library/assets_test/long-bacon.txt`));
    }
  )
);

Deno.test(
  "Integration: Download - 03 Image",
  withStaticServer(
    8080,
    async () => {
      const { headers, method, path } = decodeRequest(await Deno.readFile(`${Deno.cwd()}/library/assets_test/03_image.http`));
      const response = await fetch(path, { method, headers });

      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "image/png,image/x-citrix-png,image/x-png");
      assertEquals(new Uint8Array(await response.arrayBuffer()), await Deno.readFile(`${Deno.cwd()}/library/assets_test/image.png`));
    }
  )
);

Deno.test(
  "Integration: Download - 04 Music",
  withStaticServer(
    8080,
    async () => {
      const { headers, method, path } = decodeRequest(await Deno.readFile(`${Deno.cwd()}/library/assets_test/04_music.http`));
      const response = await fetch(path, { method, headers });

      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "audio/mpeg");
      assertEquals(new Uint8Array(await response.arrayBuffer()), await Deno.readFile(`${Deno.cwd()}/library/assets_test/music.mp3`));
    }
  )
);
