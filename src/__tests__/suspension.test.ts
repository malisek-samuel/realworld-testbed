// @vitest-environment node
// Testbed addition: suspending and reactivating accounts (RWT-3).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import adminRoutes from "../../backend/admin-routes";
import userRoutes from "../../backend/user-routes";
import transactionRoutes from "../../backend/transaction-routes";
import {
  getAllUsers,
  getUserById,
  getUserByUsername,
  seedDatabase,
  updateUserById,
} from "../../backend/database";
import { UserRole } from "../models";
import { Api, Client, startApi } from "./support/api";

let api: Api;
let admin: Client;

beforeAll(async () => {
  api = await startApi((app) => {
    app.use("/users", userRoutes);
    app.use("/transactions", transactionRoutes);
    app.use("/admin", adminRoutes);
  });
});

afterAll(() => api.close());

beforeEach(async () => {
  seedDatabase();
  admin = await api.as("admin", "admin");
});

const idOf = (username: string) => getUserByUsername(username).id;
const setStatus = (username: string, status: unknown) =>
  admin.patch(`/admin/users/${idOf(username)}`, { status });
const usernames = (res: { body: any }) => res.body.results.map((u: any) => u.username);
const pay = (client: Client, receiverId: string, amount = "10") =>
  client.post("/transactions", {
    transactionType: "payment",
    receiverId,
    amount,
    description: "Lunch",
  });

describe("PATCH /admin/users/:userId", () => {
  it("suspends a user", async () => {
    const res = await setStatus("Dina20", "suspended");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: "Dina20", status: "suspended" });
    expect(res.body.user).not.toHaveProperty("password");
    expect(getUserByUsername("Dina20").status).toBe("suspended");
  });

  it("refuses to suspend an admin, including yourself", async () => {
    updateUserById(idOf("Dina20"), { role: UserRole.admin });

    const self = await setStatus("admin", "suspended");
    const other = await setStatus("Dina20", "suspended");

    expect(self.status).toBe(422);
    expect(other.status).toBe(422);
    expect(getUserByUsername("admin").status).toBe("active");
    expect(getUserByUsername("Dina20").status).toBe("active");
  });

  it("answers 404 for an unknown user", async () => {
    const res = await admin.patch("/admin/users/abcdefghij", { status: "suspended" });

    expect(res.status).toBe(404);
  });

  it("answers 422 for any other status or any other field", async () => {
    const banned = await setStatus("Dina20", "banned");
    const promote = await admin.patch(`/admin/users/${idOf("Dina20")}`, {
      status: "active",
      role: "admin",
    });

    expect(banned.status).toBe(422);
    expect(promote.status).toBe(422);
    expect(getUserByUsername("Dina20")).toMatchObject({ status: "active", role: "user" });
  });

  it("is for admins only", async () => {
    const user = await api.as("Heath93");

    const res = await user.patch(`/admin/users/${idOf("Dina20")}`, { status: "suspended" });

    expect(res.status).toBe(403);
    expect(getUserByUsername("Dina20").status).toBe("active");
  });
});

describe("a suspended user", () => {
  it("can't sign in", async () => {
    await setStatus("Dina20", "suspended");

    const res = await api.client().login("Dina20");

    expect(res.status).toBe(401);
  });

  it("is signed out of a session opened before the suspension", async () => {
    const dina = await api.as("Dina20");
    expect((await dina.get("/transactions")).status).toBe(200);

    await setStatus("Dina20", "suspended");

    expect((await dina.get("/transactions")).status).toBe(401);
    expect((await dina.get("/checkAuth")).status).toBe(401);
  });

  it("is missing from the user list and the search", async () => {
    const heath = await api.as("Heath93");
    await setStatus("Dina20", "suspended");

    const list = await heath.get("/users");
    const search = await heath.get("/users/search?q=Dina20");

    expect(usernames(list)).not.toContain("Dina20");
    expect(usernames(list)).toContain("Arvilla_Hegmann");
    expect(usernames(search)).not.toContain("Dina20");
  });

  it("can't be paid, and no money moves", async () => {
    const heath = await api.as("Heath93");
    await setStatus("Dina20", "suspended");
    const before = [getUserByUsername("Heath93").balance, getUserByUsername("Dina20").balance];

    const res = await pay(heath, idOf("Dina20"));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Receiver account is suspended" });
    expect([getUserByUsername("Heath93").balance, getUserByUsername("Dina20").balance]).toEqual(
      before
    );
  });

  it("is back to normal after reactivation", async () => {
    const heath = await api.as("Heath93");
    await setStatus("Dina20", "suspended");

    const res = await setStatus("Dina20", "active");

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("active");
    expect((await api.client().login("Dina20")).status).toBe(200);
    expect(usernames(await heath.get("/users"))).toContain("Dina20");
    expect((await pay(heath, idOf("Dina20"))).status).toBe(200);
  });
});

describe("status in the admin API", () => {
  it("lists every user's status and filters by it", async () => {
    await setStatus("Dina20", "suspended");

    const all = await admin.get("/admin/users");
    const suspended = await admin.get("/admin/users?status=suspended");
    const active = await admin.get("/admin/users?status=active");

    expect(all.body.results.every((u: any) => ["active", "suspended"].includes(u.status))).toBe(
      true
    );
    expect(usernames(suspended)).toEqual(["Dina20"]);
    expect(usernames(active)).toHaveLength(getAllUsers().length - 1);
    expect(usernames(active)).not.toContain("Dina20");
  });

  it("counts suspended users in the statistics", async () => {
    await setStatus("Dina20", "suspended");
    await setStatus("Heath93", "suspended");

    const res = await admin.get("/admin/stats");

    expect(res.body.users.suspended).toBe(2);
  });
});

describe("status can't be set by users", () => {
  it("is active for a new account", async () => {
    const res = await api.client().post("/users", {
      firstName: "Nova",
      lastName: "Reyes",
      username: "nova",
      password: "s3cret",
    });

    expect(res.status).toBe(201);
    expect(getUserById(res.body.user.id).status).toBe("active");
  });

  it("is refused in a profile update", async () => {
    const dina = await api.as("Dina20");

    const res = await dina.patch(`/users/${idOf("Dina20")}`, {
      firstName: "Darrel",
      status: "suspended",
    });

    expect(res.status).toBe(422);
    expect(getUserByUsername("Dina20").status).toBe("active");
  });
});
