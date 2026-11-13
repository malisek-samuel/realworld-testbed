// Testbed addition: the form that creates a split (RWT-7).

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SplitCreateForm from "../SplitCreateForm";
import { User } from "../../models/user";

configure({ testIdAttribute: "data-test" });

const person = (id: string, username: string, firstName: string, lastName: string) =>
  ({ id, username, firstName, lastName, avatar: "" }) as User;

const people = [
  person("heath", "Heath93", "Ted", "Parisian"),
  person("dina", "Dina20", "Darrel", "Ortiz"),
  person("arvilla", "Arvilla_Hegmann", "Kristian", "Bradtke"),
];
const crowd = Array.from({ length: 11 }, (_, i) => person(`p${i}`, `person${i}`, "Person", `${i}`));

const renderForm = (list: User[] = people, onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <SplitCreateForm people={list} currentUserId="heath" onSearch={vi.fn()} onSubmit={onSubmit} />
  );
  return { onSubmit };
};

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
const pick = (...usernames: string[]) =>
  usernames.forEach((u) => fireEvent.click(screen.getByTestId(`split-create-person-${u}`)));
const text = (testId: string) => screen.getByTestId(testId).textContent;
const submitButton = () => screen.getByTestId("split-create-submit");

const fillDinner = () => {
  type("split-create-description", "Dinner at Luigi's");
  type("split-create-total", "100");
  pick("Dina20", "Arvilla_Hegmann");
};

describe("SplitCreateForm, equal", () => {
  it("previews $33.34 for you and $33.33 for each person", () => {
    renderForm();

    fillDinner();

    expect(text("split-create-share-self")).toBe("You$33.34");
    expect(text("split-create-share-Dina20")).toBe("Darrel Ortiz$33.33");
    expect(text("split-create-share-Arvilla_Hegmann")).toBe("Kristian Bradtke$33.33");
    expect(submitButton()).toBeEnabled();
  });

  it("splits between the others only without Include me", () => {
    renderForm();
    fillDinner();

    fireEvent.click(screen.getByTestId("split-create-include-self"));

    expect(screen.queryByTestId("split-create-share-self")).toBeNull();
    expect(text("split-create-share-Dina20")).toBe("Darrel Ortiz$50.00");
  });

  it("needs a description", () => {
    renderForm();
    fillDinner();

    type("split-create-description", "  ");

    expect(submitButton()).toBeDisabled();
  });

  it("sends the split as the API expects it", async () => {
    const { onSubmit } = renderForm();
    fillDinner();

    fireEvent.click(submitButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      description: "Dinner at Luigi's",
      total: "100",
      mode: "equal",
      includeSelf: true,
      participants: [{ userId: "dina" }, { userId: "arvilla" }],
    });
  });
});

describe("SplitCreateForm, custom", () => {
  const fillCustom = (dina: string, arvilla: string) => {
    fillDinner();
    fireEvent.click(screen.getByTestId("split-create-mode-custom"));
    type("split-create-self-amount", "40");
    type("split-create-amount-Dina20", dina);
    type("split-create-amount-Arvilla_Hegmann", arvilla);
  };

  it("keeps Request disabled and shows the difference until the amounts add up", () => {
    renderForm();

    fillCustom("35.50", "24.49");
    expect(text("split-create-remaining")).toBe("$0.01 left to assign");
    expect(submitButton()).toBeDisabled();

    type("split-create-amount-Arvilla_Hegmann", "30");
    expect(text("split-create-remaining")).toBe("$5.50 over the total");
    expect(submitButton()).toBeDisabled();

    type("split-create-amount-Arvilla_Hegmann", "24.50");
    expect(text("split-create-remaining")).toBe("The amounts add up to the total");
    expect(submitButton()).toBeEnabled();
  });

  it("sends every amount", async () => {
    const { onSubmit } = renderForm();
    fillCustom("35.50", "24.50");

    fireEvent.click(submitButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      mode: "custom",
      selfAmount: "40",
      participants: [
        { userId: "dina", amount: "35.50" },
        { userId: "arvilla", amount: "24.50" },
      ],
    });
  });
});

describe("SplitCreateForm, people", () => {
  it("never lists the signed-in user", () => {
    renderForm();

    expect(screen.queryByTestId("split-create-person-Heath93")).toBeNull();
  });

  it("takes a picked person off the list, and puts them back when removed", () => {
    renderForm();
    fillDinner();

    expect(screen.queryByTestId("split-create-person-Dina20")).toBeNull();
    fireEvent.click(screen.getByTestId("split-create-unpick-Dina20"));

    expect(screen.queryByTestId("split-create-chip-Dina20")).toBeNull();
    expect(screen.getByTestId("split-create-person-Dina20")).toBeInTheDocument();
    expect(screen.queryByTestId("split-create-share-Dina20")).toBeNull();
    expect(text("split-create-share-self")).toBe("You$50.00");
  });

  it("stops at 10 people", () => {
    renderForm(crowd);

    pick(...crowd.slice(0, 7).map((p) => p.username));
    pick(...crowd.slice(7, 10).map((p) => p.username));

    expect(screen.getByTestId("split-create-search")).toBeDisabled();
    expect(screen.getByTestId("split-create-person-person10")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

describe("SplitCreateForm, errors from the API", () => {
  it("shows them and keeps what was entered", async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      response: { status: 422, data: { errors: [{ msg: "@Dina20's account is suspended" }] } },
    });
    renderForm(people, onSubmit);
    fillDinner();

    fireEvent.click(submitButton());

    expect(await screen.findByTestId("split-create-error")).toHaveTextContent(
      "@Dina20's account is suspended"
    );
    expect(screen.getByTestId("split-create-description")).toHaveValue("Dinner at Luigi's");
    expect(screen.getByTestId("split-create-chip-Dina20")).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });
});
