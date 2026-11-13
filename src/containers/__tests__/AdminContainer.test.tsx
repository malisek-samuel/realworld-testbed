// Testbed addition: the admin console page (RWT-4), with the admin API mocked.

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMachine, interpret } from "xstate";
import AdminContainer from "../AdminContainer";
import { fetchAdminStats, fetchAdminUsers, setUserStatus } from "../../utils/adminApi";
import { AdminStats, AdminUser } from "../../models/admin";
import { User, UserRole, UserStatus } from "../../models/user";

vi.mock("../../utils/adminApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/adminApi")>()),
  fetchAdminUsers: vi.fn(),
  fetchAdminStats: vi.fn(),
  setUserStatus: vi.fn(),
}));

configure({ testIdAttribute: "data-test" });

const listed = (overrides: Partial<AdminUser>): AdminUser => ({
  id: "id",
  username: "username",
  firstName: "First",
  lastName: "Last",
  email: "someone@example.com",
  phoneNumber: "555-0100",
  avatar: "",
  balance: 1000,
  createdAt: new Date("2023-01-01"),
  role: UserRole.user,
  status: UserStatus.active,
  transactionCount: 3,
  ...overrides,
});

const users = [
  listed({
    id: "a1",
    username: "admin",
    firstName: "Avery",
    lastName: "Admin",
    role: UserRole.admin,
  }),
  listed({ id: "d1", username: "Dina20", firstName: "Darrel", lastName: "Ortiz" }),
  listed({ id: "h1", username: "Heath93", status: UserStatus.suspended }),
];

const stats: AdminStats = {
  users: { total: 3, admins: 1, suspended: 1 },
  transactions: { total: 600, payments: 350, requests: 250, pendingRequests: 42 },
  volume: 1234567,
};

let snackbar: any[];

const authServiceFor = (user: Partial<User>) =>
  interpret(
    createMachine({
      id: "auth",
      context: { user },
      initial: "authorized",
      states: { authorized: {} },
    })
  ).start() as any;

const snackbarService = () =>
  interpret(
    createMachine({
      id: "snackbar",
      initial: "idle",
      states: {
        idle: { on: { SHOW: { actions: (_: unknown, event: any) => snackbar.push(event) } } },
      },
    })
  ).start() as any;

const renderAs = (role: UserRole) =>
  render(
    <AdminContainer
      authService={authServiceFor({ username: "admin", role })}
      snackbarService={snackbarService()}
    />
  );

const lastUsersQuery = () => vi.mocked(fetchAdminUsers).mock.lastCall?.[0];

beforeEach(() => {
  snackbar = [];
  vi.mocked(fetchAdminUsers)
    .mockReset()
    .mockResolvedValue({
      pageData: { page: 1, limit: 10, hasNextPages: false, totalPages: 1 },
      results: users,
    });
  vi.mocked(fetchAdminStats).mockReset().mockResolvedValue(stats);
  vi.mocked(setUserStatus).mockReset().mockResolvedValue(users[1]);
});

