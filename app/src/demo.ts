// THROWAWAY SEED — scaffold placeholder so first run shows the full concept.
// ADR-0001 is the normative model; the real normalized IndexedDB adapter and
// library seeding land during the build phase.
import type { EdgeType, GraphEdge, GraphNode, NodeType, StoryTime, Tod } from "./types";

/** UUIDv7 (unix-ms timestamp + random); crypto.randomUUID() is v4, so roll our own. */
export function uuidv7(): string {
  const ts = Date.now();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const t = ts.toString(16).padStart(12, "0");
  const variant = ((parseInt(rand[3] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${t.slice(0, 8)}-${t.slice(8)}-7${rand.slice(0, 3)}-${variant}${rand.slice(4, 7)}-${rand.slice(7, 19)}`;
}

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

const N = (type: NodeType, title: string, extra: Partial<GraphNode> = {}): GraphNode => {
  const node: GraphNode = { id: uuidv7(), type, title, ...extra };
  nodes.push(node);
  return node;
};

const E = (type: EdgeType, from: string, to: string, label?: string): void => {
  edges.push(label ? { id: uuidv7(), type, from, to, label } : { id: uuidv7(), type, from, to });
};

const T = (storyDay: number | null, tod: Tod | null): StoryTime => ({
  storyDay,
  tod,
  eraLabel: null,
});

/* ---------- HIGH WATER (limited series) ---------- */
const project = N("project", "HIGH WATER", {
  synopsis: "Limited series · storm season on the coast",
});

const ep1 = N("episode", "E1 · RISE", { parentId: project.id });
const ep2 = N("episode", "E2 · PRESSURE", { parentId: project.id });
const ep3 = N("episode", "E3 · BREACH", { parentId: project.id });
for (const ep of [ep1, ep2, ep3]) E("contains", project.id, ep.id);

const maya = N("character", "Maya");
const eli = N("character", "Eli");
const sam = N("character", "Sam");
const cole = N("character", "Cole");
const boathouse = N("location", "Boathouse");
const shallows = N("location", "Shallows");
const ranch = N("location", "Ranch");
const countyRd = N("location", "County Rd");
const water = N("theme", "The Water");
const duty = N("theme", "Duty");

const S = (
  ep: GraphNode,
  storyDay: number,
  tod: Tod,
  title: string,
  synopsis: string,
): GraphNode => {
  const scene = N("scene", title, {
    parentId: ep.id,
    storyTime: T(storyDay, tod),
    synopsis,
  });
  E("contains", ep.id, scene.id);
  return scene;
};

/* E1 · RISE */
const stormTips = S(
  ep1,
  1,
  "Night",
  "Storm tips",
  "Maya drags the airboat onto the lift as the surge hits.",
);
S(ep1, 1, "Night", "Headcount", "Eli counts boats twice; one is missing.");
const flare = S(ep1, 2, "Dawn", "Flare", "A flare arcs over the shallows. Nobody radioed it in.");
const manifest = S(
  ep1,
  2,
  "Day",
  "Manifest",
  "Maya finds Cole's name on a manifest that shouldn't exist.",
);
const logBook = S(ep1, 4, "Night", "Log book", "Two log books, one storm.");

/* E2 · PRESSURE */
const detour = S(ep2, 5, "Day", "Detour", "Cole reroutes dredge permits through a dead LLC.");
const theCatch = S(ep2, 6, "Day", "Catch", "Sam nets a gate hinge stamped with the county seal.");
const radio = S(
  ep2,
  6,
  "Night",
  "Radio silence",
  "Maya calls the yard; someone hangs up mid-ring.",
);
const deed = S(ep2, 7, "Day", "Deed", "Eli learns the ranch was collateral all along.");
const buoy = S(ep2, 8, "Night", "Buoy", "A strobe buoy marks nothing on any chart.");

/* E3 · BREACH */
const hearing = S(
  ep3,
  9,
  "Day",
  "Hearing",
  "The county hearing is a staged play with one missing actor.",
);
const tape = S(ep3, 10, "Night", "Tape", "Maya plays the yard recording to a silent garage.");
const offer = S(ep3, 10, "Dusk", "Offer", "Cole offers Eli the ranch back, signed clean.");
const arrest = S(ep3, 11, "Day", "Arrest", "Cole surrenders before the cuff is offered.");
const launch = S(ep3, 12, "Dawn", "Launch", "Maya launches alone into a flat, honest morning.");

/* Flashback scenes — negative storyDays, linked by flashback_of */
const soloRun = N("scene", "Solo run", {
  storyTime: T(-9, "Day"),
  synopsis: "Nine-year-old Maya steers the airboat solo, laughing.",
});
const signature = N("scene", "The signature", {
  storyTime: T(-2, "Dusk"),
  synopsis: "Dad signs something at the kitchen table, not reading it.",
});

/* precedes chains */
for (const chain of [
  [stormTips, flare, manifest, logBook],
  [detour, theCatch, radio, deed, buoy],
  [hearing, tape, offer, arrest, launch],
]) {
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    if (a && b) E("precedes", a.id, b.id);
  }
}

E("flashback_of", soloRun.id, launch.id);
E("flashback_of", signature.id, deed.id);
E("sets_up", manifest.id, hearing.id);
E("sets_up", detour.id, offer.id);
E("parallels", flare.id, arrest.id, "signals in the storm");
E("appears_in", maya.id, manifest.id);
E("appears_in", cole.id, arrest.id);
E("appears_in", sam.id, theCatch.id);
E("appears_in", eli.id, radio.id);
E("takes_place_at", stormTips.id, boathouse.id);
E("takes_place_at", theCatch.id, shallows.id);
E("takes_place_at", deed.id, ranch.id);
E("takes_place_at", detour.id, countyRd.id);
E("embodies", maya.id, water.id);
E("embodies", eli.id, duty.id);
E("related_to", boathouse.id, water.id);

export function demoGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return { nodes: [...nodes], edges: [...edges] };
}
