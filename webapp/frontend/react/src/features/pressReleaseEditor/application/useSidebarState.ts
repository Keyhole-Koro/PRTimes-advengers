import { useEffect, useState } from "react";

import { getStoredString, setStoredString } from "../infrastructure/localStorageRepository";
import type { SidebarTab } from "../types";

type UseSidebarStateOptions = {
  sidebarTabStorageKey: string;
  sidebarWidthStorageKey: string;
};

export function useSidebarState({
  sidebarTabStorageKey,
  sidebarWidthStorageKey,
}: UseSidebarStateOptions) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    const raw = getStoredString(sidebarTabStorageKey);
    return raw === "comments" || raw === "history" || raw === "ai" ? raw : "history";
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = getStoredString(sidebarWidthStorageKey);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) ? Math.min(480, Math.max(280, value)) : 320;
  });

  useEffect(() => {
    setStoredString(sidebarTabStorageKey, sidebarTab);
  }, [sidebarTab, sidebarTabStorageKey]);

  useEffect(() => {
    setStoredString(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth, sidebarWidthStorageKey]);

  return {
    sidebarTab,
    sidebarWidth,
    setSidebarTab,
    setSidebarWidth,
  };
}
