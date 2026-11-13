export enum DefaultPrivacyLevel {
  public = "public",
  private = "private",
  contacts = "contacts",
}

export enum UserRole {
  user = "user",
  admin = "admin",
}

export enum UserStatus {
  active = "active",
  suspended = "suspended",
}

export interface User {
  id: string;
  uuid: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  phoneNumber: string;
  balance: number;
  avatar: string;
  defaultPrivacyLevel: DefaultPrivacyLevel;
  role?: UserRole; // testbed (RWT-1): absent on records from before roles, which count as "user"
  status?: UserStatus; // testbed (RWT-3): absent counts as "active"
  createdAt: Date;
  modifiedAt: Date;
}

export type UserSettingsPayload = Pick<
  User,
  "firstName" | "lastName" | "email" | "phoneNumber" | "defaultPrivacyLevel"
>;

export type SignInPayload = Pick<User, "username" | "password"> & {
  remember?: Boolean;
};

export type SignUpPayload = Pick<User, "username" | "password" | "firstName" | "lastName">;
