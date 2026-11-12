export type TravelerProfileValues = {
  firstName: string;
  lastName: string;
  gender: "M" | "F" | null;
  genderConfirmed: boolean;
  dietaryRequirements: string;
  allergens: string;
  emergencyContactFirstName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  completed: boolean;
};
