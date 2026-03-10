import { Extension } from "@tiptap/core";
import { collab } from "@tiptap/pm/collab";

import { PRESENCE_COLORS } from "../constants";
import { v4 as uuidv4 } from 'uuid'
export function createRealtimeIdentity() {
  const userId= uuidv4();
  const suffix = userId.slice(0, 4);
  return {
    userId,
    name: `Tab ${suffix}`,
    color: PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)],
  };
}

export function createCollaborationExtension(version: number, clientId: string) {
  return Extension.create({
    name: "collaborationBridge",
    addProseMirrorPlugins() {
      return [collab({ version, clientID: clientId })];
    },
  });
}

