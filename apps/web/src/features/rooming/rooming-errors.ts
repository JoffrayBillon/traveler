import type { TranslationKey } from "@traveler/i18n/resources";

export const roomErrorLabel: Record<string, TranslationKey> = {
  room_capacity_exceeded: "thisRoomIsFull",
  room_composition_changed: "theRoomCompositionHasChangedRefreshThePage",
  room_change_requires_consents:
    "aRoomChangeRequiresTheConsentOfEveryoneInvolved",
  room_locked: "thisRoomIsLocked",
  room_must_be_full_to_lock: "aRoomMustBeFullToLockIt",
  consent_not_required: "youAreNotInvolvedInThisRequest",
  invalid_room_exchange: "thisPersonCouldNotBeFoundInTheSelectedRoom",
};
