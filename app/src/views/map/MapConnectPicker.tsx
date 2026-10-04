import type { EdgeType } from "../../types";
import type { PendingConnect } from "./mapLayout";

type MapConnectPickerProps = {
  pending: PendingConnect;
  allowedTypes: EdgeType[];
  onPick: (type: EdgeType) => void;
  onCancel: () => void;
};

export default function MapConnectPicker({
  pending,
  allowedTypes,
  onPick,
  onCancel,
}: MapConnectPickerProps) {
  return (
    <>
      <div className="tln-picker-backdrop" onClick={onCancel} />
      <div className="tln-picker" style={{ left: pending.x, top: pending.y }}>
        <div className="tln-picker__title">Connection type</div>
        {allowedTypes.length === 0 ? (
          <div className="tln-picker__none">No legal connection for this pair</div>
        ) : (
          allowedTypes.map((t) => (
            <button key={t} className="tln-picker__opt" onClick={() => onPick(t)}>
              {t}
            </button>
          ))
        )}
        <div className="tln-picker__hint">Esc to cancel</div>
      </div>
    </>
  );
}
