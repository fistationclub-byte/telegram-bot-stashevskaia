import { createServer, type IncomingMessage } from "node:http";
import telegram from "../../api/telegram.js";
import warmup from "../../api/warmup.js";

async function requestFor(incoming: IncomingMessage, path: string) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value))
      value.forEach((item) => headers.append(name, item));
    else if (value) headers.set(name, value);
  }
  const method = incoming.method ?? "GET";
  const init: RequestInit = { method, headers };
  if (method === "POST" && path === "/api/telegram") {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of incoming as AsyncIterable<Buffer>) {
      length += chunk.length;
      if (length > 1_048_576) return undefined;
      chunks.push(chunk);
    }
    init.body = Buffer.concat(chunks).toString("utf8");
  }
  return new Request(`http://localhost${path}`, init);
}

createServer(async (request, response) => {
  const path = request.url?.split("?", 1)[0];
  if (path !== "/api/telegram" && path !== "/api/warmup") {
    response.writeHead(404).end();
    return;
  }
  try {
    const handler = path === "/api/telegram" ? telegram : warmup;
    const input = await requestFor(request, path);
    if (!input) {
      response.writeHead(413).end();
      return;
    }
    const result = await handler(input);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    console.error(JSON.stringify({ event: "request_failed" }));
    response.writeHead(500).end();
  }
}).listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? "127.0.0.1");
