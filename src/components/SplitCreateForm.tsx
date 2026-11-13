// Testbed addition: the form that creates a split (RWT-7). It previews every share with planSplit,
// the function the API uses, and enables Request only when the API would accept the split.

import React, { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Cancel as CancelIcon } from "@mui/icons-material";
import { User } from "../models/user";
import { SplitMode, SplitPayload } from "../models/split";
import { formatCents, MAX_PARTICIPANTS, planSplit, toCents } from "../utils/splitUtils";
import { errorMessages } from "../utils/splitApi";

const SUM_ERROR = "The amounts add up"; // shown as the "left to assign" line instead

export interface SplitCreateFormProps {
  people: User[];
  currentUserId?: string;
  onSearch: (q: string) => void;
  onSubmit: (payload: SplitPayload) => Promise<void>;
}

const dollarsInput = (testId: string) => ({
  inputMode: "decimal" as const,
  "data-test": testId,
});

const SplitCreateForm: React.FC<SplitCreateFormProps> = ({
  people,
  currentUserId,
  onSearch,
  onSubmit,
}) => {
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [includeSelf, setIncludeSelf] = useState(true);
  const [mode, setMode] = useState<SplitMode>(SplitMode.equal);
  const [picked, setPicked] = useState<User[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selfAmount, setSelfAmount] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  const custom = mode === SplitMode.custom;
  const payload: SplitPayload = {
    description: description.trim(),
    total: total.trim(),
    mode,
    includeSelf,
    ...(custom && includeSelf ? { selfAmount: selfAmount.trim() } : {}),
    participants: picked.map((person) =>
      custom
        ? { userId: person.id, amount: (amounts[person.id] ?? "").trim() }
        : { userId: person.id }
    ),
  };
  const plan = planSplit(payload);
  const canSubmit = !submitting && payload.description !== "" && plan.errors.length === 0;
  const started = total.trim() !== "" && picked.length > 0;
  const problems = plan.errors.filter((error) => !error.startsWith(SUM_ERROR));

  const full = picked.length >= MAX_PARTICIPANTS;
  const candidates = people
    .filter((person) => person.id !== currentUserId)
    .filter((person) => !picked.some((p) => p.id === person.id))
    .slice(0, 8);

  const totalCents = toCents(total.trim());
  const assigned =
    picked.reduce((sum, person) => sum + (toCents(amounts[person.id]?.trim()) ?? 0), 0) +
    (includeSelf ? (toCents(selfAmount.trim()) ?? 0) : 0);
  const remaining = totalCents === undefined ? undefined : totalCents - assigned;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setApiErrors([]);
    try {
      await onSubmit(payload);
    } catch (error) {
      setApiErrors(errorMessages(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} noValidate data-test="split-create-form">
      <TextField
        label="Description"
        placeholder="Dinner at Luigi's"
        fullWidth
        margin="dense"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        inputProps={{ "data-test": "split-create-description" }}
      />
      <TextField
        label="Total"
        fullWidth
        margin="dense"
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
        inputProps={dollarsInput("split-create-total")}
      />

      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        People ({picked.length}/{MAX_PARTICIPANTS})
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={1} my={1} data-test="split-create-picked">
        {picked.map((person) => (
          <Chip
            key={person.id}
            avatar={<Avatar src={person.avatar} />}
            label={`${person.firstName} ${person.lastName}`}
            onDelete={() => setPicked(picked.filter((p) => p.id !== person.id))}
            deleteIcon={<CancelIcon data-test={`split-create-unpick-${person.username}`} />}
            data-test={`split-create-chip-${person.username}`}
          />
        ))}
      </Box>
      <TextField
        size="small"
        fullWidth
        placeholder="Search people by name, username, email or phone"
        value={search}
        disabled={full}
        helperText={full ? `You can pick up to ${MAX_PARTICIPANTS} people` : undefined}
        onChange={(e) => {
          setSearch(e.target.value);
          onSearch(e.target.value);
        }}
        inputProps={{ "data-test": "split-create-search" }}
      />
      <List dense data-test="split-create-people">
        {candidates.map((person) => (
          <ListItem key={person.id} disablePadding>
            <ListItemButton
              disabled={full}
              onClick={() => setPicked([...picked, person])}
              data-test={`split-create-person-${person.username}`}
            >
              <ListItemAvatar>
                <Avatar src={person.avatar} />
              </ListItemAvatar>
              <ListItemText
                primary={`${person.firstName} ${person.lastName}`}
                secondary={`@${person.username}`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} my={1}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, value: SplitMode | null) => value && setMode(value)}
        >
          <ToggleButton value={SplitMode.equal} data-test="split-create-mode-equal">
            Equal
          </ToggleButton>
          <ToggleButton value={SplitMode.custom} data-test="split-create-mode-custom">
            Custom
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          label="Include me"
          control={
            <Switch
              checked={includeSelf}
              onChange={(e) => setIncludeSelf(e.target.checked)}
              inputProps={{ "data-test": "split-create-include-self" } as any}
            />
          }
        />
      </Box>

      {custom && (
        <Box data-test="split-create-amounts">
          {includeSelf && (
            <TextField
              label="You"
              size="small"
              margin="dense"
              fullWidth
              value={selfAmount}
              onChange={(e) => setSelfAmount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={dollarsInput("split-create-self-amount")}
            />
          )}
          {picked.map((person) => (
            <TextField
              key={person.id}
              label={`${person.firstName} ${person.lastName}`}
              size="small"
              margin="dense"
              fullWidth
              value={amounts[person.id] ?? ""}
              onChange={(e) => setAmounts({ ...amounts, [person.id]: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={dollarsInput(`split-create-amount-${person.username}`)}
            />
          ))}
          {remaining !== undefined && picked.length > 0 && (
            <Typography
              variant="body2"
              color={remaining === 0 ? "success.main" : "warning.main"}
              data-test="split-create-remaining"
            >
              {remaining === 0
                ? "The amounts add up to the total"
                : remaining > 0
                  ? `${formatCents(remaining)} left to assign`
                  : `${formatCents(-remaining)} over the total`}
            </Typography>
          )}
        </Box>
      )}

      {!custom && plan.errors.length === 0 && (
        <List dense data-test="split-create-preview">
          {includeSelf && (
            <ListItem data-test="split-create-share-self">
              <ListItemText primary="You" secondary={formatCents(plan.selfShare)} />
            </ListItem>
          )}
          {picked.map((person, i) => (
            <ListItem key={person.id} data-test={`split-create-share-${person.username}`}>
              <ListItemText
                primary={`${person.firstName} ${person.lastName}`}
                secondary={formatCents(plan.shares[i].amount)}
              />
            </ListItem>
          ))}
        </List>
      )}

      {started && problems.length > 0 && (
        <Box data-test="split-create-problems" my={1}>
          {problems.map((problem) => (
            <Typography key={problem} variant="body2" color="warning.main">
              {problem}
            </Typography>
          ))}
        </Box>
      )}
      {apiErrors.length > 0 && (
        <Alert severity="error" sx={{ my: 1 }} data-test="split-create-error">
          {apiErrors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={!canSubmit}
        sx={{ mt: 2 }}
        data-test="split-create-submit"
      >
        Request
      </Button>
    </Box>
  );
};

export default SplitCreateForm;
