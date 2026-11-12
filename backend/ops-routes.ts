///<reference path="types.ts" />

// Testbed addition: /health and /metrics for load, stress and soak testing. Both are cheap enough to
// poll every second through a long run: no file is parsed, the data is counted in memory and the
// database file is only stat'ed. They are mounted before the request logger, so polling them doesn't
// flood the log.

import express, { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import { collectDefaultMetrics, Gauge, Histogram, register } from "prom-client";
import { databaseFile, getAllForEntity } from "./database";
import { getActiveFaults, getLeakedBytes } from "./fault-routes";
import { DbSchema } from "../src/models/db-schema";

const COLLECTIONS: (keyof DbSchema)[] = [
  "users",
  "contacts",
  "bankaccounts",
  "transactions",
  "likes",
  "comments",
  "notifications",
  "banktransfers",
];
const FAULTS = ["latency", "errors", "leak"];

// Process metrics: memory, CPU, event-loop lag, garbage collection, open handles.
collectDefaultMetrics();

const requestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds, by method, route template and status code",
  labelNames: ["method", "route", "status_code"],
});

const collectionSize = (collection: keyof DbSchema) => {
  const rows = getAllForEntity(collection);
  if (!Array.isArray(rows)) throw new Error(`collection "${collection}" is missing`);
  return rows.length;
};

new Gauge({
  name: "rwa_db_records",
  help: "Records per collection in the database",
  labelNames: ["collection"],
  collect() {
    this.reset(); // a broken database shows as no series, and /health says why
    try {
      COLLECTIONS.forEach((collection) => this.set({ collection }, collectionSize(collection)));
    } catch {}
  },
});

new Gauge({
  name: "rwa_db_file_bytes",
  help: "Size of the database file in bytes",
  collect() {
    this.reset();
    try {
      this.set(fs.statSync(databaseFile).size);
    } catch {}
  },
});

new Gauge({
  name: "rwa_fault_active",
  help: "1 while a fault switch is on (development and test only)",
  labelNames: ["fault"],
  collect() {
    const active = getActiveFaults();
    FAULTS.forEach((fault) => this.set({ fault }, active.includes(fault) ? 1 : 0));
  },
});

new Gauge({
  name: "rwa_fault_leaked_bytes",
  help: "Memory held by the leak fault switch in bytes",
  collect() {
    this.set(getLeakedBytes());
  },
});

// The route template, never the raw path: one series per endpoint however many IDs a load test
// uses. Requests no route matched (404s, static files, injected errors) are "other".
export const routeLabel = (req: Request) =>
  req.route ? `${req.baseUrl}${req.route.path}` : req.baseUrl || "other";

export const requestMetrics = (req: Request, res: Response, next: NextFunction) => {
  const end = requestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: routeLabel(req), status_code: res.statusCode });
  });
  next();
};

// "fail" only when the app can't serve its data. Fault switches are reported, not failed on:
// a monitor has to catch their symptoms itself.
export const healthReport = () => {
  let database;
  try {
    const records = Object.fromEntries(COLLECTIONS.map((c) => [c, collectionSize(c)]));
    database = { status: "ok", fileBytes: fs.statSync(databaseFile).size, records };
  } catch (error) {
    database = { status: "fail", error: (error as Error).message };
  }
  const memory = process.memoryUsage();
  return {
    status: database.status,
    uptimeSeconds: Math.round(process.uptime()),
    database,
    memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
    faults: { active: getActiveFaults(), leakedBytes: getLeakedBytes() },
  };
};

const router = express.Router();

//GET /health
router.get("/health", (req, res) => {
  const report = healthReport();
  res.set("Cache-Control", "no-store");
  res.status(report.status === "ok" ? 200 : 503).json(report);
});

//GET /metrics (Prometheus text format)
router.get("/metrics", async (req, res) => {
  try {
    const text = await register.metrics();
    res.set("Content-Type", register.contentType);
    res.send(text);
  } catch (error) {
    res.status(500).send(`metrics failed: ${(error as Error).message}`);
  }
});

// Mount first, before the request logger and the session, so every request is timed.
export const mountOps = (app: Express) => {
  app.use(requestMetrics);
  app.use(router);
};

export default router;
