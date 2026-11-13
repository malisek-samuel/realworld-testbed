// Testbed addition: the admin console at /admin (RWT-4). Statistics, then the users with search,
// a status filter and pages; suspending or reactivating asks for confirmation first. A user who
// isn't an admin gets a no-access message and the page requests nothing.

import React, { useEffect, useState } from "react";
import { useActor } from "@xstate/react";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Pagination,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AdminStatsCards from "../components/AdminStats";
import AdminUsersTable from "../components/AdminUsersTable";
import { AdminStats, AdminUser } from "../models/admin";
import { UserStatus } from "../models/user";
import { isAdmin } from "../utils/roleUtils";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import {
  Severities,
  SnackbarContext,
  SnackbarEvents,
  SnackbarSchema,
} from "../machines/snackbarMachine";
import {
  apiErrorMessage,
  fetchAdminStats,
  fetchAdminUsers,
  setUserStatus,
} from "../utils/adminApi";

export const PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 300;

type StatusFilter = "all" | UserStatus;

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  snackbarService: Interpreter<
    SnackbarContext,
    SnackbarSchema,
    SnackbarEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, SnackbarEvents, BaseActionObject, ServiceMap>
  >;
}

const AdminContainer: React.FC<Props> = ({ authService, snackbarService }) => {
  const [authState] = useActor(authService);
  const [, sendSnackbar] = useActor(snackbarService);
  const allowed = isAdmin(authState?.context?.user);
  const showSnackbar = (payload: SnackbarContext) => sendSnackbar({ type: "SHOW", ...payload });

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>();
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<AdminStats>();
  const [reloads, setReloads] = useState(0);
  const [pending, setPending] = useState<{ user: AdminUser; status: UserStatus }>();
  const [saving, setSaving] = useState(false);

  const showError = (error: unknown) =>
    showSnackbar({ severity: Severities.error, message: apiErrorMessage(error) });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!allowed) return;
    let current = true;
    Promise.all([
      fetchAdminUsers({
        q: q || undefined,
        status: status === "all" ? undefined : status,
        page,
        limit: PAGE_SIZE,
      }),
      fetchAdminStats(),
    ])
      .then(([usersPage, newStats]) => {
        if (!current) return;
        setUsers(usersPage.results);
        setTotalPages(Math.max(1, usersPage.pageData.totalPages));
        setStats(newStats);
      })
      .catch((error) => current && showError(error));
    return () => {
      current = false;
    };
    // showError is left out on purpose: it only wraps the snackbar service, which doesn't change
  }, [allowed, q, status, page, reloads]);

  const confirm = async () => {
    if (!pending) return;
    const { user, status: newStatus } = pending;
    setSaving(true);
    try {
      await setUserStatus(user.id, newStatus);
      showSnackbar({
        severity: Severities.success,
        message: `${newStatus === UserStatus.suspended ? "Suspended" : "Reactivated"} @${
          user.username
        }`,
      });
      setReloads((n) => n + 1);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
      setPending(undefined);
    }
  };

  if (!allowed) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography data-test="admin-no-access">You don't have access to this page.</Typography>
      </Paper>
    );
  }

  const suspending = pending?.status === UserStatus.suspended;

  return (
    <Paper sx={{ p: 2, minHeight: "90vh" }} data-test="admin-console">
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Admin
      </Typography>
      {stats && <AdminStatsCards stats={stats} />}

      <Box display="flex" flexWrap="wrap" gap={2} alignItems="center" mt={3} mb={1}>
        <TextField
          size="small"
          placeholder="Search name, username or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ "data-test": "admin-users-search" }}
          sx={{ minWidth: 280 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, value: StatusFilter | null) => {
            if (!value) return;
            setStatus(value);
            setPage(1);
          }}
          data-test="admin-users-status-filter"
        >
          <ToggleButton value="all" data-test="admin-users-status-all">
            All
          </ToggleButton>
          <ToggleButton value={UserStatus.active} data-test="admin-users-status-active">
            Active
          </ToggleButton>
          <ToggleButton value={UserStatus.suspended} data-test="admin-users-status-suspended">
            Suspended
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {users && (
        <AdminUsersTable
          users={users}
          onChangeStatus={(user, newStatus) => setPending({ user, status: newStatus })}
        />
      )}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            data-test="admin-users-pagination"
          />
        </Box>
      )}

      {pending && (
        <Dialog open onClose={() => setPending(undefined)} data-test="admin-confirm-dialog">
          <DialogTitle>
            {suspending ? "Suspend" : "Reactivate"} {pending.user.firstName} {pending.user.lastName}
            ?
          </DialogTitle>
          <DialogContent>
            <DialogContentText data-test="admin-confirm-text">
              {suspending
                ? `@${pending.user.username} will be signed out, and can't sign in, be paid or be found until you reactivate the account.`
                : `@${pending.user.username} will be able to sign in, be found and receive payments again.`}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPending(undefined)} data-test="admin-confirm-cancel">
              Cancel
            </Button>
            <Button
              variant="contained"
              color={suspending ? "error" : "primary"}
              disabled={saving}
              onClick={confirm}
              data-test="admin-confirm-submit"
            >
              {suspending ? "Suspend" : "Reactivate"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default AdminContainer;
