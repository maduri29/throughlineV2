import type { CardFlowNode } from "../../GraphNode";
import type { GraphNode } from "../../types";

export const CHIPS = ["scene", "character", "location", "theme", "flashback"] as const;
export type Chip = (typeof CHIPS)[number];
export type Filters = Record<Chip, boolean>;

/** Entity types the "+" menu can create from the Map. */
export const ADDABLE = ["character", "location", "theme", "seed", "episode"] as const;

export const ALL_ON: Filters = {
  scene: true,
  character: true,
  location: true,
  theme: true,
  flashback: true,
};

export const EDGE_STROKE: Record<string, string> = {
  precedes: "#7c8aa8",
  contains: "#c9d1e6",
  flashback_of: "#e8912d",
  sets_up: "#e5556f",
  parallels: "#00a3b5",
  appears_in: "#e0457b",
  takes_place_at: "#12a074",
  embodies: "#8b5cf6",
  relates_to: "#9aa3ba",
  foreshadows: "#d6336c",
  grew_into: "#0ea5b7",
  related_to: "#9aa3ba",
};

export const COL_W = 300;
export const LANE_Y_MAX = 40;
export const BAND_TOP = 40;

export const RAIL_TYPES = new Set(["character", "location", "theme", "project", "seed"]);
export const EMPTY_ORDER: string[] = [];

/** Which filter chip governs a node's visibility; null = always visible. */
export function chipOf(n: GraphNode): Chip | null {
  if (n.type === "scene") return (n.storyTime?.storyDay ?? 0) < 0 ? "flashback" : "scene";
  if (n.type === "character" || n.type === "location" || n.type === "theme") return n.type;
  return null; // project/episode/seed always visible
}

export function episodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((n) => n.type === "episode");
}

export type PendingConnect = { source: string; target: string; x: number; y: number };
export type ToastItem = { key: number; label: string };

/**
 * Pure 2D layout calculation for the Map lens:
 * - Episode pill headers placed at `y: BAND_TOP` across horizontal columns spaced by `COL_W`
 * - Scenes belonging to episodes placed vertically below episode headers (`100 + si * 120`)
 * - Flashbacks positioned in the top negative lane (`y: -80`)
 * - Character, location, theme, seed pills stacked on the left rail (`x: -280, y: 20 + oi * 56`)
 */
export function layout(nodes: GraphNode[], orderFor: (id: string) => string[]): CardFlowNode[] {
  const out: CardFlowNode[] = [];
  const scenesOf = new Map<string, Map<string, GraphNode>>();
  const eps: GraphNode[] = [];
  const flashbacks: GraphNode[] = [];
  const rails: GraphNode[] = [];

  for (const n of nodes) {
    if (n.type === "episode") {
      eps.push(n);
    } else if (n.type === "scene") {
      if ((n.storyTime?.storyDay ?? 0) < 0) {
        flashbacks.push(n);
      }
      if (n.parentId) {
        let m = scenesOf.get(n.parentId);
        if (!m) {
          m = new Map<string, GraphNode>();
          scenesOf.set(n.parentId, m);
        }
        m.set(n.id, n);
      }
    } else if (RAIL_TYPES.has(n.type)) {
      rails.push(n);
    }
  }

  let ei = 0;
  for (const ep of eps) {
    out.push({
      id: ep.id,
      type: "card",
      position: { x: ei * COL_W, y: BAND_TOP },
      data: { kind: "pill", nodeType: "episode", title: ep.title },
      draggable: false,
      selectable: false,
    });
    const epScenes = scenesOf.get(ep.id);
    const ordered = epScenes
      ? orderFor(ep.id)
          .map((id) => epScenes.get(id))
          .filter((s): s is GraphNode => Boolean(s))
      : [];
    let si = 0;
    for (const sc of ordered) {
      const day = sc.storyTime?.storyDay ?? null;
      out.push({
        id: sc.id,
        type: "card",
        position: { x: ei * COL_W, y: 100 + si * 120 },
        data: {
          kind: day !== null && day < 0 ? "flashback" : "scene",
          title: sc.title,
          badge: day === null ? "unscheduled" : `D${day} · ${sc.storyTime?.tod ?? ""}`.trim(),
          synopsis: sc.synopsis,
        },
      });
      si++;
    }
    ei++;
  }

  // Flashback lane on top.
  let fi = 0;
  for (const fb of flashbacks) {
    out.push({
      id: fb.id,
      type: "card",
      position: { x: 60 + fi * COL_W, y: -80 },
      data: {
        kind: "flashback",
        title: fb.title,
        badge: `D${fb.storyTime?.storyDay}`,
        synopsis: fb.synopsis,
      },
    });
    fi++;
  }

  let oi = 0;
  for (const o of rails) {
    out.push({
      id: o.id,
      type: "card",
      position: { x: -280, y: 20 + oi * 56 },
      data: { kind: "pill", nodeType: o.type, title: o.title },
      draggable: false,
    });
    oi++;
  }
  return out;
}
