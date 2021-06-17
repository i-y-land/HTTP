import { concat } from "../utilities.js";

const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

const generateAsset = (name, headers, body = new Uint8Array(0)) =>
  Deno.writeFile(
    `${Deno.cwd()}/library/assets_test/${name}`,
    concat(encode(`${headers}\r\n\r\n`), body)
  );

await generateAsset(
  "01_short-text.http",
  "GET http://localhost:8080/short-bacon.txt HTTP/1.1\r\nAccept: */*"
);

await generateAsset(
  "02_long-text.http",
  "GET http://localhost:8080/long-bacon.txt HTTP/1.1\r\nAccept: */*"
);

await generateAsset(
  "03_image.http",
  "GET http://localhost:8080/image.png HTTP/1.1\r\nAccept: */*"
);

await generateAsset(
  "04_music.http",
  "GET http://localhost:8080/music.mp3 HTTP/1.1\r\nAccept: */*"
);
