import type { AppDatabase } from "../auth";

export type DatabaseTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export type DatabaseExecutor = AppDatabase | DatabaseTransaction;
