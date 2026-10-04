import type { ToastItem } from "./mapLayout";

type MapToastOverlayProps = {
  toasts: ToastItem[];
  onUndo: (key: number) => void;
};

export default function MapToastOverlay({ toasts, onUndo }: MapToastOverlayProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="tln-toast-wrap">
      {toasts.map((t) => (
        <div key={t.key} className="tln-toast">
          <span>{t.label}</span>
          <button onClick={() => onUndo(t.key)}>Undo</button>
        </div>
      ))}
    </div>
  );
}
