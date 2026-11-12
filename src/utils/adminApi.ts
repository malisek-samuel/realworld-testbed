// Testbed addition: the admin API, as the admin console calls it (RWT-4).

import { httpClient } from "./asyncUtils";
import { backendPort } from "./portUtils";
import { UserStatus } from "../models/user";
import { AdminStats, AdminUser } from "../models/admin";
import { TransactionPagination } from "../models/transaction";

export type AdminUsersQuery = {
  q?: string;
  status?: UserStatus;
  page?: number;
  limit?: number;
};

export type AdminUsersPage = { pageData: TransactionPagination; results: AdminUser[] };

const adminUrl = (path: string) => `http://localhost:${backendPort}/admin${path}`;

export const fetchAdminUsers = async (params: AdminUsersQuery): Promise<AdminUsersPage> =>
  (await httpClient.get(adminUrl("/users"), { params })).data;

export const fetchAdminStats = async (): Promise<AdminStats> =>
  (await httpClient.get(adminUrl("/stats"))).data;

export const setUserStatus = async (userId: string, status: UserStatus): Promise<AdminUser> =>
  (await httpClient.patch(adminUrl(`/users/${userId}`), { status })).data.user;

// The API's own message when there is one ("Admins can't be suspended"), else the HTTP error.
export const apiErrorMessage = (error: any): string =>
  error?.response?.data?.error ?? error?.message ?? "Something went wrong";
