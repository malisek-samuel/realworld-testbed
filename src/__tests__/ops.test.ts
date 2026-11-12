// @vitest-environment node
// Testbed addition: /health, /metrics and the fault switches, through a real HTTP server on a free
// port. The app is mounted in the same order as backend/app.ts: ops first, then the body parser,
// the fault switches and the business routes.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import { Server } from "http";
import { AddressInfo } from "net";
import { getAllForEntity, seedDatabase } from "../../backend/database";
import { mountOps } from "../../backend/ops-routes";
import {
  faultMiddleware,
  getLeakedBytes,
  mountFaults,
  resetFaults,
  setFaults,
} from "../../backend/fault-routes";

const MB = 1024 * 1024;

const buildApp = () => {
  const app = express();
  mountOps(app);
  app.use(bodyParser.json());
  mountFaults(app);
  const items = express.Router();
  items.get("/:itemId", (req, res) => {
    res.json({ id: req.params.itemId });
  });
  app.use("/items", items);
  return app;
};

const listen = (app: express.Express) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });

let server: Server;
let base: string;

const putFaults = (body: unknown) =>
  fetch(`${base}/testing/faults`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  ({ server, base } = await listen(buildApp()));
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  seedDatabase();
});

afterEach(() => {
  resetFaults();
  vi.restoreAllMocks();
});

describe("GET /health", () => {
  it("reports ok with the record count of every collection", async () => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database.records.transactions).toBe(getAllForEntity("transactions").length);
    expect(body.database.records.users).toBe(getAllForEntity("users").length);
    expect(body.database.fileBytes).toBeGreaterThan(0);
    expect(body.faults).toEqual({ active: [], leakedBytes: 0 });
  });

  it("fails with 503 when the database file can't be read", async () => {
    vi.spyOn(fs, "statSync").mockImplementation(() => {
      throw new Error("ENOENT: no such file");
    });

    const res = await fetch(`${base}/health`);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("fail");
    expect(body.database.error).toContain("ENOENT");
  });
});

describe("GET /metrics", () => {
  it("labels requests by route template, never by the raw path", async () => {
    await fetch(`${base}/items/first-id`);
    await fetch(`${base}/items/second-id`);

    const text = await (await fetch(`${base}/metrics`)).text();

    expect(text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="\/items\/:itemId",status_code="200"\} [1-9]/
    );
    expect(text).not.toContain("first-id");
    expect(text).not.toContain("second-id");
  });

  it("exposes process, data and fault metrics in Prometheus format", async () => {
    const res = await fetch(`${base}/metrics`);
    const text = await res.text();

    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("nodejs_eventloop_lag_seconds");
    expect(text).toContain("process_resident_memory_bytes");
    expect(text).toContain(`rwa_db_records{collection="users"} ${getAllForEntity("users").length}`);
    expect(text).toContain('rwa_fault_active{fault="leak"} 0');
  });
});

describe("/testing/faults", () => {
  it("an error rate of 1 fails business routes, never monitoring or the controls", async () => {
    expect((await putFaults({ errorRate: 1 })).status).toBe(200);

    const item = await fetch(`${base}/items/x`);
    expect(item.status).toBe(500);
    expect(item.headers.get("x-fault-injected")).toBe("error");
    expect(await item.json()).toEqual({ error: "Injected fault", fault: "error" });

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect((await health.json()).faults.active).toEqual(["errors"]);
    expect((await fetch(`${base}/metrics`)).status).toBe(200);
    expect((await fetch(`${base}/testing/faults`)).status).toBe(200);

    expect((await fetch(`${base}/testing/faults`, { method: "DELETE" })).status).toBe(200);
    const after = await fetch(`${base}/items/x`);
    expect(after.status).toBe(200);
    expect(after.headers.get("x-fault-injected")).toBeNull();
  });

  it("skips monitoring and the test controls even when mounted before them", async () => {
    // backend/app.ts mounts /health, /metrics and /testData first; this guards a later reorder.
    setFaults({ errorRate: 1 });
    const app = express();
    app.use(faultMiddleware);
    ["/health", "/metrics", "/testData/users", "/testing/faults", "/items"].forEach((path) =>
      app.get(path, (req, res) => {
        res.send("ok");
      })
    );
    const early = await listen(app);
    try {
      expect((await fetch(`${early.base}/health`)).status).toBe(200);
      expect((await fetch(`${early.base}/metrics`)).status).toBe(200);
      expect((await fetch(`${early.base}/testData/users`)).status).toBe(200);
      expect((await fetch(`${early.base}/testing/faults`)).status).toBe(200);
      expect((await fetch(`${early.base}/items`)).status).toBe(500);
    } finally {
      early.server.close();
    }
  });

  it("uses the error status it is given and counts what it injected", async () => {
    await putFaults({ errorRate: 1, errorStatus: 503 });
    expect((await fetch(`${base}/items/x`)).status).toBe(503);

    const text = await (await fetch(`${base}/metrics`)).text();
    expect(text).toMatch(/rwa_fault_injected_total\{fault="error"\} [1-9]/);
    expect(text).toContain('rwa_fault_active{fault="errors"} 1');
  });

  it("adds latency to business routes and marks the response", async () => {
    await putFaults({ latencyMs: 150 });

    const started = Date.now();
    const item = await fetch(`${base}/items/x`);
    const elapsed = Date.now() - started;

    expect(item.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(140); // timer slack
    expect(item.headers.get("x-fault-injected")).toBe("latency");
    expect((await fetch(`${base}/health`)).headers.get("x-fault-injected")).toBeNull();
  });

  it("rejects invalid settings and keeps the current ones", async () => {
    await putFaults({ latencyMs: 10 });

    const outOfRange = await putFaults({ errorRate: 2 });
    expect(outOfRange.status).toBe(400);
    expect((await outOfRange.json()).errors[0]).toContain("errorRate");

    const unknown = await putFaults({ crashEverything: true });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).errors[0]).toContain("crashEverything");

    const badStatus = await putFaults({ errorStatus: 404 });
    expect(badStatus.status).toBe(400);

    const current = await (await fetch(`${base}/testing/faults`)).json();
    expect(current).toMatchObject({ latencyMs: 10, errorRate: 0, errorStatus: 500 });
  });

  it("the leak grows to its cap and is released when turned off", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      setFaults({ leakMbPerMinute: 60, leakCapMb: 3 }); // 1 MB a second, at most 3 MB

      vi.advanceTimersByTime(2_000);
      expect(getLeakedBytes()).toBe(2 * MB);
      vi.advanceTimersByTime(10_000);
      expect(getLeakedBytes()).toBe(3 * MB);

      resetFaults();
      expect(getLeakedBytes()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't exist outside development and test", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const app = express();
      app.use(bodyParser.json());
      expect(mountFaults(app)).toBe(false);
      const prod = await listen(app);
      const res = await fetch(`${prod.base}/testing/faults`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorRate: 1 }),
      });
      prod.server.close();
      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
