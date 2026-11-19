import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSignInCooldown } from "./useSignInCooldown";

afterEach(() => vi.useRealTimers());

it("preserves the per-address cooldown across reloads, tabs and elapsed time", () => {
  vi.useFakeTimers();
  window.localStorage.clear();
  const first = renderHook(() => useSignInCooldown("Mina@example.com"));
  act(() => first.result.current.startCooldown(300));
  expect(first.result.current.cooldownSeconds).toBe(300);
  first.unmount();

  const second = renderHook(() => useSignInCooldown(" mina@EXAMPLE.com "));
  expect(second.result.current.cooldownSeconds).toBe(300);
  act(() => {
    window.localStorage.setItem(
      "traveler-sign-in-cooldown:mina@example.com",
      String(Date.now() + 400_000),
    );
    window.dispatchEvent(new Event("storage"));
  });
  expect(second.result.current.cooldownSeconds).toBe(400);
  act(() => {
    vi.setSystemTime(Date.now() + 401_000);
    window.dispatchEvent(new Event("focus"));
  });
  expect(second.result.current.cooldownSeconds).toBe(0);
  second.unmount();
  const other = renderHook(() => useSignInCooldown("other@example.com"));
  expect(other.result.current.cooldownSeconds).toBe(0);
});
