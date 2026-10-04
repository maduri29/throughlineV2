import { useEffect, useState } from "react";
import { useGraphStore } from "../../store";

export function useSequenceDragAndDrop() {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging) return;

    const move = (event: PointerEvent) => {
      const card = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-scene-id]");
      setDropTarget(card?.dataset.sceneId ?? null);
    };

    const finish = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const card = element?.closest<HTMLElement>("[data-scene-id]");
      const section = element?.closest<HTMLElement>("[data-sequence-id]");
      if (section?.dataset.sequenceId) {
        useGraphStore
          .getState()
          .moveScene(dragging, section.dataset.sequenceId, card?.dataset.sceneId);
      }
      setDragging(null);
      setDropTarget(null);
    };

    const cancel = () => {
      setDragging(null);
      setDropTarget(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging]);

  return {
    dragging,
    setDragging,
    dropTarget,
  };
}
