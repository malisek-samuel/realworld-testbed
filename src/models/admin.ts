// Testbed addition: what the admin API returns (RWT-2).

import { User, UserRole, UserStatus } from "./user";

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
  status: UserStatus;
  transactionCount: number; // sent and received
};

export interface AdminStats {
  users: { total: number; admins: number; suspended: number };
  transactions: { total: number; payments: number; requests: number; pendingRequests: number };
  volume: number; // cents, completed transactions only
}
