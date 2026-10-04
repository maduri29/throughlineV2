// Character-lens derivations (pure, unit-tested): per-character scenes in
// narrative order, labeled relations, embodied themes, locations reached via
// the character's scenes, and first/last appearance against scriptSequence.
import type { GraphEdge, GraphNode } from "../types";
import { scriptSequence } from "./fountain";

export type Relation = { otherId: string; label: string | null };

export type CharacterDetail = {
  /** appears_in scene ids — narrative-ranked scenes first, unranked after. */
  sceneIds: string[];
  /** Character↔character bonds (relates_to, or related_to fallback); pair-deduped. */
  relations: Relation[];
  /** Themes this character embodies. */
  themeIds: string[];
  /** Locations of the character's scenes (takes_place_at), deduped. */
  locationIds: string[];
  /** First/last appearance by narrative order; null when no ranked scene. */
  firstSceneId: string | null;
  lastSceneId: string | null;
};

export function characterDetails(
  project: GraphNode,
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
): Map<string, CharacterDetail> {
  // Presentation rank per scene; parentless flashbacks auto-place via flashback_of.
  const rank = new Map<string, number>();
  let next = 0;
  for (const item of scriptSequence(project, nodes, edges)) {
    if (!rank.has(item.scene.id)) rank.set(item.scene.id, next++);
  }

  const details = new Map<string, CharacterDetail>();
  const ensure = (id: string): CharacterDetail => {
    let d = details.get(id);
    if (!d) {
      d = {
        sceneIds: [],
        relations: [],
        themeIds: [],
        locationIds: [],
        firstSceneId: null,
        lastSceneId: null,
      };
      details.set(id, d);
    }
    return d;
  };

  const rawScenes = new Map<string, string[]>();
  const sceneLocations = new Map<string, string[]>();
  const pairLabel = new Map<string, { a: string; b: string; label: string | null }>();
  const embodiesByChar = new Map<string, string[]>();

  for (const id in edges) {
    const e = edges[id];
    if (!e) continue;
    if (e.type === "appears_in") {
      let arr = rawScenes.get(e.from);
      if (!arr) {
        arr = [];
        rawScenes.set(e.from, arr);
      }
      arr.push(e.to);
    } else if (e.type === "takes_place_at") {
      let arr = sceneLocations.get(e.from);
      if (!arr) {
        arr = [];
        sceneLocations.set(e.from, arr);
      }
      if (!arr.includes(e.to)) arr.push(e.to);
    } else if (e.type === "relates_to" || e.type === "related_to") {
      if (nodes[e.from]?.type !== "character" || nodes[e.to]?.type !== "character") continue;
      const [a, b] = e.from < e.to ? [e.from, e.to] : [e.to, e.from];
      const key = `${a}|${b}`;
      const cur = pairLabel.get(key);
      // A labeled edge wins over an unlabeled one either way round.
      pairLabel.set(key, { a, b, label: cur?.label ?? (e.label || null) });
    } else if (e.type === "embodies") {
      let arr = embodiesByChar.get(e.from);
      if (!arr) {
        arr = [];
        embodiesByChar.set(e.from, arr);
      }
      if (!arr.includes(e.to)) arr.push(e.to);
    }
  }

  // Pre-index relations by character:
  const charRelations = new Map<string, Relation[]>();
  for (const rel of pairLabel.values()) {
    let aList = charRelations.get(rel.a);
    if (!aList) {
      aList = [];
      charRelations.set(rel.a, aList);
    }
    aList.push({ otherId: rel.b, label: rel.label });

    let bList = charRelations.get(rel.b);
    if (!bList) {
      bList = [];
      charRelations.set(rel.b, bList);
    }
    bList.push({ otherId: rel.a, label: rel.label });
  }

  for (const nid in nodes) {
    const n = nodes[nid];
    if (!n || n.type !== "character") continue;
    const d = ensure(n.id);

    const seen = new Set<string>();
    const ranked: Array<{ id: string; r: number }> = [];
    const loose: string[] = [];
    const scenes = rawScenes.get(n.id);
    if (scenes) {
      for (const sid of scenes) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        const r = rank.get(sid);
        if (r === undefined) loose.push(sid);
        else ranked.push({ id: sid, r });
      }
    }
    ranked.sort((x, y) => x.r - y.r);
    d.sceneIds = [...ranked.map((x) => x.id), ...loose];
    d.firstSceneId = ranked[0]?.id ?? null;
    d.lastSceneId = ranked[ranked.length - 1]?.id ?? null;

    const locSet = new Set<string>();
    const locs: string[] = [];
    for (const sid of d.sceneIds) {
      const sl = sceneLocations.get(sid);
      if (sl) {
        for (const lid of sl) {
          if (!locSet.has(lid)) {
            locSet.add(lid);
            locs.push(lid);
          }
        }
      }
    }
    d.locationIds = locs;
    d.relations = charRelations.get(n.id) ?? [];
    d.themeIds = embodiesByChar.get(n.id) ?? [];
  }

  return details;
}
