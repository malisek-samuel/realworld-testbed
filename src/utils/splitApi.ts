// Testbed addition: the split API, as the split pages call it (RWT-6, RWT-7).

import { httpClient } from "./asyncUtils";
import { backendPort } from "./portUtils";
import { SplitPayload, SplitSummary } from "../models/split";

const splitsUrl = (path = "") => `http://localhost:${backendPort}/splits${path}`;

export const fetchSplit = async (splitId: string): Promise<SplitSummary> =>
  (await httpClient.get(splitsUrl(`/${encodeURIComponent(splitId)}`))).data.split;

export const createSplit = async (payload: SplitPayload): Promise<SplitSummary> =>
  (await httpClient.post(splitsUrl(), payload)).data.split;

// The HTTP status of a failed call, if the API answered.
export const errorStatus = (error: any): number | undefined => error?.response?.status;

// The API's messages for a 422 ({errors: [{msg}]}), its {error} otherwise, else the HTTP error.
export const errorMessages = (error: any): string[] => {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e: { msg: string }) => e.msg);
  }
  return [data?.error ?? error?.message ?? "Something went wrong"];
};
