// Testbed addition: what the admin API returns (RWT-2).

import { User, UserRole } from "./user";

export type AdminUser = Pick<
  User,
  | "id"
  | "username"
  | "firstName"
  | "lastName"
  | "email"
  | "phoneNumber"
  | "avatar"
  | "balance"
  | "createdAt"
> & {
  role: UserRole;
  transactionCount: number; // sent and received
};

export interface AdminStats {
  users: { total: number; admins: number };
  transactions: { total: number; payments: number; requests: number; pendingRequests: number };
  volume: number; // cents, completed transactions only
}
