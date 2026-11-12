// Testbed addition: user roles (RWT-1) and account status (RWT-3), shared by the API and the
// frontend. Records from before either field existed count as an active user.

import { User, UserRole, UserStatus } from "../models/user";

export const isAdmin = (user?: Partial<Pick<User, "role">>) => user?.role === UserRole.admin;

export const isSuspended = (user?: Partial<Pick<User, "status">>) =>
  user?.status === UserStatus.suspended;
