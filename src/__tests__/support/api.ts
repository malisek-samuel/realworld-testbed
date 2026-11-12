// Testbed addition: the API on a real HTTP server, for tests that need a signed-in user. It has the
// session, login and pagination setup of backend/app.ts; each test file mounts the routers it needs.

import express from "express";
import session from "express-session";
import passport from "passport";
import bodyParser from "body-parser";
import paginate from "express-paginate";
import { Server } from "http";
import { AddressInfo } from "net";
import auth from "../../../backend/auth";

export type Response = { status: number; body: any };

export class Client {
  private cookie?: string;

  constructor(private readonly base: string) {}

  async request(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookie) headers["Cookie"] = this.cookie;

    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON: keep the text
    }
    return { status: res.status, body: parsed };
  }

  get = (path: string) => this.request("GET", path);
  post = (path: string, body?: unknown) => this.request("POST", path, body ?? {});
  patch = (path: string, body?: unknown) => this.request("PATCH", path, body ?? {});

  login = (username: string, password = "s3cret") =>
    this.post("/login", { type: "LOGIN", username, password });
}

export type Api = {
  base: string;
  client: () => Client;
  as: (username: string, password?: string) => Promise<Client>;
  close: () => Promise<void>;
};

export const startApi = async (mount: (app: express.Express) => void): Promise<Api> => {
  const app = express();
  app.use(bodyParser.json());
  app.use(session({ secret: "test session", resave: false, saveUninitialized: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(paginate.middleware(10));
  app.use(auth);
  mount(app);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    client: () => new Client(base),
    as: async (username, password) => {
      const client = new Client(base);
      const res = await client.login(username, password);
      if (res.status !== 200) throw new Error(`login as ${username} answered ${res.status}`);
      return client;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};
