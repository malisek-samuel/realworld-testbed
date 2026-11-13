// Testbed addition: the admin console's table of users (RWT-4). Each user who isn't an admin has a
// Suspend or Reactivate button; the container asks for confirmation before anything changes.

import React from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AdminUser } from "../models/admin";
import { UserStatus } from "../models/user";
import { formatAmount } from "../utils/transactionUtils";
import { isAdmin, isSuspended } from "../utils/roleUtils";

export interface AdminUsersTableProps {
  users: AdminUser[];
  onChangeStatus: (user: AdminUser, status: UserStatus) => void;
}

const AdminUsersTable: React.FC<AdminUsersTableProps> = ({ users, onChangeStatus }) => (
  <TableContainer>
    <Table size="small" data-test="admin-users-table">
      <TableHead>
        <TableRow>
          <TableCell>User</TableCell>
          <TableCell>Email</TableCell>
          <TableCell align="right">Balance</TableCell>
          <TableCell align="right">Transactions</TableCell>
          <TableCell>Status</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} data-test="admin-users-empty">
              No users match.
            </TableCell>
          </TableRow>
        )}
        {users.map((user) => {
          const suspended = isSuspended(user);
          return (
            <TableRow key={user.id} data-test={`admin-user-row-${user.username}`}>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Avatar src={user.avatar} sx={{ width: 32, height: 32 }} />
                  <Box>
                    <Typography variant="body2" component="div">
                      {user.firstName} {user.lastName}
                      {isAdmin(user) && (
                        <Chip
                          label="Admin"
                          size="small"
                          color="primary"
                          sx={{ ml: 1, height: 18 }}
                          data-test={`admin-user-role-${user.username}`}
                        />
                      )}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      @{user.username}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell align="right">{formatAmount(user.balance)}</TableCell>
              <TableCell align="right">{user.transactionCount}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={suspended ? "Suspended" : "Active"}
                  color={suspended ? "error" : "success"}
                  variant={suspended ? "filled" : "outlined"}
                  data-test={`admin-user-status-${user.username}`}
                />
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {!isAdmin(user) &&
                  (suspended ? (
                    <Button
                      size="small"
                      onClick={() => onChangeStatus(user, UserStatus.active)}
                      data-test={`admin-user-reactivate-${user.username}`}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onChangeStatus(user, UserStatus.suspended)}
                      data-test={`admin-user-suspend-${user.username}`}
                    >
                      Suspend
                    </Button>
                  ))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

export default AdminUsersTable;
