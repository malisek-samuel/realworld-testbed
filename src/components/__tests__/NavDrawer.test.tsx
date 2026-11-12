// Testbed addition: the side menu's admin parts: the badge (RWT-1) and the Admin item (RWT-4).

import React from "react";
import { describe, expect, it } from "vitest";
import { configure, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createMachine, interpret } from "xstate";
import NavDrawer from "../NavDrawer";
import { User, UserRole } from "../../models";

configure({ testIdAttribute: "data-test" });

// NavDrawer only reads the signed-in user from the auth service, so a one-state machine will do.
const authServiceFor = (user: Partial<User>) =>
  interpret(
    createMachine({
      id: "auth",
      context: { user },
      initial: "authorized",
      states: { authorized: {} },
    })
  ).start() as any;

const renderFor = (user: Partial<User>) =>
  render(
    <MemoryRouter>
      <NavDrawer
        authService={authServiceFor(user)}
        drawerOpen={true}
        toggleDrawer={() => {}}
        closeMobileDrawer={() => {}}
      />
    </MemoryRouter>
  );

const user = { firstName: "Ted", lastName: "Parisian", username: "Heath93", balance: 0 };

describe("NavDrawer", () => {
  it("shows the Admin badge to an admin", () => {
    renderFor({ ...user, role: UserRole.admin });

    expect(screen.getByTestId("sidenav-admin-badge")).toHaveTextContent("Admin");
  });

  it("shows no Admin badge to a user", () => {
    renderFor({ ...user, role: UserRole.user });

    expect(screen.queryByTestId("sidenav-admin-badge")).toBeNull();
  });

  it("shows the Admin item, linking to /admin, to an admin", () => {
    renderFor({ ...user, role: UserRole.admin });

    expect(screen.getByTestId("sidenav-admin")).toHaveAttribute("href", "/admin");
  });

  it("shows no Admin item to a user", () => {
    renderFor({ ...user, role: UserRole.user });

    expect(screen.queryByTestId("sidenav-admin")).toBeNull();
  });
});
