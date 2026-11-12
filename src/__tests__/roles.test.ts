// @vitest-environment node
// Testbed addition: user roles (RWT-1).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import userRoutes from "../../backend/user-routes";
import { getAllUsers, getUserByUsername, seedDatabase } from "../../backend/database";
import { Api, startApi } from "./support/api";

let api: Api;

beforeAll(async () => {
  api = await startApi((app) => app.use("/users", userRoutes));
});

afterAll(() => api.close());

beforeEach(() => {
  seedDatabase();
});

const signUp = (extra: object = {}) =>
  api.client().post("/users", {
    firstName: "Nova",
    lastName: "Reyes",
    username: "nova",
    password: "s3cret",
    ...extra,
  });

describe("user roles", () => {
  it("signs the seed admin in with the admin role", async () => {
    const client = api.client();

    const login = await client.login("admin", "admin");
    const check = await client.get("/checkAuth");

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("admin");
    expect(check.body.user.role).toBe("admin");
  });

  it("gives every other seed user the user role", () => {
    const others = getAllUsers().filter((user) => user.username !== "admin");

    expect(others).toHaveLength(5);
    for (const user of others) expect(user.role).toBe("user");
  });

  it("gives a new account the user role", async () => {
    const res = await signUp();

    expect(res.status).toBe(201);
    expect(getUserByUsername("nova").role).toBe("user");
  });

  it("refuses a sign-up that sets a role", async () => {
    const res = await signUp({ role: "admin" });

    expect(res.status).toBe(422);
    expect(getUserByUsername("nova")).toBeUndefined();
  });

  it("refuses a profile update that sets a role", async () => {
    const client = await api.as("Heath93");
    const { id } = getUserByUsername("Heath93");

    const res = await client.patch(`/users/${id}`, { firstName: "Ted", role: "admin" });

    expect(res.status).toBe(422);
    expect(getUserByUsername("Heath93").role).toBe("user");
  });

  it("still accepts a profile update without a role", async () => {
    const client = await api.as("Heath93");
    const { id } = getUserByUsername("Heath93");

    const res = await client.patch(`/users/${id}`, { firstName: "Teddy" });

    expect(res.status).toBe(204);
    expect(getUserByUsername("Heath93").firstName).toBe("Teddy");
  });
});
