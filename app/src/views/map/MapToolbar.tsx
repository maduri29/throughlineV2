import { useState } from "react";
import { ADDABLE, CHIPS, type Chip, type Filters } from "./mapLayout";

type AddableType = (typeof ADDABLE)[number];

type MapToolbarProps = {
  filters: Filters;
  onToggleFilter: (chip: Chip) => void;
  onAddNodeType: (type: AddableType) => void;
};

export default function MapToolbar({ filters, onToggleFilter, onAddNodeType }: MapToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="tln-chips">
      {CHIPS.map((c) => (
        <button
          key={c}
          className={`tln-chip${filters[c] ? "" : " tln-chip--off"}`}
          onClick={() => onToggleFilter(c)}
        >
          {c.charAt(0).toUpperCase() + c.slice(1)}
        </button>
      ))}
      <div className="tln-addmenu">
        <button
          className="tln-chip tln-addmenu__btn"
          title="Add entity"
          onClick={() => setAddOpen((o) => !o)}
        >
          + Add
        </button>
        {addOpen ? (
          <div className="tln-addmenu__list">
            {ADDABLE.map((t) => (
              <button
                key={t}
                className="tln-addmenu__opt"
                onClick={() => {
                  onAddNodeType(t);
                  setAddOpen(false);
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
