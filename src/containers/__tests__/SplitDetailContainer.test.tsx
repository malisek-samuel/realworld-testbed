// Testbed addition: the split page (RWT-6), with the split API mocked.

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { createMachine, interpret } from "xstate";
import SplitDetailContainer from "../SplitDetailContainer";
import { fetchSplit } from "../../utils/splitApi";
import { SplitMode, SplitSummary } from "../../models/split";
import { TransactionRequestStatus } from "../../models/transaction";

vi.mock("../../utils/splitApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/splitApi")>()),
  fetchSplit: vi.fn(),
}));

configure({ testIdAttribute: "data-test" });

const split = (dina: TransactionRequestStatus, arvilla: TransactionRequestStatus): SplitSummary => {
  const participants = [
    {
      userId: "dina",
      name: "Darrel Ortiz",
      avatar: "",
      amount: 3550,
      transactionId: "t-dina",
      requestStatus: dina,
    },
    {
      userId: "arvilla",
      name: "Kristian Bradtke",
      avatar: "",
      amount: 2450,
      transactionId: "t-arvilla",
      requestStatus: arvilla,
    },
  ];
  const sum = (status: TransactionRequestStatus) =>
    participants.filter((p) => p.requestStatus === status).reduce((t, p) => t + p.amount, 0);
  return {
    id: "s1",
    description: "Dinner at Luigi's",
    mode: SplitMode.custom,
    createdAt: new Date("2026-11-12T19:00:00Z"),
    creator: { id: "heath", name: "Ted Parisian", avatar: "" },
    total: 10000,
    selfShare: 4000,
    participants,
    collected: sum(TransactionRequestStatus.accepted),
    outstanding: sum(TransactionRequestStatus.pending),
    declined: sum(TransactionRequestStatus.rejected),
  };
};

const renderAs = (userId: string) =>
  render(
    <MemoryRouter initialEntries={["/splits/s1"]}>
      <Route path="/splits/:splitId">
        <SplitDetailContainer
          authService={
            interpret(
              createMachine({
                id: "auth",
                context: { user: { id: userId } },
                initial: "authorized",
                states: { authorized: {} },
              })
            ).start() as any
          }
        />
      </Route>
    </MemoryRouter>
  );

const text = (testId: string) => screen.getByTestId(testId).textContent;

beforeEach(() => {
  vi.mocked(fetchSplit).mockReset();
});

describe("SplitDetailContainer", () => {
  it("shows the split's amounts as dollars", async () => {
    vi.mocked(fetchSplit).mockResolvedValue(
      split(TransactionRequestStatus.pending, TransactionRequestStatus.pending)
    );
    renderAs("dina");

    await screen.findByTestId("split-detail");
    expect(fetchSplit).toHaveBeenCalledWith("s1");
    expect(text("split-description")).toBe("Dinner at Luigi's");
    expect(text("split-creator")).toBe("Split by Ted Parisian on Nov 12, 2026");
    expect(text("split-total")).toBe("$100.00");
    expect(text("split-self-share")).toBe("$40.00");
    expect(text("split-requested")).toBe("$60.00");
    expect(text("split-progress-text")).toBe("$0.00 of $60.00 collected · $60.00 pending");
    expect(screen.getByText("Ted Parisian's share")).toBeInTheDocument();
  });

  it("tells the creator it's their split and their share", async () => {
    vi.mocked(fetchSplit).mockResolvedValue(
      split(TransactionRequestStatus.pending, TransactionRequestStatus.pending)
    );
    renderAs("heath");

    await screen.findByTestId("split-detail");
    expect(text("split-creator")).toMatch(/^Split by you on/);
    expect(screen.getByText("Your share")).toBeInTheDocument();
  });

  it("counts a paid request as collected and grows the progress bar", async () => {
    vi.mocked(fetchSplit).mockResolvedValue(
      split(TransactionRequestStatus.accepted, TransactionRequestStatus.pending)
    );
    renderAs("heath");

    await screen.findByTestId("split-detail");
    expect(text("split-participant-status-dina")).toBe("Paid");
    expect(text("split-participant-status-arvilla")).toBe("Pending");
    expect(text("split-progress-text")).toBe("$35.50 of $60.00 collected · $24.50 pending");
    expect(screen.getByTestId("split-progress")).toHaveAttribute("aria-valuenow", "59");
  });

  it("shows a declined request as Declined, not collected", async () => {
    vi.mocked(fetchSplit).mockResolvedValue(
      split(TransactionRequestStatus.accepted, TransactionRequestStatus.rejected)
    );
    renderAs("heath");

    await screen.findByTestId("split-detail");
    expect(text("split-participant-status-arvilla")).toBe("Declined");
    expect(text("split-progress-text")).toBe("$35.50 of $60.00 collected · $24.50 declined");
    expect(screen.getByTestId("split-progress")).toHaveAttribute("aria-valuenow", "59");
  });

  it("links each participant to their request", async () => {
    vi.mocked(fetchSplit).mockResolvedValue(
      split(TransactionRequestStatus.pending, TransactionRequestStatus.pending)
    );
    renderAs("heath");

    await screen.findByTestId("split-detail");
    expect(screen.getByTestId("split-participant-dina")).toHaveAttribute(
      "href",
      "/transaction/t-dina"
    );
  });

  it.each([
    [404, "split-not-found", "Split not found."],
    [403, "split-no-access", "You don't have access to this split."],
  ])("answers a %i with a message", async (status, testId, message) => {
    vi.mocked(fetchSplit).mockRejectedValue({ response: { status, data: {} } });
    renderAs("heath");

    expect(await screen.findByTestId(testId)).toHaveTextContent(message);
    expect(screen.queryByTestId("split-detail")).toBeNull();
  });
});
