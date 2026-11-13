// Testbed addition: splitting a bill (RWT-5). Amounts are in cents.

import { TransactionRequestStatus } from "./transaction";

export enum SplitMode {
  equal = "equal",
  custom = "custom",
}

export interface Split {
  id: string;
  uuid: string;
  creatorId: string;
  description: string;
  mode: SplitMode;
  total: number;
  selfShare: number; // the creator's own part, requested from nobody; 0 without includeSelf
  transactionIds: string[]; // one request per participant, in the order they were given
  createdAt: Date;
  modifiedAt: Date;
}

// What POST /splits accepts. Amounts are dollars, as strings or numbers, like the payment form.
export interface SplitPayload {
  description: string;
  total: string | number;
  mode: SplitMode;
  includeSelf?: boolean; // default true
  selfAmount?: string | number; // custom mode with includeSelf
  participants: { userId: string; amount?: string | number }[]; // amount in custom mode
}

export interface SplitParticipantSummary {
  userId: string;
  name: string;
  avatar: string;
  amount: number;
  transactionId: string;
  requestStatus: TransactionRequestStatus;
}

export interface SplitSummary {
  id: string;
  description: string;
  mode: SplitMode;
  createdAt: Date;
  creator: { id: string; name: string; avatar: string };
  total: number;
  selfShare: number;
  participants: SplitParticipantSummary[];
  collected: number; // accepted requests
  outstanding: number; // pending requests
  declined: number; // rejected requests
}
