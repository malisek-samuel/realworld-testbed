// Testbed addition: the top bar's Split button (RWT-7).

import React from "react";
import { describe, expect, it } from "vitest";
import { configure, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createMachine, interpret } from "xstate";
import NavBar from "../NavBar";

configure({ testIdAttribute: "data-test" });

const notificationsService = () =>
  interpret(
    createMachine({
      id: "notifications",
      context: { results: [] },
      initial: "idle",
      states: { idle: {} },
    })
  ).start() as any;

describe("NavBar", () => {
  it("has a Split button that opens /splits/new, next to New", () => {
    render(
      <MemoryRouter>
        <NavBar
          drawerOpen={true}
          toggleDrawer={() => {}}
          notificationsService={notificationsService()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-top-split")).toHaveAttribute("href", "/splits/new");
    expect(screen.getByTestId("nav-top-split")).toHaveTextContent("Split");
    expect(screen.getByTestId("nav-top-new-transaction")).toHaveAttribute(
      "href",
      "/transaction/new"
    );
  });
});
