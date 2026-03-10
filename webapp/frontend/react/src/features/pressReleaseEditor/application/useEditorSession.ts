import { useState } from "react";

import type { PresenceUser } from "../../../editor/remotePresence";
import type { SessionState } from "../types";

export function useEditorSession(initialTitle: string, initialVersion: number) {
  const [title, setTitle] = useState(() => initialTitle);
  const [version, setVersion] = useState(() => initialVersion);
  const [session, setSession] = useState<SessionState | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([]);
  const [editorResetToken, setEditorResetToken] = useState(0);

  return {
    editorResetToken,
    remoteUsers,
    session,
    setEditorResetToken,
    setRemoteUsers,
    setSession,
    setTitle,
    setVersion,
    title,
    version,
  };
}
