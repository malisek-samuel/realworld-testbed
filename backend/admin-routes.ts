///<reference path="types.ts" />
// Testbed addition: the admin API (RWT-2), and suspending accounts (RWT-3). Every route needs a
// signed-in admin: 401 without a session, 403 for anybody else.

import express, { NextFunction, Request, Response } from "express";
import { body, query } from "express-validator";
import { getAllTransactions, getAllUsers, getUserById, updateUserById } from "./database";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
import { isAdmin, isSuspended } from "../src/utils/roleUtils";
import { getPaginatedItems, isRequestTransaction } from "../src/utils/transactionUtils";
import {
  Transaction,
  TransactionRequestStatus,
  TransactionStatus,
  User,
  UserRole,
  UserStatus,
} from "../src/models";
import { AdminStats, AdminUser } from "../src/models/admin";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isAdmin(req.user as User)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

const countTransactionsByUser = (transactions: Transaction[]) => {
  const counts = new Map<string, number>();
  const add = (userId: string) => counts.set(userId, (counts.get(userId) ?? 0) + 1);
  for (const transaction of transactions) {
    add(transaction.senderId);
    if (transaction.receiverId !== transaction.senderId) add(transaction.receiverId);
  }
  return counts;
};

export const toAdminUser = (user: User, transactionCount: number): AdminUser => ({
  id: user.id,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  avatar: user.avatar,
  role: user.role ?? UserRole.user,
  status: user.status ?? UserStatus.active,
  balance: user.balance,
  createdAt: user.createdAt,
  transactionCount,
});

const matchesSearch = (q: string) => {
  const needle = q.toLowerCase();
  return (user: User) =>
    [user.username, user.firstName, user.lastName, user.email].some((value) =>
      value?.toLowerCase().includes(needle)
    );
};

const newestFirst = (a: User, b: User) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const getAdminStats = (): AdminStats => {
  const users: User[] = getAllUsers();
  const transactions: Transaction[] = getAllTransactions();
  const requests = transactions.filter(isRequestTransaction);

  return {
    users: {
      total: users.length,
      admins: users.filter((user) => isAdmin(user)).length,
      suspended: users.filter((user) => isSuspended(user)).length,
    },
    transactions: {
      total: transactions.length,
      payments: transactions.length - requests.length,
      requests: requests.length,
      pendingRequests: requests.filter((t) => t.requestStatus === TransactionRequestStatus.pending)
        .length,
    },
    volume: transactions
      .filter((t) => t.status === TransactionStatus.complete)
      .reduce((total, t) => total + t.amount, 0),
  };
};

const router = express.Router();

router.use(ensureAuthenticated, requireAdmin);

const STATUSES = Object.values(UserStatus);

//GET /admin/users - every user, newest first, paginated; q searches name, username and email,
//status keeps only active or only suspended users
router.get(
  "/users",
  validateMiddleware([
    query("q").optional().isString(),
    query("status").optional().isIn(STATUSES),
    // express-paginate has already turned limit into a number, 0 when it was invalid
    query("limit").isInt({ min: 1 }).withMessage("limit must be at least 1"),
  ]),
  (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const { status } = req.query;
    const counts = countTransactionsByUser(getAllTransactions());
    const users = (getAllUsers() as User[])
      .filter(q ? matchesSearch(q) : () => true)
      .filter((user) => !status || (user.status ?? UserStatus.active) === status)
      .sort(newestFirst);

    const { totalPages, data } = getPaginatedItems(
      req.query.page as unknown as number,
      req.query.limit as unknown as number,
      users
    );

    res.status(200).json({
      pageData: {
        page: res.locals.paginate.page,
        limit: res.locals.paginate.limit,
        hasNextPages: res.locals.paginate.hasNextPages(totalPages),
        totalPages,
      },
      results: (data as User[]).map((user) => toAdminUser(user, counts.get(user.id) ?? 0)),
    });
  }
);

//PATCH /admin/users/:userId - { status: "active" | "suspended" }, nothing else
router.patch(
  "/users/:userId",
  validateMiddleware([
    shortIdValidation("userId"),
    body("status")
      .isIn(STATUSES)
      .withMessage(`status must be one of ${STATUSES.join(", ")}`),
    body()
      .custom((payload) => Object.keys(payload).every((key) => key === "status"))
      .withMessage("only status can be changed"),
  ]),
  (req, res) => {
    const { userId } = req.params;
    const { status } = req.body as { status: UserStatus };
    const user: User | undefined = getUserById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (status === UserStatus.suspended && isAdmin(user)) {
      res.status(422).json({ error: "Admins can't be suspended" });
      return;
    }

    updateUserById(userId, { status, modifiedAt: new Date() });

    const count = countTransactionsByUser(getAllTransactions()).get(userId) ?? 0;
    res.status(200).json({ user: toAdminUser(getUserById(userId), count) });
  }
);

//GET /admin/stats - users, transactions and volume
router.get("/stats", (req, res) => {
  res.status(200).json(getAdminStats());
});

export default router;
