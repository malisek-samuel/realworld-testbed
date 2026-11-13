// @vitest-environment node
// Testbed addition: the arithmetic of splitting a bill (RWT-5), shared by the API and the form.

import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, planSplit, splitEqually, toCents } from "../utils/splitUtils";
import { SplitMode } from "../models/split";

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `user${i + 1}` }));

describe("toCents", () => {
  it.each([
    ["90", 9000],
    ["90.5", 9050],
    ["33.33", 3333],
    ["0.10", 10],
    ["1234.56", 123456],
    [" 7.01 ", 701],
    [19.99, 1999],
    [0.07, 7],
  ])("reads %j as %i cents", (input, cents) => {
    expect(toCents(input)).toBe(cents);
  });

  it.each([["abc"], [""], ["1.234"], ["-5"], ["1e3"], [0.1 + 0.2], [Number.NaN], [undefined]])(
    "rejects %j",
    (input) => {
      expect(toCents(input as any)).toBeUndefined();
    }
  );
});

describe("splitEqually", () => {
  it("gives the leftover cents to the first shares", () => {
    expect(splitEqually(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitEqually(10001, 3)).toEqual([3334, 3334, 3333]);
    expect(splitEqually(5, 5)).toEqual([1, 1, 1, 1, 1]);
  });

  it("always adds up to the total", () => {
    for (const total of [1, 7, 99, 101, 3333, 123457]) {
      for (let payers = 1; payers <= 11; payers++) {
        const shares = splitEqually(total, payers);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("planSplit, equal", () => {
  it("splits $100 between the creator and two people", () => {
    const plan = planSplit({ total: "100", mode: SplitMode.equal, participants: people(2) });

    expect(plan.errors).toEqual([]);
    expect(plan.selfShare).toBe(3334);
    expect(plan.shares).toEqual([
      { userId: "user1", amount: 3333 },
      { userId: "user2", amount: 3333 },
    ]);
  });

  it("leaves the creator out when includeSelf is false", () => {
    const plan = planSplit({
      total: "100",
      mode: SplitMode.equal,
      includeSelf: false,
      participants: people(3),
    });

    expect(plan.selfShare).toBe(0);
    expect(plan.shares.map((s) => s.amount)).toEqual([3334, 3333, 3333]);
  });

  it("allows a cent each, not less", () => {
    const fine = planSplit({ total: "0.05", mode: SplitMode.equal, participants: people(4) });
    const tooSmall = planSplit({ total: "0.04", mode: SplitMode.equal, participants: people(4) });

    expect(fine.errors).toEqual([]);
    expect(fine.shares.map((s) => s.amount)).toEqual([1, 1, 1, 1]);
    expect(tooSmall.errors).toContain("Each share must be at least $0.01");
  });
});

describe("planSplit, custom", () => {
  it("takes the amounts as given when they add up", () => {
    const plan = planSplit({
      total: "100",
      mode: SplitMode.custom,
      selfAmount: "40",
      participants: [
        { userId: "user1", amount: "35.50" },
        { userId: "user2", amount: "24.50" },
      ],
    });

    expect(plan.errors).toEqual([]);
    expect(plan.selfShare).toBe(4000);
    expect(plan.shares.map((s) => s.amount)).toEqual([3550, 2450]);
  });

  it("says how much is missing or too much", () => {
    const short = planSplit({
      total: "100",
      mode: SplitMode.custom,
      selfAmount: "40",
      participants: [
        { userId: "user1", amount: "35.50" },
        { userId: "user2", amount: "24.49" },
      ],
    });
    const over = planSplit({
      total: "50",
      mode: SplitMode.custom,
      includeSelf: false,
      participants: [
        { userId: "user1", amount: "30" },
        { userId: "user2", amount: "25" },
      ],
    });

    expect(short.errors).toContain("The amounts add up to $99.99, $0.01 less than the total");
    expect(over.errors).toContain("The amounts add up to $55.00, $5.00 more than the total");
  });

  it("needs an amount for everybody who pays", () => {
    const plan = planSplit({
      total: "100",
      mode: SplitMode.custom,
      participants: [{ userId: "user1", amount: "100" }, { userId: "user2" }],
    });

    expect(plan.errors).toContain("Enter an amount of at least $0.01 for every person");
    expect(plan.errors).toContain("Enter your own share, at least $0.01");
  });
});

describe("planSplit, who takes part", () => {
  it("needs a valid total", () => {
    for (const total of ["0", "abc", "12.345", "1000000.01"]) {
      const plan = planSplit({ total, mode: SplitMode.equal, participants: people(2) });
      expect(plan.errors.length).toBeGreaterThan(0);
    }
  });

  it("needs at least two payers", () => {
    const alone = planSplit({
      total: "10",
      mode: SplitMode.equal,
      includeSelf: false,
      participants: people(1),
    });
    const nobody = planSplit({ total: "10", mode: SplitMode.equal, participants: [] });

    expect(alone.errors).toContain("A split needs at least two people paying");
    expect(nobody.errors).toContain("Pick at least one person");
  });

  it(`allows up to ${MAX_PARTICIPANTS} people`, () => {
    const max = planSplit({
      total: "100",
      mode: SplitMode.equal,
      participants: people(MAX_PARTICIPANTS),
    });
    const tooMany = planSplit({
      total: "100",
      mode: SplitMode.equal,
      participants: people(MAX_PARTICIPANTS + 1),
    });

    expect(max.errors).toEqual([]);
    expect(tooMany.errors).toContain(`Pick at most ${MAX_PARTICIPANTS} people`);
  });

  it("refuses the same person twice", () => {
    const plan = planSplit({
      total: "100",
      mode: SplitMode.equal,
      participants: [{ userId: "user1" }, { userId: "user1" }],
    });

    expect(plan.errors).toContain("Each person can be picked only once");
  });
});
