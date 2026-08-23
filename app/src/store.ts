// Scaffold persistence layer: zustand persisted to IndexedDB through idb-keyval
// (proven in research/bun-native-proof.md). The custom normalized-store adapter
// from ADR-0001 replaces this during the build phase.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { demoGraph } from "./demo";
import type { GraphEdge, GraphNode } from "./types";

type GraphState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seededAt: string;
};

export const useGraphStore = create<GraphState>()(
  persist(() => ({ ...demoGraph(), seededAt: new Date().toISOString() }), {
    name: "throughline.scaffold.v1",
    version: 1,
    storage: createJSONStorage(() => ({
      getItem: (name: string) => get(name),
      setItem: (name: string, value: string) => set(name, value),
      removeItem: (name: string) => del(name),
    })),
  }),
);
