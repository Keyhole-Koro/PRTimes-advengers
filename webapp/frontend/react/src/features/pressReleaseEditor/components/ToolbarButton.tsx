import type { ChangeEvent } from "react";

import type { ToolbarButtonConfig } from "../types";

type ToolbarButtonProps = ToolbarButtonConfig;

export function ToolbarButton(props: ToolbarButtonProps) {
  const { label, tooltip } = props;
  const tooltipText = tooltip ?? label;

  if (props.type === "select") {
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      props.onChange(event.target.value);
    };

    return (
      <label className="toolbarSelectWrap" aria-label={tooltipText} title={tooltipText}>
        <span className="toolbarSelectLabel">{label}</span>
        <select className="toolbarSelect" value={props.value} onChange={handleChange}>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={props.onClick}
      className={`toolbarButton${props.isActive ? " is-active" : ""}`}
      aria-pressed={props.isActive}
      aria-label={tooltipText}
      title={tooltipText}
    >
      {label}
    </button>
  );
}
