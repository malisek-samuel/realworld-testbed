// Testbed addition: the split page at /splits/:splitId (RWT-6). It loads the split and shows it, or
// says the split doesn't exist or isn't the viewer's to see.

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useActor } from "@xstate/react";
import { Interpreter } from "xstate";
import { CircularProgress, Paper, Typography } from "@mui/material";
import SplitSummaryView from "../components/SplitSummary";
import { SplitSummary } from "../models/split";
import { errorMessages, errorStatus, fetchSplit } from "../utils/splitApi";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
}

type Load =
  | { state: "loading" }
  | { state: "loaded"; split: SplitSummary }
  | { state: "notFound" }
  | { state: "forbidden" }
  | { state: "failed"; message: string };

const SplitDetailContainer: React.FC<Props> = ({ authService }) => {
  const [authState] = useActor(authService);
  const { splitId } = useParams<{ splitId: string }>();
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let current = true;
    setLoad({ state: "loading" });
    fetchSplit(splitId)
      .then((split) => current && setLoad({ state: "loaded", split }))
      .catch((error) => {
        if (!current) return;
        const status = errorStatus(error);
        if (status === 404) setLoad({ state: "notFound" });
        else if (status === 403) setLoad({ state: "forbidden" });
        else setLoad({ state: "failed", message: errorMessages(error)[0] });
      });
    return () => {
      current = false;
    };
  }, [splitId]);

  return (
    <Paper sx={{ p: 2, minHeight: "90vh" }}>
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Split
      </Typography>
      {load.state === "loading" && <CircularProgress size={24} data-test="split-loading" />}
      {load.state === "loaded" && (
        <SplitSummaryView split={load.split} currentUserId={authState?.context?.user?.id} />
      )}
      {load.state === "notFound" && (
        <Typography data-test="split-not-found">Split not found.</Typography>
      )}
      {load.state === "forbidden" && (
        <Typography data-test="split-no-access">You don't have access to this split.</Typography>
      )}
      {load.state === "failed" && (
        <Typography color="error" data-test="split-error">
          {load.message}
        </Typography>
      )}
    </Paper>
  );
};

export default SplitDetailContainer;
