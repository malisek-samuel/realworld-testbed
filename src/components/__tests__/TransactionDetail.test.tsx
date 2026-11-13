// Testbed addition: the transaction page's link to its split (RWT-6).

import React from "react";
import { describe, expect, it } from "vitest";
import { configure, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TransactionDetail from "../TransactionDetail";
import { TransactionResponseItem, User } from "../../models";

configure({ testIdAttribute: "data-test" });

const request = (splitId?: string) =>
  ({
    id: "t1",
    uuid: "u1",
    source: "",
    amount: 3333,
    description: "Dinner at Luigi's",
    privacyLevel: "public",
    senderId: "heath",
    receiverId: "dina",
    status: "pending",
    requestStatus: "pending",
    splitId,
    createdAt: new Date("2026-11-12"),
    modifiedAt: new Date("2026-11-12"),
    likes: [],
    comments: [],
    senderName: "Ted Parisian",
    senderAvatar: "",
    receiverName: "Darrel Ortiz",
    receiverAvatar: "",
  }) as unknown as TransactionResponseItem;

const renderFor = (transaction: TransactionResponseItem, viewerId: string) =>
  render(
    <MemoryRouter>
      <TransactionDetail
        transaction={transaction}
        transactionLike={() => {}}
        transactionComment={() => {}}
        transactionUpdate={() => {}}
        currentUser={{ id: viewerId } as User}
      />
    </MemoryRouter>
  );

describe("TransactionDetail, split link", () => {
  it.each(["heath", "dina"])("links a split's request to the split for %s", (viewer) => {
    renderFor(request("s1"), viewer);

    expect(screen.getByTestId("transaction-split-link")).toHaveTextContent("Part of a split");
    expect(screen.getByRole("link", { name: "View split" })).toHaveAttribute("href", "/splits/s1");
  });

  it("shows no link to someone outside the request", () => {
    renderFor(request("s1"), "reyes");

    expect(screen.queryByTestId("transaction-split-link")).toBeNull();
  });

  it("shows no link on a request that isn't part of a split", () => {
    renderFor(request(undefined), "dina");

    expect(screen.queryByTestId("transaction-split-link")).toBeNull();
  });
});
