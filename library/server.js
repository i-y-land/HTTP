export const serve = async (listener, f) => {
  for await (const connection of listener) {
    const xs = new Uint8Array(1024);
    const n = await Deno.read(connection.rid, xs);

    const ys = await f(xs.subarray(0, n));
    await Deno.write(connection.rid, ys);
  }
};