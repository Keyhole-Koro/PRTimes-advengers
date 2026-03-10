type ToolbarButtonProps = {
  label: string;
  tooltip?: string;
  isActive: boolean;
  onClick: () => void;
};

export function ToolbarButton({ label, tooltip, isActive, onClick }: ToolbarButtonProps) {
  const tooltipText = tooltip ?? label;

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`toolbarButton${isActive ? " is-active" : ""}`}
      aria-pressed={isActive}
      aria-label={tooltipText}
      title={tooltipText}
    >
      {label}
    </button>
  );
}
