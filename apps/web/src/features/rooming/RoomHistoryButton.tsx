import { useRoomingHistoryQuery } from "@traveler/api/rooming/queries";
import { Button } from "@traveler/components/ui";
import { History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RoomHistoryDialog } from "./RoomHistoryDialog";

export function RoomHistoryButton({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const historyQuery = useRoomingHistoryQuery(tripId, isOpen);

  return (
    <>
      <Button appearance="quiet" onPress={() => setIsOpen(true)}>
        <History aria-hidden="true" size={16} />
        {t("roomHistory")}
      </Button>
      <RoomHistoryDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        history={historyQuery.data?.history ?? []}
        isLoading={historyQuery.isPending}
        isError={historyQuery.isError}
      />
    </>
  );
}
