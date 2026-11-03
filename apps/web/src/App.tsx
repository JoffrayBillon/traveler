import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@traveler/api/query-client";
import { TravelerRouter } from "@traveler/router";
import "@traveler/i18n";
import "./styles.css";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TravelerRouter />
    </QueryClientProvider>
  );
}
