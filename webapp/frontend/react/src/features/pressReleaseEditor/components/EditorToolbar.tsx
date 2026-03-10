import type { ToolbarGroupConfig } from "../types";
import { ToolbarButton } from "./ToolbarButton";

type EditorToolbarProps = {
  toolbarGroups: ToolbarGroupConfig[];
};

export function EditorToolbar({ toolbarGroups }: EditorToolbarProps) {
  return (
    <div className="toolbar" aria-label="エディターツールバー">
      {toolbarGroups.map((group) => (
        <div key={group.label} className="toolbarGroup">
          <span className="toolbarGroupLabel">{group.label}</span>
          <div className="toolbarGroupButtons">
            {group.buttons.map((button) => (
              <ToolbarButton {...button} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
