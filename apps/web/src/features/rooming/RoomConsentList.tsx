import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomRequestSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";
import { roomErrorLabel } from "./rooming-errors";

export function RoomConsentList({
  tripId,
  userId,
  requests,
  onMessage,
}: {
  tripId: string;
  userId: string;
  requests: RoomRequestSummary[];
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);

  async function respond(requestId: string, approve: boolean) {
    try {
      const result = await mutations.respondToRequest.mutateAsync({
        requestId,
        approve,
      });
      onMessage(
        result.status === "stale"
          ? t("theRoomCompositionChangedThisRequestWasNotApplied")
          : approve
            ? t("yourApprovalHasBeenRecorded")
            : t("theRequestWasDeclined"),
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      onMessage(
        code
          ? t(roomErrorLabel[code] ?? "L’opération a échoué.")
          : t("yourResponseCouldNotBeSentCheckYourConnectionAndTryAgain"),
      );
    }
  }

  if (requests.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h4 className="text-base font-bold">{t("requestsToApprove")}</h4>
      {requests.map((request) => {
        const ownConsent = request.requiredConsents.find(
          (consent) => consent.userId === userId,
        );
        return (
          <Card
            as="article"
            spacing="compact"
            arrangement="stack"
            key={request.id}
          >
            <p className="leading-relaxed text-content-muted">
              {request.requester?.firstName} {request.requester?.lastName}{" "}
              {t("requestsARoomChange")}
            </p>
            <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
              {request.moves.map((move) => (
                <li key={move.userId}>
                  {move.person?.firstName} {move.person?.lastName} :{" "}
                  {move.currentRoom ?? t("unassigned")} → {move.targetRoom}
                </li>
              ))}
            </ul>
            {ownConsent && !ownConsent.approved && (
              <div className="flex flex-wrap gap-2">
                <Button
                  appearance="secondary"
                  onPress={() => void respond(request.id, true)}
                  isDisabled={mutations.respondToRequest.isPending}
                >
                  {t("approve")}
                </Button>
                <Button
                  appearance="quiet"
                  onPress={() => void respond(request.id, false)}
                  isDisabled={mutations.respondToRequest.isPending}
                >
                  {t("decline")}
                </Button>
              </div>
            )}
            {ownConsent?.approved && (
              <p className="text-sm text-success">
                {t("yourApprovalIsRecorded")} ·{" "}
                {
                  request.requiredConsents.filter((consent) => consent.approved)
                    .length
                }
                /{request.requiredConsents.length} {t("approvals")}
              </p>
            )}
          </Card>
        );
      })}
    </section>
  );
}
