// @vitest-environment node
// Testbed addition: the admin API (RWT-2).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import adminRoutes from "../../backend/admin-routes";
import {
  getAllTransactions,
  getAllUsers,
  getUserByUsername,
  seedDatabase,
} from "../../backend/database";
import { Transaction, TransactionStatus, TransactionRequestStatus } from "../models";
import { Api, startApi } from "./support/api";

let api: Api;

beforeAll(async () => {
  api = await startApi((app) => app.use("/admin", adminRoutes));
});

afterAll(() => api.close());

beforeEach(() => {
  seedDatabase();
});

const involves = (userId: string) => (t: Transaction) =>
  t.senderId === userId || t.receiverId === userId;

describe("admin API access", () => {
  it.each(["/admin/users", "/admin/stats"])("%s answers 401 without a session", async (path) => {
    const res = await api.client().get(path);

    expect(res.status).toBe(401);
  });

  it.each(["/admin/users", "/admin/stats"])("%s answers 403 to a user", async (path) => {
    const client = await api.as("Heath93");

    const res = await client.get(path);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });
});

describe("GET /admin/users", () => {
  it("lists every user, newest first, without password hashes", async () => {
    const client = await api.as("admin", "admin");

    const res = await client.get("/admin/users");

    const expected = [...getAllUsers()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((user) => user.username);
    expect(res.status).toBe(200);
    expect(res.body.results.map((user: any) => user.username)).toEqual(expected);
    for (const user of res.body.results) {
      expect(user).not.toHaveProperty("password");
      expect(Object.keys(user).sort()).toEqual(
        [
          "avatar",
          "balance",
          "createdAt",
          "email",
          "firstName",
          "id",
          "lastName",
          "phoneNumber",
          "role",
          "status",
          "transactionCount",
          "username",
        ].sort()
      );
    }
  });

  it("pages the list", async () => {
    const client = await api.as("admin", "admin");
    const all = (await client.get("/admin/users")).body.results;

    const first = await client.get("/admin/users?limit=2");
    const second = await client.get("/admin/users?limit=2&page=2");

    expect(first.body.results).toEqual(all.slice(0, 2));
    expect(second.body.results).toEqual(all.slice(2, 4));
    expect(first.body.pageData.totalPages).toBe(Math.ceil(getAllUsers().length / 2));
    expect(first.body.pageData.hasNextPages).toBe(true);
  });

  it("refuses a limit of 0", async () => {
    const client = await api.as("admin", "admin");

    const res = await client.get("/admin/users?limit=0");

    expect(res.status).toBe(422);
  });

  it("finds users by name, username or email, ignoring case", async () => {
    const client = await api.as("admin", "admin");

    const byLastName = await client.get("/admin/users?q=BRADTKE");
    const byUsername = await client.get("/admin/users?q=dina2");
    const byEmail = await client.get("/admin/users?q=norma27@");
    const nobody = await client.get("/admin/users?q=zzzzzz");

    expect(byLastName.body.results.map((u: any) => u.username)).toEqual(["Arvilla_Hegmann"]);
    expect(byUsername.body.results.map((u: any) => u.username)).toEqual(["Dina20"]);
    expect(byEmail.body.results.map((u: any) => u.username)).toEqual(["Reyes.Osinski"]);
    expect(nobody.body.results).toEqual([]);
  });

  it("counts the transactions each user sent or received", async () => {
    const client = await api.as("admin", "admin");
    const heath = getUserByUsername("Heath93");

    const res = await client.get("/admin/users?q=Heath93");

    const expected = getAllTransactions().filter(involves(heath.id)).length;
    expect(expected).toBeGreaterThan(0);
    expect(res.body.results[0].transactionCount).toBe(expected);
  });
});

describe("GET /admin/stats", () => {
  it("matches the database", async () => {
    const client = await api.as("admin", "admin");
    const users = getAllUsers();
    const transactions: Transaction[] = getAllTransactions();
    const requests = transactions.filter((t) => t.requestStatus);

    const res = await client.get("/admin/stats");

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual({
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      suspended: users.filter((u) => u.status === "suspended").length,
    });
    expect(res.body.transactions).toEqual({
      total: transactions.length,
      payments: transactions.length - requests.length,
      requests: requests.length,
      pendingRequests: requests.filter((t) => t.requestStatus === TransactionRequestStatus.pending)
        .length,
    });
  });

  it("counts only completed transactions in the volume", async () => {
    const client = await api.as("admin", "admin");
    const transactions: Transaction[] = getAllTransactions();
    const sum = (list: Transaction[]) => list.reduce((total, t) => total + t.amount, 0);
    const completed = transactions.filter((t) => t.status === TransactionStatus.complete);

    const res = await client.get("/admin/stats");

    // the seed has transactions that aren't complete, or this test couldn't tell them apart
    expect(completed.length).toBeLessThan(transactions.length);
    expect(res.body.volume).toBe(sum(completed));
  });
});
