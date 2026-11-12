export function TravelerProfileValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-subtle">{label}</dt>
      <dd className="break-words font-semibold">{value || "—"}</dd>
    </div>
  );
}
