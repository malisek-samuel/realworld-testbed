///<reference path="types.ts" />

// Testbed addition: fault switches for load, soak and chaos testing — added latency, an error rate
// and a memory leak. They exist only in development and test (mountFaults), never touch monitoring
// or the test controls (EXEMPT_PREFIXES), and every response they affect carries an X-Fault-Injected
// header, so a test or an agent can tell an injected fault from a real one.

import express, { Express, NextFunction, Request, Response } from "express";
import { Counter } from "prom-client";

export type FaultConfig = {
  latencyMs: number;
  latencyJitterMs: number;
  errorRate: number;
  errorStatus: number;
  leakMbPerMinute: number;
  leakCapMb: number;
};

export const DEFAULT_FAULTS: Readonly<FaultConfig> = Object.freeze({
  latencyMs: 0,
  latencyJitterMs: 0,
  errorRate: 0,
  errorStatus: 500,
  leakMbPerMinute: 0,
  leakCapMb: 512,
});

// [min, max] for every setting; nothing outside them is accepted.
const LIMITS: Record<keyof FaultConfig, [number, number]> = {
  latencyMs: [0, 30_000],
  latencyJitterMs: [0, 30_000],
  errorRate: [0, 1],
  errorStatus: [500, 599],
  leakMbPerMinute: [0, 1024],
  leakCapMb: [1, 4096],
};

// Monitoring and the test controls keep working whatever the switches say.
const EXEMPT_PREFIXES = ["/health", "/metrics", "/testing", "/testData"];

const MB = 1024 * 1024;
const LEAK_TICK_MS = 1000;

let faults: FaultConfig = { ...DEFAULT_FAULTS };
let leaked: Buffer[] = [];
let leakedBytes = 0;
let leakTimer: NodeJS.Timeout | undefined;

const injected = new Counter({
  name: "rwa_fault_injected_total",
  help: "Requests affected by a fault switch, by fault",
  labelNames: ["fault"],
});

export const faultsEnabled = () =>
  process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";

export const getFaults = (): FaultConfig => ({ ...faults });

export const getActiveFaults = (): string[] => {
  const active: string[] = [];
  if (faults.latencyMs > 0 || faults.latencyJitterMs > 0) active.push("latency");
  if (faults.errorRate > 0) active.push("errors");
  if (faults.leakMbPerMinute > 0) active.push("leak");
  return active;
};

export const getLeakedBytes = () => leakedBytes;

export const validateFaults = (input: unknown) => {
  const errors: string[] = [];
  const changes: Partial<FaultConfig> = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { errors: ["the body must be a JSON object of settings"], changes };
  }
  for (const [key, value] of Object.entries(input)) {
    if (!(key in LIMITS)) {
      errors.push(`unknown setting "${key}"; known: ${Object.keys(LIMITS).join(", ")}`);
      continue;
    }
    const [min, max] = LIMITS[key as keyof FaultConfig];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${key} must be a number from ${min} to ${max}`);
    } else if (key === "errorStatus" && !Number.isInteger(value)) {
      errors.push("errorStatus must be a whole number");
    } else {
      changes[key as keyof FaultConfig] = value;
    }
  }
  return { errors, changes };
};

// The leak holds filled buffers (resident memory, not the JS heap) and stops growing at its cap.
const leakTick = () => {
  const room = faults.leakCapMb * MB - leakedBytes;
  const size = Math.min(Math.round((faults.leakMbPerMinute * MB * LEAK_TICK_MS) / 60_000), room);
  if (size <= 0) return;
  leaked.push(Buffer.alloc(size, 1));
  leakedBytes += size;
};

// Turning the leak off releases everything it held.
const updateLeak = () => {
  if (faults.leakMbPerMinute > 0) {
    if (!leakTimer) {
      leakTimer = setInterval(leakTick, LEAK_TICK_MS);
      leakTimer.unref();
    }
    return;
  }
  if (leakTimer) clearInterval(leakTimer);
  leakTimer = undefined;
  leaked = [];
  leakedBytes = 0;
};

export const setFaults = (changes: Partial<FaultConfig>) => {
  faults = { ...faults, ...changes };
  updateLeak();
  return getFaults();
};

export const resetFaults = () => setFaults({ ...DEFAULT_FAULTS });

const faultStatus = () => ({ ...faults, active: getActiveFaults(), leakedBytes });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const faultMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (EXEMPT_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }
  const delay = faults.latencyMs + Math.random() * faults.latencyJitterMs;
  const fail = faults.errorRate > 0 && Math.random() < faults.errorRate;
  const marks = [delay > 0 && "latency", fail && "error"].filter(Boolean) as string[];
  if (marks.length === 0) return next();

  marks.forEach((fault) => injected.inc({ fault }));
  res.set("X-Fault-Injected", marks.join(","));
  if (delay > 0) await sleep(delay);
  if (fail) {
    res.status(faults.errorStatus).json({ error: "Injected fault", fault: "error" });
    return;
  }
  next();
};

const router = express.Router();

//GET /testing/faults
router.get("/faults", (req, res) => {
  res.json(faultStatus());
});

//PUT /testing/faults — changes only the settings in the body
router.put("/faults", (req, res) => {
  const { errors, changes } = validateFaults(req.body);
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  setFaults(changes);
  res.json(faultStatus());
});

//DELETE /testing/faults — every switch off, leaked memory released
router.delete("/faults", (req, res) => {
  resetFaults();
  res.json(faultStatus());
});

// Mount after the body parsers and before the business routes. Returns whether it mounted.
export const mountFaults = (app: Express) => {
  if (!faultsEnabled()) return false;
  app.use("/testing", router);
  app.use(faultMiddleware);
  return true;
};

export default router;
