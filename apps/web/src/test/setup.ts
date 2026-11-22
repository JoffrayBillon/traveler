import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  // React Aria's live region lives outside the React root. Detach it before
  // jsdom tears down so a delayed announcement skips the disposed document.
  document.querySelector("[data-live-announcer]")?.remove();
});
