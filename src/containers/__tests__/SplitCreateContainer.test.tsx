// Testbed addition: /splits/new (RWT-7), with the split API mocked.

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { createMachine, interpret } from "xstate";
import SplitCreateContainer from "../SplitCreateContainer";
import { createSplit, fetchPeople } from "../../utils/splitApi";
import { SplitMode, SplitSummary } from "../../models/split";
import { TransactionRequestStatus } from "../../models/transaction";
import { User } from "../../models/user";

vi.mock("../../utils/splitApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/splitApi")>()),
  fetchPeople: vi.fn(),
  createSplit: vi.fn(),
}));

configure({ testIdAttribute: "data-test" });

const people = [
  { id: "dina", username: "Dina20", firstName: "Darrel", lastName: "Ortiz", avatar: "" },
  { id: "arvilla", username: "Arvilla_Hegmann", firstName: "Kristian", lastName: "Bradtke" },
] as User[];

const created: SplitSummary = {
  id: "s1",
  description: "Dinner at Luigi's",
  mode: SplitMode.equal,
  createdAt: new Date(),
  creator: { id: "heath", name: "Ted Parisian", avatar: "" },
  total: 10000,
  selfShare: 3334,
  participants: people.map((p) => ({
    userId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    avatar: "",
    amount: 3333,
    transactionId: `t-${p.id}`,
    requestStatus: TransactionRequestStatus.pending,
  })),
  collected: 0,
  outstanding: 6666,
  declined: 0,
};

let snackbar: any[];
let location: string;

const stub = (context: object, onShow?: (event: any) => void) =>
  interpret(
    createMachine({
      id: "stub",
      context,
      initial: "on",
      states: { on: { on: { SHOW: { actions: (_: unknown, event: any) => onShow?.(event) } } } },
    })
  ).start() as any;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/splits/new"]}>
      <SplitCreateContainer
        authService={stub({ user: { id: "heath" } })}
        snackbarService={stub({}, (event) => snackbar.push(event))}
      />
      <Route
        path="*"
        render={({ location: current }) => {
          location = current.pathname;
          return null;
        }}
      />
    </MemoryRouter>
  );

beforeEach(() => {
  snackbar = [];
  location = "";
  vi.mocked(fetchPeople).mockReset().mockResolvedValue(people);
  vi.mocked(createSplit).mockReset().mockResolvedValue(created);
});

describe("SplitCreateContainer", () => {
  it("lists the people to pick from", async () => {
    renderPage();

    expect(await screen.findByTestId("split-create-person-Dina20")).toBeInTheDocument();
    expect(fetchPeople).toHaveBeenCalledWith("");
  });

  it("searches as the user types", async () => {
    renderPage();
    await screen.findByTestId("split-create-person-Dina20");

    fireEvent.change(screen.getByTestId("split-create-search"), { target: { value: "ortiz" } });

    await waitFor(() => expect(fetchPeople).toHaveBeenLastCalledWith("ortiz"));
  });

  it("creates the split, says so, and opens its page", async () => {
    renderPage();
    fireEvent.change(screen.getByTestId("split-create-description"), {
      target: { value: "Dinner at Luigi's" },
    });
    fireEvent.change(screen.getByTestId("split-create-total"), { target: { value: "100" } });
    fireEvent.click(await screen.findByTestId("split-create-person-Dina20"));
    fireEvent.click(screen.getByTestId("split-create-person-Arvilla_Hegmann"));

    fireEvent.click(screen.getByTestId("split-create-submit"));

    await waitFor(() => expect(location).toBe("/splits/s1"));
    expect(createSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        total: "100",
        participants: [{ userId: "dina" }, { userId: "arvilla" }],
      })
    );
    expect(snackbar).toContainEqual(
      expect.objectContaining({ message: "Split created: requested $66.66 from 2 people" })
    );
  });
});
