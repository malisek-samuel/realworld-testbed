// Testbed addition: user roles (RWT-1) and account status (RWT-3). The fields a user must not set on their own account: sent to
// sign-up or a profile update, they would let anyone make themselves an admin.

import { body } from "express-validator";

export const PRIVILEGED_FIELDS = ["role", "status"];

export const noPrivilegedFields = PRIVILEGED_FIELDS.map((field) =>
  body(field).not().exists().withMessage(`${field} can't be set`)
);
