import { serve, serveStatic } from "./library/server.js";
import { findIndexOfSequence, readLine } from "./library/utilities.js";

const $decoder = new TextDecoder();
const decode = $decoder.decode.bind($decoder);
const $encoder = new TextEncoder();
const encode = $encoder.encode.bind($encoder);

const red = m => `\x1b[31m${m}\x1b[0m`;
const green = m => `\x1b[32m${m}\x1b[0m`;
const gray = m => `\x1b[37m${m}\x1b[0m`;

const log = (message, f, { logLevel = "LOG", noColor = false }) => async xs => {
  const ys = readLine(xs);
  const i = findIndexOfSequence(ys, encode(" HTTP/"));
  let s = logLevel === "LOG" ? `Serving ${message} ${decode(ys.subarray(0, i))}... ` : "";

  const t = performance.now();

  try {
    const zs = await f(xs);
    const as = readLine(zs);
    const j = as.indexOf(32);
    const statusCode = Number(decode(as.subarray(j + 1, j + 4)));

    if (statusCode < 300) {
      if (logLevel !== "LOG") return zs;

      s += !noColor
        ? green(`Success ${statusCode} ${gray(`(${(performance.now() - t).toPrecision(1)}ms)`)}\r\n`)
        : `Success ${statusCode} (${(performance.now() - t).toPrecision(1)}ms)\r\n`;
      await Deno.write(Deno.stdout.rid, encode(s));
    } else {
      s += !noColor
        ? red(`Failure ${statusCode} ${gray(`(${(performance.now() - t).toPrecision(1)}ms)`)}\r\n`)
        : `Failure ${statusCode} (${(performance.now() - t).toPrecision(1)}ms)\r\n`;
      await Deno.write(Deno.stdout.rid, encode(s));
    }

    return zs;
  } catch (e) {
    s += !noColor
      ? red(`Failure ${e.message} ${gray(`(${(performance.now() - t).toPrecision(1)}ms)`)}\r\n${gray(e.stack)}\r\n`)
      : `Failure ${e.message} (${(performance.now() - t).toPrecision(1)}ms)\r\n${e.stack}\r\n`;

    await Deno.write(Deno.stderr.rid, encode(s));

    throw e;
  }
};

if (import.meta.main) {
  const port = Number(Deno.args[0]) || 8080;
  const noColor = (await Deno.permissions.query({ name: "env", variable: "NO_COLOR" })).state === "granted" ? Deno.env.get("NO_COLOR") === "1" : false;
  const logLevel = (await Deno.permissions.query({ name: "env", variable: "LOG_LEVEL" })).state === "granted" && Deno.env.get("LOG_LEVEL") || "LOG";
  serve(
    Deno.listen({ port }),
    log("Static", serveStatic, { logLevel, noColor })
  )
    .catch(e => console.error(e));
}
