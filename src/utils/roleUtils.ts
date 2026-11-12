// Testbed addition: user roles (RWT-1), shared by the API and the frontend.

import { User, UserRole } from "../models/user";

export const isAdmin = (user?: Partial<Pick<User, "role">>) => user?.role === UserRole.admin;
