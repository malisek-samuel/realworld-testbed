// Testbed addition: the arithmetic of splitting a bill (RWT-5). The API computes the requests with
// it and the form previews them with it, so what the user sees is what gets requested.
// Everything is in whole cents: dollars are read from their digits, never multiplied as floats.

import { SplitMode, SplitPayload } from "../models/split";

export const MAX_PARTICIPANTS = 10;
export const MAX_TOTAL_CENTS = 100_000_000; // $1,000,000.00

const DOLLARS = /^(\d+)(?:\.(\d{1,2}))?$/;

// "33.33" -> 3333. Anything that isn't a non-negative amount with at most two decimals: undefined.
export const toCents = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  const match = DOLLARS.exec(String(value).trim());
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : undefined;
};

export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// 10000 between 3 -> [3334, 3333, 3333]: whole cents, the leftover one each to the first shares.
export const splitEqually = (totalCents: number, payers: number): number[] => {
  const base = Math.floor(totalCents / payers);
  const leftover = totalCents - base * payers;
  return Array.from({ length: payers }, (_, i) => base + (i < leftover ? 1 : 0));
};

export type SplitPlan = {
  total: number;
  selfShare: number;
  shares: { userId: string; amount: number }[];
  errors: string[];
};

type PlanInput = Omit<SplitPayload, "description"> & { description?: string };

export const planSplit = (input: PlanInput): SplitPlan => {
  const errors: string[] = [];
  const includeSelf = input.includeSelf ?? true;
  const participants = input.participants ?? [];
  const total = toCents(input.total);

  if (total === undefined || total <= 0) {
    errors.push("Enter a total greater than $0.00, with at most two decimals");
  } else if (total > MAX_TOTAL_CENTS) {
    errors.push(`The total can be at most ${formatCents(MAX_TOTAL_CENTS)}`);
  }
  if (participants.length === 0) {
    errors.push("Pick at least one person");
  } else if (participants.length > MAX_PARTICIPANTS) {
    errors.push(`Pick at most ${MAX_PARTICIPANTS} people`);
  }
  if (new Set(participants.map((p) => p.userId)).size !== participants.length) {
    errors.push("Each person can be picked only once");
  }
  if (participants.length > 0 && participants.length + (includeSelf ? 1 : 0) < 2) {
    errors.push("A split needs at least two people paying");
  }

  const plan = (selfShare: number, amounts: number[]): SplitPlan => ({
    total: total ?? 0,
    selfShare,
    shares: participants.map((p, i) => ({ userId: p.userId, amount: amounts[i] ?? 0 })),
    errors,
  });

  if (errors.length > 0 || total === undefined) return plan(0, []);

  if (input.mode === SplitMode.equal) {
    const shares = splitEqually(total, participants.length + (includeSelf ? 1 : 0));
    if (shares[shares.length - 1] < 1) errors.push("Each share must be at least $0.01");
    return includeSelf ? plan(shares[0], shares.slice(1)) : plan(0, shares);
  }

  if (input.mode !== SplitMode.custom) {
    errors.push("Choose an equal or a custom split");
    return plan(0, []);
  }

  const amounts = participants.map((p) => toCents(p.amount));
  if (amounts.some((amount) => amount === undefined || amount < 1)) {
    errors.push("Enter an amount of at least $0.01 for every person");
  }
  const selfShare = includeSelf ? toCents(input.selfAmount) : 0;
  if (includeSelf && (selfShare === undefined || selfShare < 1)) {
    errors.push("Enter your own share, at least $0.01");
  }
  const known = amounts.map((amount) => amount ?? 0);
  if (errors.length === 0) {
    const sum = known.reduce((a, b) => a + b, 0) + (selfShare ?? 0);
    if (sum !== total) {
      const difference = formatCents(Math.abs(sum - total));
      errors.push(
        `The amounts add up to ${formatCents(sum)}, ${difference} ${
          sum < total ? "less" : "more"
        } than the total`
      );
    }
  }
  return plan(selfShare ?? 0, known);
};
