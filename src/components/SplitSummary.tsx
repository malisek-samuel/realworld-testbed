// Testbed addition: what a split looks like on its page (RWT-6): totals, a progress bar of collected
// against requested, and a row per participant with their status.

import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { format } from "date-fns";
import {
  Avatar,
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { SplitSummary as Summary } from "../models/split";
import { TransactionRequestStatus } from "../models/transaction";
import { formatAmount } from "../utils/transactionUtils";

const STATUS: Record<string, { label: string; color: "success" | "warning" | "error" }> = {
  [TransactionRequestStatus.accepted]: { label: "Paid", color: "success" },
  [TransactionRequestStatus.pending]: { label: "Pending", color: "warning" },
  [TransactionRequestStatus.rejected]: { label: "Declined", color: "error" },
};

export interface SplitSummaryProps {
  split: Summary;
  currentUserId?: string;
}

const SplitSummary: React.FC<SplitSummaryProps> = ({ split, currentUserId }) => {
  const requested = split.collected + split.outstanding + split.declined;
  const progress = requested > 0 ? Math.round((split.collected / requested) * 100) : 0;
  const creatorIsViewer = split.creator.id === currentUserId;

  return (
    <Box data-test="split-detail">
      <Typography variant="h5" component="h3" data-test="split-description">
        {split.description}
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom data-test="split-creator">
        Split by {creatorIsViewer ? "you" : split.creator.name} on{" "}
        {format(new Date(split.createdAt), "MMM d, yyyy")}
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={4} my={2}>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Total
          </Typography>
          <Typography variant="h6" data-test="split-total">
            {formatAmount(split.total)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            {creatorIsViewer ? "Your share" : `${split.creator.name}'s share`}
          </Typography>
          <Typography variant="h6" data-test="split-self-share">
            {formatAmount(split.selfShare)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            Requested
          </Typography>
          <Typography variant="h6" data-test="split-requested">
            {formatAmount(requested)}
          </Typography>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 8, borderRadius: 4 }}
        data-test="split-progress"
        aria-label="Collected"
      />
      <Typography variant="body2" sx={{ mt: 1 }} data-test="split-progress-text">
        {formatAmount(split.collected)} of {formatAmount(requested)} collected
        {split.outstanding > 0 && ` · ${formatAmount(split.outstanding)} pending`}
        {split.declined > 0 && ` · ${formatAmount(split.declined)} declined`}
      </Typography>

      <List data-test="split-participants">
        {split.participants.map((participant) => {
          const status = STATUS[participant.requestStatus] ?? STATUS.pending;
          return (
            <ListItem key={participant.transactionId} divider disablePadding>
              <ListItemButton
                // cast: @types/react-router-dom brings its own @types/react, which MUI can't match
                component={RouterLink as any}
                to={`/transaction/${participant.transactionId}`}
                data-test={`split-participant-${participant.userId}`}
              >
                <ListItemAvatar>
                  <Avatar src={participant.avatar} />
                </ListItemAvatar>
                <ListItemText
                  primary={participant.name}
                  secondary={formatAmount(participant.amount)}
                />
                <Chip
                  size="small"
                  label={status.label}
                  color={status.color}
                  variant={participant.requestStatus === "pending" ? "outlined" : "filled"}
                  data-test={`split-participant-status-${participant.userId}`}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SplitSummary;
