type ToolbarButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export function ToolbarButton({ label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`toolbarButton${isActive ? " is-active" : ""}`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

