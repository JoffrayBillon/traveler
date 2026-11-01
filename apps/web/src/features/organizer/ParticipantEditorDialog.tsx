import { Check, Copy, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { ParticipantAccountSection } from "./ParticipantAccountSection";
import { ParticipantContactSection } from "./ParticipantContactSection";
import { ParticipantPaymentSection } from "./ParticipantPaymentSection";
import { ParticipantTravelSection } from "./ParticipantTravelSection";
import type { DetailsDraft, ProfileDraft } from "./participant-directory.types";
import type { StaffTraveler } from "./types";

export function ParticipantEditorDialog({
  selected,
  profile,
  details,
  email,
  onEmailChange,
  role,
  onRoleChange,
  isManager,
  isSaving,
  isCopying,
  setSelected,
  setProfile,
  setDetails,
  onSave,
  onCopyLink,
}: {
  selected: StaffTraveler | null;
  profile: ProfileDraft | null;
  details: DetailsDraft | null;
  email: string;
  onEmailChange: (email: string) => void;
  role: StaffTraveler["role"];
  onRoleChange: (role: StaffTraveler["role"]) => void;
  isManager: boolean;
  isSaving: boolean;
  isCopying: boolean;
  setSelected: (selected: StaffTraveler | null) => void;
  setProfile: Dispatch<SetStateAction<ProfileDraft | null>>;
  setDetails: Dispatch<SetStateAction<DetailsDraft | null>>;
  onSave: () => void;
  onCopyLink: () => void;
}) {
  const { t } = useTranslation();
  function changeProfile<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }
  function changeDetails<K extends keyof DetailsDraft>(
    key: K,
    value: DetailsDraft[K],
  ) {
    setDetails((current) => (current ? { ...current, [key]: value } : current));
  }
  return (
    <ModalOverlay
      isOpen={selected !== null}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
      isDismissable
      className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0"
    >
      <Modal className="my-auto w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]">
        <Dialog className="mx-auto flex h-[min(92dvh,66rem)] max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-feature border border-border bg-surface p-0 text-content shadow-panel outline-none max-sm:h-[94dvh] max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:rounded-t-feature">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
            <div className="grid min-w-0 gap-1">
              <Heading slot="title" className="truncate text-xl font-bold">
                {selected
                  ? `${selected.firstName} ${selected.lastName}`
                  : t("participantsAndUsers")}
              </Heading>
              <p className="truncate text-sm text-content-muted">
                {selected?.email}
              </p>
            </div>
            <Button
              appearance="quietNeutral"
              slot="close"
              aria-label={t("close")}
            >
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          {selected && profile && details && (
            <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8">
              <ParticipantAccountSection
                profile={profile}
                email={email}
                onEmailChange={onEmailChange}
                role={role}
                onRoleChange={onRoleChange}
                isManager={isManager}
                onProfileChange={changeProfile}
              />
              <ParticipantContactSection
                profile={profile}
                onChange={changeProfile}
              />
              <ParticipantTravelSection
                details={details}
                onChange={changeDetails}
              />
              <ParticipantPaymentSection
                participant={selected}
                isManager={isManager}
              />
            </div>
          )}
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-8">
            {isManager ? (
              <Button
                appearance="secondary"
                onPress={() => onCopyLink()}
                isDisabled={isCopying || isSaving}
              >
                {isCopying ? (
                  <Check aria-hidden="true" size={16} />
                ) : (
                  <Copy aria-hidden="true" size={16} />
                )}
                {isCopying ? t("copied") : t("copySignInLink")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                appearance="quietNeutral"
                slot="close"
                isDisabled={isSaving}
              >
                {t("cancel")}
              </Button>
              <Button
                appearance="primary"
                onPress={() => onSave()}
                isDisabled={isSaving || !profile || !details}
              >
                {isSaving ? t("saving") : t("saveChanges")}
              </Button>
            </div>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
