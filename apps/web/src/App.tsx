import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { TravelerApp } from "./features/auth/TravelerApp";
import { queryClient } from "./shared/query/query-client";
import "./i18n";
import "./styles.css";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TravelerApp />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
