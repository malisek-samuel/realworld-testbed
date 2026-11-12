// @vitest-environment node
// Testbed addition: the split-a-bill API (RWT-5).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import splitRoutes from "../../backend/split-routes";
import transactionRoutes from "../../backend/transaction-routes";
import testDataRoutes from "../../backend/testdata-routes";
import { mountOps } from "../../backend/ops-routes";
import {
  getAllTransactions,
  getNotificationsByUserId,
  getTransactionById,
  getUserByUsername,
  seedDatabase,
  updateUserById,
} from "../../backend/database";
import { UserStatus } from "../models";
import { Api, Client, startApi } from "./support/api";

let api: Api;
let heath: Client;

beforeAll(async () => {
  api = await startApi((app) => {
    mountOps(app);
    app.use("/testData", testDataRoutes);
    app.use("/splits", splitRoutes);
    app.use("/transactions", transactionRoutes);
  });
});

afterAll(() => api.close());

beforeEach(async () => {
  seedDatabase();
  heath = await api.as("Heath93");
});

const idOf = (username: string) => getUserByUsername(username).id;
const others = ["Dina20", "Arvilla_Hegmann", "Reyes.Osinski", "Judah_Dietrich50"];
const equalSplit = (total: string, usernames: string[], extra: object = {}) =>
  heath.post("/splits", {
    description: "Dinner at Luigi's",
    total,
    mode: "equal",
    participants: usernames.map((u) => ({ userId: idOf(u) })),
    ...extra,
  });
const messages = (res: { body: any }) => (res.body.errors ?? []).map((e: any) => e.msg);

describe("POST /splits, equal", () => {
  it("splits $100 between the creator and two people", async () => {
    const res = await equalSplit("100", ["Dina20", "Arvilla_Hegmann"]);

    expect(res.status).toBe(201);
    expect(res.body.split).toMatchObject({
      description: "Dinner at Luigi's",
      mode: "equal",
      total: 10000,
      selfShare: 3334,
      collected: 0,
      outstanding: 6666,
      declined: 0,
      creator: { id: idOf("Heath93"), name: "Ted Parisian" },
    });
    expect(res.body.split.participants).toMatchObject([
      { userId: idOf("Dina20"), name: "Darrel Ortiz", amount: 3333, requestStatus: "pending" },
      { userId: idOf("Arvilla_Hegmann"), amount: 3333, requestStatus: "pending" },
    ]);
  });

  it("creates an ordinary pending request for each person, with the split's ID", async () => {
    const res = await equalSplit("100", ["Dina20", "Arvilla_Hegmann"]);

    for (const participant of res.body.split.participants) {
      const transaction = getTransactionById(participant.transactionId);
      expect(transaction).toMatchObject({
        senderId: idOf("Heath93"),
        receiverId: participant.userId,
        amount: participant.amount,
        description: "Dinner at Luigi's",
        status: "pending",
        requestStatus: "pending",
        splitId: res.body.split.id,
      });
      expect(getNotificationsByUserId(participant.userId)).toContainEqual(
        expect.objectContaining({ transactionId: transaction.id, status: "requested" })
      );
    }
  });

  it("gives a cent each to five payers of $0.05, and refuses $0.04", async () => {
    const before = getAllTransactions().length;

    const fine = await equalSplit("0.05", others);
    const tooSmall = await equalSplit("0.04", others);

    expect(fine.status).toBe(201);
    expect(fine.body.split.selfShare).toBe(1);
    expect(fine.body.split.participants.map((p: any) => p.amount)).toEqual([1, 1, 1, 1]);
    expect(tooSmall.status).toBe(422);
    expect(messages(tooSmall)).toContain("Each share must be at least $0.01");
    expect(getAllTransactions().length).toBe(before + 4);
  });

  it.each([
    ["33.33", 3333, 1667, 1666],
    ["0.10", 10, 5, 5],
    ["1234.56", 123456, 61728, 61728],
  ])("is exact for $%s", async (total, cents, selfShare, request) => {
    const res = await equalSplit(total, ["Dina20"]);

    expect(res.body.split.total).toBe(cents);
    expect(res.body.split.selfShare).toBe(selfShare);
    expect(getTransactionById(res.body.split.participants[0].transactionId).amount).toBe(request);
  });
});

