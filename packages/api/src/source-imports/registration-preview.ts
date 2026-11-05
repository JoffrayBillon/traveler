type ReviewValue = string | number | boolean | null;

export function compareRegistrationFields<K extends string>(
  fields: readonly K[],
  before: Partial<Record<K, ReviewValue>> | undefined,
  after: Record<K, ReviewValue>,
) {
  return fields.flatMap((field) => {
    const previous = before?.[field] ?? null;
    const next = after[field];
    return previous === next ? [] : [{ field, before: previous, after: next }];
  });
}
