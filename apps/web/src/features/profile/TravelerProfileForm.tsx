import { useEffect, useState } from "react";
import type { TravelerProfileValues } from "./TravelerProfileEditorDialog";
import { TravelerProfileEditorDialog } from "./TravelerProfileEditorDialog";
import { TravelerProfileSummary } from "./TravelerProfileSummary";

export type { TravelerProfileValues } from "./TravelerProfileEditorDialog";

export function TravelerProfileForm({
  tripId,
  initial,
  isOpen,
  isRequired,
  onOpenChange,
  onSaved,
}: {
  tripId: string;
  initial: TravelerProfileValues;
  isOpen: boolean;
  isRequired: boolean;
  onOpenChange: (isOpen: boolean, reason?: "dismiss" | "saved") => void;
  onSaved: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(isOpen);
  useEffect(() => setEditorOpen(isOpen), [isOpen]);

  function changeEditorOpen(nextOpen: boolean) {
    setEditorOpen(nextOpen);
    onOpenChange(nextOpen, nextOpen ? undefined : "dismiss");
  }

  return (
    <>
      <TravelerProfileSummary
        profile={initial}
        isRequired={isRequired}
        onEdit={() => changeEditorOpen(true)}
      />
      <TravelerProfileEditorDialog
        tripId={tripId}
        initial={initial}
        isOpen={editorOpen}
        isRequired={isRequired}
        onOpenChange={(nextOpen, reason) => {
          setEditorOpen(nextOpen);
          onOpenChange(nextOpen, reason);
        }}
        onSaved={onSaved}
      />
    </>
  );
}
