import { useEffect, useRef, useState } from "react";

export function useSignInCooldown(email: string) {
  const key = `traveler-sign-in-cooldown:${email.trim().toLowerCase()}`;
  const memory = useRef({ key, until: 0 });
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    function refresh() {
      let until = memory.current.key === key ? memory.current.until : 0;
      try {
        const stored = Number(window.localStorage.getItem(key));
        if (Number.isFinite(stored)) until = Math.max(until, stored);
      } catch {
        // The server still enforces the cooldown when browser storage is unavailable.
      }
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    }
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [key]);

  function startCooldown(duration: number) {
    const until = Date.now() + duration * 1000;
    memory.current = { key, until };
    setSeconds(duration);
    try {
      window.localStorage.setItem(key, String(until));
    } catch {
      // Keep the in-memory countdown when browser storage is unavailable.
    }
  }

  return { cooldownSeconds: seconds, startCooldown };
}
