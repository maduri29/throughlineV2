import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store";
import { dbGetAll } from "../../data/idb";
import { summarizeStories, type StoryStats } from "../../data/library";
import type { GraphEdge, GraphNode } from "../../types";

export function useStoryLibrary(onOpen: (id: string) => void) {
  const projects = useGraphStore((s) => s.projects);
  const durability = useGraphStore((s) => s.durability);
  const [stats, setStats] = useState<Record<string, StoryStats>>({});
  const [statsError, setStatsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nodes, edges] = await Promise.all([
          dbGetAll<GraphNode>("nodes"),
          dbGetAll<GraphEdge>("edges"),
        ]);
        if (!cancelled) {
          setStats(summarizeStories(projects, nodes, edges));
          setStatsError(null);
        }
      } catch {
        if (!cancelled)
          setStatsError("Story counts are unavailable. You can still open your stories.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  async function run(label: string, operation: () => Promise<void>): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (cause) {
      setError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return {
    projects,
    durability,
    stats,
    statsError,
    error,
    pending,
    create: (title: string) =>
      run("Could not create story", async () => {
        const id = await useGraphStore.getState().createProject(title.trim());
        onOpen(id);
      }),
    open: (id: string) =>
      run("Could not open story", async () => {
        await useGraphStore.getState().switchProject(id);
        onOpen(id);
      }),
    sample: () =>
      run("Could not open sample", async () => {
        const id = await useGraphStore.getState().openSample();
        if (id) onOpen(id);
      }),
    importBackup: (file: File) =>
      run("Could not import backup", async () => {
        const issue = await useGraphStore.getState().importProject(await file.text());
        if (issue) throw new Error(issue);
      }),
  };
}
