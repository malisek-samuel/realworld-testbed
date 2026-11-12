///<reference path="types.ts" />
// Testbed addition: splitting a bill (RWT-5). POST /splits creates one request per participant, all
// or nothing; GET /splits/:splitId shows who has paid, to the creator and the participants only.

import express, { Response } from "express";
import { body } from "express-validator";
import { createSplit, getSplitById, getTransactionById, getUserById } from "./database";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { planSplit } from "../src/utils/splitUtils";
import { isSuspended } from "../src/utils/roleUtils";
import { formatFullName } from "../src/utils/transactionUtils";
import { Transaction, TransactionRequestStatus, User } from "../src/models";
import {
  Split,
  SplitMode,
  SplitParticipantSummary,
  SplitPayload,
  SplitSummary,
} from "../src/models/split";

const unprocessable = (res: Response, messages: string[]) =>
  res.status(422).json({ errors: messages.map((msg) => ({ msg })) });

export const summarizeSplit = (split: Split): SplitSummary => {
  const creator: User = getUserById(split.creatorId);
  const transactions: Transaction[] = split.transactionIds
    .map((id) => getTransactionById(id))
    .filter(Boolean);

  const participants: SplitParticipantSummary[] = transactions.map((transaction) => {
    const user: User = getUserById(transaction.receiverId);
    return {
      userId: transaction.receiverId,
      name: formatFullName(user),
      avatar: user.avatar,
      amount: transaction.amount,
      transactionId: transaction.id,
      requestStatus: transaction.requestStatus as TransactionRequestStatus,
    };
  });
  const sumOf = (status: TransactionRequestStatus) =>
    participants
      .filter((participant) => participant.requestStatus === status)
      .reduce((total, participant) => total + participant.amount, 0);

  return {
    id: split.id,
    description: split.description,
    mode: split.mode,
    createdAt: split.createdAt,
    creator: { id: creator.id, name: formatFullName(creator), avatar: creator.avatar },
    total: split.total,
    selfShare: split.selfShare,
    participants,
    collected: sumOf(TransactionRequestStatus.accepted),
    outstanding: sumOf(TransactionRequestStatus.pending),
    declined: sumOf(TransactionRequestStatus.rejected),
  };
};

const router = express.Router();

//POST /splits - request money from several people at once
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware([
    body("description").isString().trim().notEmpty().withMessage("Enter a description"),
    body("mode").isIn(Object.values(SplitMode)).withMessage("Choose an equal or a custom split"),
    body("includeSelf").optional().isBoolean().toBoolean(),
    body("participants").isArray().withMessage("Pick at least one person"),
    body("participants.*.userId").isString(),
  ]),
  (req, res) => {
    const creatorId = req.user?.id!;
    const payload = req.body as SplitPayload;

    const plan = planSplit(payload);
    if (plan.errors.length > 0) return unprocessable(res, plan.errors);

    const problems: string[] = [];
    for (const { userId } of plan.shares) {
      const user: User | undefined = getUserById(userId);
      if (userId === creatorId) problems.push("You can't request money from yourself");
      else if (!user) problems.push(`There's no user with the ID ${userId}`);
      else if (isSuspended(user)) problems.push(`@${user.username}'s account is suspended`);
    }
    if (problems.length > 0) return unprocessable(res, problems);

    const split = createSplit(creatorId, {
      description: payload.description,
      mode: payload.mode,
      total: plan.total,
      selfShare: plan.selfShare,
      shares: plan.shares,
    });

    res.status(201).json({ split: summarizeSplit(split) });
  }
);

//GET /splits/:splitId - the creator and the participants only
router.get("/:splitId", ensureAuthenticated, (req, res) => {
  const split = getSplitById(req.params.splitId);
  if (!split) {
    res.status(404).json({ error: "Split not found" });
    return;
  }

  const summary = summarizeSplit(split);
  const userId = req.user?.id;
  const involved =
    split.creatorId === userId || summary.participants.some((p) => p.userId === userId);
  if (!involved) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.status(200).json({ split: summary });
});

export default router;
