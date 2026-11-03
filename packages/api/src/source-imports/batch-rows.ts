// Forty rows keeps the widest import insert below SQLite's conservative 999 bind limit.
export function batchRows<T>(rows: readonly T[], size = 40): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size)
    batches.push(rows.slice(index, index + size));
  return batches;
}
