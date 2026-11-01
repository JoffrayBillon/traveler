import { TravelerApp } from "@traveler/features/auth/TravelerApp";
import { BrowserRouter } from "react-router";

export function TravelerRouter() {
  return (
    <BrowserRouter>
      <TravelerApp />
    </BrowserRouter>
  );
}