describe("AdminContainer", () => {
  it("tells a user who isn't an admin they have no access, and requests nothing", async () => {
    renderAs(UserRole.user);

    expect(screen.getByTestId("admin-no-access")).toHaveTextContent(
      "You don't have access to this page"
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchAdminUsers).not.toHaveBeenCalled();
    expect(fetchAdminStats).not.toHaveBeenCalled();
  });

  it("shows the statistics and the users", async () => {
    renderAs(UserRole.admin);

    await screen.findByTestId("admin-user-row-Dina20");
    expect(screen.getByTestId("admin-stat-users-value")).toHaveTextContent("3");
    expect(screen.getByTestId("admin-stat-users-detail")).toHaveTextContent("1 suspended");
    expect(screen.getByTestId("admin-stat-transactions-detail")).toHaveTextContent(
      "350 payments · 250 requests"
    );
    expect(screen.getByTestId("admin-stat-pending-value")).toHaveTextContent("42");
    expect(screen.getByTestId("admin-stat-volume-value")).toHaveTextContent("$12,345.67");
    expect(screen.getByTestId("admin-user-status-Dina20")).toHaveTextContent("Active");
    expect(screen.getByTestId("admin-user-status-Heath93")).toHaveTextContent("Suspended");
    expect(lastUsersQuery()).toEqual({ q: undefined, status: undefined, page: 1, limit: 10 });
  });

  it("offers Suspend to active users, Reactivate to suspended ones, nothing for admins", async () => {
    renderAs(UserRole.admin);

    await screen.findByTestId("admin-user-row-Dina20");
    expect(screen.getByTestId("admin-user-suspend-Dina20")).toBeInTheDocument();
    expect(screen.getByTestId("admin-user-reactivate-Heath93")).toBeInTheDocument();
    expect(screen.getByTestId("admin-user-role-admin")).toHaveTextContent("Admin");
    expect(screen.queryByTestId("admin-user-role-Dina20")).toBeNull();
    expect(screen.queryByTestId("admin-user-suspend-admin")).toBeNull();
    expect(screen.queryByTestId("admin-user-reactivate-admin")).toBeNull();
  });

  it("asks for confirmation, then suspends and reloads", async () => {
    renderAs(UserRole.admin);
    fireEvent.click(await screen.findByTestId("admin-user-suspend-Dina20"));

    expect(screen.getByTestId("admin-confirm-text")).toHaveTextContent("@Dina20");
    expect(setUserStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("admin-confirm-submit"));

    await waitFor(() => expect(fetchAdminUsers).toHaveBeenCalledTimes(2));
    expect(setUserStatus).toHaveBeenCalledWith("d1", UserStatus.suspended);
    expect(fetchAdminStats).toHaveBeenCalledTimes(2);
    expect(snackbar).toContainEqual(
      expect.objectContaining({ severity: "success", message: "Suspended @Dina20" })
    );
    expect(screen.queryByTestId("admin-confirm-dialog")).toBeNull();
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    renderAs(UserRole.admin);
    fireEvent.click(await screen.findByTestId("admin-user-reactivate-Heath93"));

    fireEvent.click(screen.getByTestId("admin-confirm-cancel"));

    expect(screen.queryByTestId("admin-confirm-dialog")).toBeNull();
    expect(setUserStatus).not.toHaveBeenCalled();
  });

  it("shows the API's error message", async () => {
    vi.mocked(setUserStatus).mockRejectedValue({
      response: { data: { error: "Admins can't be suspended" } },
    });
    renderAs(UserRole.admin);
    fireEvent.click(await screen.findByTestId("admin-user-suspend-Dina20"));

    fireEvent.click(screen.getByTestId("admin-confirm-submit"));

    await waitFor(() =>
      expect(snackbar).toContainEqual(
        expect.objectContaining({ severity: "error", message: "Admins can't be suspended" })
      )
    );
  });

  it("searches as the admin types", async () => {
    renderAs(UserRole.admin);
    await screen.findByTestId("admin-user-row-Dina20");

    fireEvent.change(screen.getByTestId("admin-users-search"), { target: { value: " ortiz " } });

    await waitFor(() => expect(lastUsersQuery()).toMatchObject({ q: "ortiz", page: 1 }));
  });

  it("filters by status", async () => {
    renderAs(UserRole.admin);
    await screen.findByTestId("admin-user-row-Dina20");

    fireEvent.click(screen.getByTestId("admin-users-status-suspended"));

    await waitFor(() => expect(lastUsersQuery()).toMatchObject({ status: "suspended", page: 1 }));
  });

  it("pages through the users", async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      pageData: { page: 1, limit: 10, hasNextPages: true, totalPages: 3 },
      results: users,
    });
    renderAs(UserRole.admin);
    await screen.findByTestId("admin-users-pagination");

    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));

    await waitFor(() => expect(lastUsersQuery()).toMatchObject({ page: 2 }));
  });
});
