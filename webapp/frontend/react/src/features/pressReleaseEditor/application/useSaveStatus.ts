import { useState } from "react";

import type { SaveStatus } from "../types";

export function useSaveStatus(initialStatus: SaveStatus = "saved") {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialStatus);

  return {
    saveStatus,
    setSaveStatus,
  };
}
