// Testbed addition: the admin console's statistics (RWT-4).

import React from "react";
import { Grid, Paper, Typography } from "@mui/material";
import { AdminStats as Stats } from "../models/admin";
import { formatAmount } from "../utils/transactionUtils";

const count = (n: number) => n.toLocaleString("en-US");

interface StatProps {
  id: string;
  label: string;
  value: string;
  detail?: string;
}

const Stat: React.FC<StatProps> = ({ id, label, value, detail }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }} data-test={`admin-stat-${id}`}>
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h5" component="p" data-test={`admin-stat-${id}-value`}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="body2" color="textSecondary" data-test={`admin-stat-${id}-detail`}>
          {detail}
        </Typography>
      )}
    </Paper>
  </Grid>
);

const AdminStats: React.FC<{ stats: Stats }> = ({ stats }) => (
  <Grid container spacing={2} data-test="admin-stats">
    <Stat
      id="users"
      label="Users"
      value={count(stats.users.total)}
      detail={`${count(stats.users.suspended)} suspended`}
    />
    <Stat
      id="transactions"
      label="Transactions"
      value={count(stats.transactions.total)}
      detail={`${count(stats.transactions.payments)} payments · ${count(
        stats.transactions.requests
      )} requests`}
    />
    <Stat id="pending" label="Pending requests" value={count(stats.transactions.pendingRequests)} />
    <Stat
      id="volume"
      label="Volume"
      value={formatAmount(stats.volume)}
      detail="completed transactions"
    />
  </Grid>
);

export default AdminStats;
