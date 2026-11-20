import { handleRequest } from "./handler.js";

declare const Deno: {
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(handleRequest);
