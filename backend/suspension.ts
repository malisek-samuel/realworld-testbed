// Testbed addition: what a suspended account can't do (RWT-3). Signing in and staying signed in
// are refused in backend/auth.ts; being listed in backend/user-routes.ts.

import { NextFunction, Request, Response } from "express";
import { getUserById } from "./database";
import { isSuspended } from "../src/utils/roleUtils";

// POST /transactions: a suspended account can't be paid or asked for money.
export const rejectSuspendedReceiver = (req: Request, res: Response, next: NextFunction) => {
  const receiver = getUserById(req.body.receiverId);
  if (isSuspended(receiver)) {
    res.status(422).json({ error: "Receiver account is suspended" });
    return;
  }
  next();
};
