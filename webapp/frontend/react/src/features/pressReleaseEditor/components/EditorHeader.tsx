import type { CSSProperties } from "react";

import type { PresenceUser } from "../../../editor/remotePresence";
import type { SaveStatus } from "../types";

type EditorHeaderProps = {
  identityColor: string;
  identityName: string;
  remoteUsers: PresenceUser[];
  saveStatus: SaveStatus;
  version: number;
};

export function EditorHeader({
  identityColor,
  identityName,
  remoteUsers,
  saveStatus,
  version,
}: EditorHeaderProps) {
  return (
    <header className="header">
      <div className="titleBlock">
        <div className="metaRow">
          <span className={`saveStatus saveStatus-${saveStatus}`} aria-live="polite">
            {saveStatus === "saving" && "保存中..."}
            {saveStatus === "saved" && `保存済み v${version}`}
            {saveStatus === "dirty" && "共同編集中"}
            {saveStatus === "error" && "接続または保存に失敗しました"}
          </span>
          <span>{`編集中 ${remoteUsers.length + 1}人`}</span>
        </div>
        <div className="presenceList" aria-label="接続中の編集者">
          <span className="presenceChip is-self" style={{ "--presence-color": identityColor } as CSSProperties}>
            {identityName}
          </span>
          {remoteUsers.map((user) => (
            <span key={user.userId} className="presenceChip" style={{ "--presence-color": user.color } as CSSProperties}>
              {user.name}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