describe("POST /splits, custom", () => {
  const customSplit = (dina: string, arvilla: string) =>
    heath.post("/splits", {
      description: "Groceries",
      total: "100",
      mode: "custom",
      selfAmount: "40",
      participants: [
        { userId: idOf("Dina20"), amount: dina },
        { userId: idOf("Arvilla_Hegmann"), amount: arvilla },
      ],
    });

  it("requests the amounts as given when they add up", async () => {
    const res = await customSplit("35.50", "24.50");

    expect(res.status).toBe(201);
    expect(res.body.split.selfShare).toBe(4000);
    expect(res.body.split.participants.map((p: any) => p.amount)).toEqual([3550, 2450]);
  });

  it("refuses amounts a cent short of the total, and creates nothing", async () => {
    const before = getAllTransactions().length;

    const res = await customSplit("35.50", "24.49");

    expect(res.status).toBe(422);
    expect(messages(res)).toContain("The amounts add up to $99.99, $0.01 less than the total");
    expect(getAllTransactions().length).toBe(before);
  });
});

describe("POST /splits, who can take part", () => {
  it.each([
    ["the same person twice", () => ["Dina20", "Dina20"].map((u) => ({ userId: idOf(u) }))],
    ["the creator", () => ["Dina20", "Heath93"].map((u) => ({ userId: idOf(u) }))],
    ["an unknown user", () => [{ userId: idOf("Dina20") }, { userId: "abcdefghij" }]],
    ["11 people", () => Array.from({ length: 11 }, (_, i) => ({ userId: `user${i}abc` }))],
  ])("refuses %s, and creates nothing", async (_, participants) => {
    const before = getAllTransactions().length;

    const res = await heath.post("/splits", {
      description: "Dinner",
      total: "100",
      mode: "equal",
      participants: participants(),
    });

    expect(res.status).toBe(422);
    expect(messages(res).length).toBeGreaterThan(0);
    expect(getAllTransactions().length).toBe(before);
  });

  it("refuses a suspended user", async () => {
    updateUserById(idOf("Dina20"), { status: UserStatus.suspended });

    const res = await equalSplit("100", ["Arvilla_Hegmann", "Dina20"]);

    expect(res.status).toBe(422);
    expect(messages(res)).toContain("@Dina20's account is suspended");
  });

  it("refuses a request without a description, mode or participants list", async () => {
    const res = await heath.post("/splits", { total: "100" });

    expect(res.status).toBe(422);
  });
});

describe("GET /splits/:splitId", () => {
  it("lets the creator and the participants read the split", async () => {
    const created = (await equalSplit("100", ["Dina20", "Arvilla_Hegmann"])).body.split;
    const dina = await api.as("Dina20");

    const byCreator = await heath.get(`/splits/${created.id}`);
    const byParticipant = await dina.get(`/splits/${created.id}`);

    expect(byCreator.status).toBe(200);
    expect(byCreator.body.split).toEqual(created);
    expect(byParticipant.status).toBe(200);
  });

  it("moves an accepted request to collected and a declined one to declined", async () => {
    // different amounts, so that collected and declined can't be confused
    const created = (
      await heath.post("/splits", {
        description: "Groceries",
        total: "100",
        mode: "custom",
        selfAmount: "40",
        participants: [
          { userId: idOf("Dina20"), amount: "35.50" },
          { userId: idOf("Arvilla_Hegmann"), amount: "24.50" },
        ],
      })
    ).body.split;
    const [toDina, toArvilla] = created.participants;
    const dina = await api.as("Dina20");
    const arvilla = await api.as("Arvilla_Hegmann");

    await dina.patch(`/transactions/${toDina.transactionId}`, { requestStatus: "accepted" });
    await arvilla.patch(`/transactions/${toArvilla.transactionId}`, { requestStatus: "rejected" });
    const res = await heath.get(`/splits/${created.id}`);

    expect(res.body.split).toMatchObject({ collected: 3550, outstanding: 0, declined: 2450 });
    expect(res.body.split.participants.map((p: any) => p.requestStatus)).toEqual([
      "accepted",
      "rejected",
    ]);
  });

  it("answers 403 to a user outside the split, 404 to an unknown ID, 401 without a session", async () => {
    const created = (await equalSplit("100", ["Dina20"])).body.split;
    const outsider = await api.as("Reyes.Osinski");

    expect((await outsider.get(`/splits/${created.id}`)).status).toBe(403);
    expect((await heath.get("/splits/doesnotexist")).status).toBe(404);
    expect((await api.client().get(`/splits/${created.id}`)).status).toBe(401);
    expect((await api.client().post("/splits", {})).status).toBe(401);
  });
});

describe("the splits collection", () => {
  it("is counted by /health and readable at /testData/splits", async () => {
    await equalSplit("100", ["Dina20"]);

    const health = await api.client().get("/health");
    const testData = await api.client().get("/testData/splits");

    expect(health.body.database.records.splits).toBe(1);
    expect(testData.status).toBe(200);
    expect(testData.body.results).toHaveLength(1);
  });
});
