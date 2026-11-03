import { useRoomingMutations } from "@traveler/api/rooming/mutations";
import type { RoomRequestSummary } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";
import { RoomHistoryButton } from "./RoomHistoryButton";
import { roomErrorLabel } from "./rooming-errors";

export function RoomConsentList({
  tripId,
  userId,
  requests,
  onMessage,
  showHistoryButton = false,
  mode = "all",
}: {
  tripId: string;
  userId: string;
  requests: RoomRequestSummary[];
  onMessage: (message: string) => void;
  showHistoryButton?: boolean;
  mode?: "all" | "actionable" | "status";
}) {
  const { t } = useTranslation();
  const mutations = useRoomingMutations(tripId);
  const actionableRequests = requests.filter((request) => {
    if (request.status !== "pending" || request.requesterUserId === userId)
      return false;
    const ownConsent = request.requiredConsents.find(
      (consent) => consent.userId === userId,
    );
    return ownConsent !== undefined && !ownConsent.approved;
  });
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );
  const visibleRequests =
    mode === "actionable"
      ? actionableRequests
      : mode === "status"
        ? pendingRequests.filter(
            (request) => !actionableRequests.includes(request),
          )
        : pendingRequests;

  if (visibleRequests.length === 0 && !showHistoryButton) return null;
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
          ? t(roomErrorLabel[code] ?? "operationFailed")
          : t("yourResponseCouldNotBeSentCheckYourConnectionAndTryAgain"),
      );
    }
  }

  async function withdraw(requestId: string) {
    try {
      const result = await mutations.withdrawRequest.mutateAsync(requestId);
      onMessage(
        result.status === "expired"
          ? t("roomRequestExpired")
          : t("roomRequestWithdrawn"),
      );
    } catch {
      onMessage(t("roomRequestCouldNotBeWithdrawn"));
    }
  }

  return (
    <section
      className={
        mode === "actionable"
          ? "grid gap-3 rounded-feature border-2 border-accent bg-surface-raised p-4 sm:p-5"
          : "grid gap-3"
      }
      aria-live={mode === "actionable" ? "polite" : undefined}
      aria-labelledby={
        mode === "actionable" ? "room-consent-alert-title" : undefined
      }
    >
      {(visibleRequests.length > 0 || showHistoryButton) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {visibleRequests.length > 0 && (
            <div className="grid gap-1">
              <h4
                className="text-base font-bold"
                {...(mode === "actionable"
                  ? { id: "room-consent-alert-title" }
                  : {})}
              >
                {t(
                  mode === "actionable"
                    ? "roomChangeNeedsYourApproval"
                    : "roomChangeRequests",
                )}
              </h4>
              {mode === "actionable" && (
                <p className="text-sm text-content-muted">
                  {t("reviewRoomChangeAndChoose")}
                </p>
              )}
            </div>
          )}
          {showHistoryButton && <RoomHistoryButton tripId={tripId} />}
        </div>
      )}
      {visibleRequests.map((request) => {
        const ownConsent = request.requiredConsents.find(
          (consent) => consent.userId === userId,
        );
        return (
          <Card
            as="article"
            spacing="compact"
            arrangement="stack"
            key={request.id}
            {...(mode === "actionable"
              ? { className: "border-accent bg-surface" }
              : {})}
          >
            <p className="leading-relaxed text-content-muted">
              {request.requester?.firstName} {request.requester?.lastName}{" "}
              {t("requestsARoomChange")}
            </p>
            {request.status === "pending" && (
              <p className="text-sm text-content-muted">
                {t("roomRequestExpiresOn", {
                  date: new Date(request.expiresAt).toLocaleDateString(),
                })}
              </p>
            )}
            <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
              {request.moves.map((move) => (
                <li key={move.userId}>
                  {move.person?.firstName} {move.person?.lastName} :{" "}
                  {move.currentRoom ?? t("unassigned")} → {move.targetRoom}
                </li>
              ))}
            </ul>
            {request.status === "pending" &&
              ownConsent &&
              !ownConsent.approved && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    appearance="secondary"
                    onPress={() => void respond(request.id, true)}
                    isDisabled={mutations.respondToRequest.isPending}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    appearance="quietDanger"
                    onPress={() => void respond(request.id, false)}
                    isDisabled={mutations.respondToRequest.isPending}
                  >
                    {t("decline")}
                  </Button>
                </div>
              )}
            {request.status === "pending" && ownConsent?.approved && (
              <p className="text-sm text-success">
                {t("yourApprovalIsRecorded")} ·{" "}
                {
                  request.requiredConsents.filter((consent) => consent.approved)
                    .length
                }
                /{request.requiredConsents.length} {t("approvals")}
              </p>
            )}
            {request.status === "pending" &&
              request.requesterUserId === userId && (
                <Button
                  appearance="quiet"
                  onPress={() => void withdraw(request.id)}
                  isDisabled={mutations.withdrawRequest.isPending}
                >
                  {t("withdrawRoomRequest")}
                </Button>
              )}
          </Card>
        );
      })}
    </section>
  );
}
