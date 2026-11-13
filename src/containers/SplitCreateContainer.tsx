// Testbed addition: /splits/new (RWT-7). Finds people for the form, creates the split, and opens
// the split's page.

import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { useActor } from "@xstate/react";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { Paper, Typography } from "@mui/material";
import SplitCreateForm from "../components/SplitCreateForm";
import { SplitPayload } from "../models/split";
import { User } from "../models/user";
import { createSplit, fetchPeople } from "../utils/splitApi";
import { formatCents } from "../utils/splitUtils";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import {
  Severities,
  SnackbarContext,
  SnackbarEvents,
  SnackbarSchema,
} from "../machines/snackbarMachine";

export const PEOPLE_SEARCH_DEBOUNCE_MS = 250;

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

const SplitCreateContainer: React.FC<Props> = ({ authService, snackbarService }) => {
  const [authState] = useActor(authService);
  const [, sendSnackbar] = useActor(snackbarService);
  const history = useHistory();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<User[]>([]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      () => {
        fetchPeople(query.trim())
          .then((results) => current && setPeople(results))
          .catch(() => current && setPeople([]));
      },
      query ? PEOPLE_SEARCH_DEBOUNCE_MS : 0
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const submit = async (payload: SplitPayload) => {
    const split = await createSplit(payload);
    const requested = split.total - split.selfShare;
    const count = split.participants.length;
    const snackbar: SnackbarContext = {
      severity: Severities.success,
      message: `Split created: requested ${formatCents(requested)} from ${count} ${
        count === 1 ? "person" : "people"
      }`,
    };
    sendSnackbar({ type: "SHOW", ...snackbar });
    history.push(`/splits/${split.id}`);
  };

  return (
    <Paper sx={{ p: 2, minHeight: "90vh" }}>
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Split a bill
      </Typography>
      <SplitCreateForm
        people={people}
        currentUserId={authState?.context?.user?.id}
        onSearch={setQuery}
        onSubmit={submit}
      />
    </Paper>
  );
};

export default SplitCreateContainer;
