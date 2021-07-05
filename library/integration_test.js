import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";

const withDownloadServer = (port, f) =>
  async () => {
    const p = await Deno.run({
      cmd: [
        "deno",
        "run",
        "--allow-all",
        `${Deno.cwd()}/library/assets_test/download.js`,
        String(port),
      ],
      cwd: `${Deno.cwd()}/library/assets_test/`,
      env: { LOG_LEVEL: "ERROR", "NO_COLOR": "1" },
      stdout: "null",
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      await f(p);
    } finally {
      Deno.close(p.rid);
    }
  };

const withUploadServer = (port, f) =>
  async () => {
    await Deno.mkdir(`${Deno.cwd()}/library/assets_test/.upload`);
    const p = await Deno.run({
      cmd: [
        "deno",
        "run",
        "--allow-all",
        `${Deno.cwd()}/library/assets_test/upload.js`,
        String(port),
      ],
      cwd: `${Deno.cwd()}/library/assets_test/`,
      env: { LOG_LEVEL: "ERROR", "NO_COLOR": "1" },
      stdout: "null",
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      await f(p);
    } finally {
      await Deno.remove(`${Deno.cwd()}/library/assets_test/.upload`, {
        recursive: true,
      });
      Deno.close(p.rid);
    }
  };

[
  {
    path: "/short-bacon.txt",
    title: "Short Text",
    f: async (response) => {
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/plain");
      assertEquals(response.headers.get("Content-Length"), "533");
      assertEquals(
        await response.text(),
        await Deno.readTextFile(
          `${Deno.cwd()}/library/assets_test/short-bacon.txt`,
        ),
      );
    },
  },
  {
    method: "HEAD",
    path: "/short-bacon.txt",
    title: "(HEAD) Short Text",
    f: async (response) => {
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/plain");
      assertEquals(response.headers.get("Content-Length"), "533");
      assertEquals(await response.text(), "");
    },
  },
  {
    path: "/long-bacon.txt",
    title: "Long Text",
    f: async (response) => {
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "text/plain");
      assertEquals(response.headers.get("Content-Length"), "43546");
      assertEquals(
        await response.text(),
        await Deno.readTextFile(
          `${Deno.cwd()}/library/assets_test/long-bacon.txt`,
        ),
      );
    },
  },
  {
    path: "/image.png",
    title: "Image",
    f: async (response) => {
      assertEquals(response.status, 200);
      assertEquals(
        response.headers.get("Content-Type"),
        "image/png,image/x-citrix-png,image/x-png",
      );
      assertEquals(response.headers.get("Content-Length"), "87650");
      assertEquals(
        new Uint8Array(await response.arrayBuffer()),
        await Deno.readFile(
          `${Deno.cwd()}/library/assets_test/image.png`,
        ),
      );
    },
  },
  {
    path: "/music.mp3",
    title: "Music",
    f: async (response) => {
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("Content-Type"), "audio/mpeg");
      assertEquals(response.headers.get("Content-Length"), "8309515");
      assertEquals(
        new Uint8Array(await response.arrayBuffer()),
        await Deno.readFile(
          `${Deno.cwd()}/library/assets_test/music.mp3`,
        ),
      );
    },
  },
  {
    path: "/hello.txt",
    title: "Not Found",
    f: async (response) => {
      assertEquals(response.status, 404);
      await response.arrayBuffer();
    },
  },
]
  .forEach(
    ({ headers = {}, method = "GET", path, title, f }) => {
      Deno.test(
        `Integration: Download Server ${title}`,
        withDownloadServer(
          8080,
          async () => {
            const response = await fetch(`http://localhost:8080${path}`, {
              headers,
              method,
            });
            await f(response);
          },
        ),
      );
    },
  );

[
  {
    body: await Deno.readFile(
      `${Deno.cwd()}/library/assets_test/short-bacon.txt`,
    ),
    headers: {
      "Content-Length": "533",
      "Content-Type": "text/plain",
    },
    path: "/short-bacon.txt",
    title: "Short Text",
    f: (response) => {
      assertEquals(response.status, 204);
    },
  },
  {
    body: await Deno.readFile(
      `${Deno.cwd()}/library/assets_test/long-bacon.txt`,
    ),
    headers: {
      "Content-Length": "43546",
      "Content-Type": "text/plain",
    },
    path: "/long-bacon.txt",
    title: "Long Text",
    f: (response) => {
      assertEquals(response.status, 204);
    },
  },
  {
    body: await Deno.readFile(`${Deno.cwd()}/library/assets_test/image.png`),
    headers: {
      "Content-Length": "87650",
      "Content-Type": "image/png",
    },
    path: "/image.png",
    title: "Image",
    f: (response) => {
      assertEquals(response.status, 204);
    },
  },
  {
    body: await Deno.readFile(`${Deno.cwd()}/library/assets_test/music.mp3`),
    headers: {
      "Content-Length": "8309515",
      "Content-Type": "audio/mpeg",
    },
    path: "/music.mp3",
    title: "Music",
    f: (response) => {
      assertEquals(response.status, 204);
    },
  },
]
  .forEach(
    ({ body, headers = {}, method = "POST", path, title, f }) => {
      Deno.test(
        `Integration: Upload Server - ${title}`,
        withUploadServer(
          8080,
          async () => {
            const response = await fetch(`http://localhost:8080${path}`, {
              body,
              headers,
              method,
            });
            await f(response);
            const { isFile } = await Deno.stat(
              `${Deno.cwd()}/library/assets_test/.upload${path}`,
            );

            assert(isFile);

            const file = await Deno.readFile(
              `${Deno.cwd()}/library/assets_test/.upload${path}`,
            );

            assertEquals(file, body);
          },
        ),
      );
    },
  );
