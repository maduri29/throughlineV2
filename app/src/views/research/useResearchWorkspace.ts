import { useEffect, useMemo, useRef, useState } from "react";
import { Effect } from "effect";
import { BEAT_SHEETS, beatSheetRows } from "../../data/beatsheets";
import {
  checkAttachmentsPresenceEffect,
  describeSize,
  MAX_FILE_BYTES,
  putFile,
} from "../../data/files";
import { GUIDES } from "../../data/guides";
import {
  SHELF_BOOKS,
  TELUGU_SCRIPTS,
  shelfCategoryLabel,
  type ShelfKind,
} from "../../data/teluguScripts";
import { dbGetAll } from "../../data/idb";
import { scopedScenesByProjectEffect } from "../../data/library";
import { useGraphStore } from "../../store";
import type { Attachment, GraphEdge, GraphNode } from "../../types";

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ResearchTypeFilter = "all" | "beats" | "notes" | "links" | "files";

export function useResearchWorkspace() {
  const references = useGraphStore((s) => s.references);
  const projects = useGraphStore((s) => s.projects);
  const openProjectId = useGraphStore((s) => s.projectId);
  const addReference = useGraphStore((s) => s.addReference);
  const patchReference = useGraphStore((s) => s.patchReference);
  const deleteReference = useGraphStore((s) => s.deleteReference);

  const [scope, setScope] = useState<string>("shared");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (chosen || !openProjectId) return;
    // oxlint-disable-next-line react/set-state-in-effect
    setScope(openProjectId);
  }, [openProjectId, chosen]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [teluguId, setTeluguId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [shelfWhat, setShelfWhat] = useState<"all" | ShelfKind>("all");
  const [shelfLang, setShelfLang] = useState<string>("all");
  const [section, setSection] = useState<"collection" | "telugu">("collection");
  const [draft, setDraft] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [captureActive, setCaptureActive] = useState(false);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResearchTypeFilter>("all");
  const [problem, setProblem] = useState<string | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [scenesByProject, setScenesByProject] = useState<Record<string, GraphNode[]>>({});

  useEffect(() => {
    let live = true;
    void (async () => {
      const [nodesArr, edgesArr] = await Promise.all([
        dbGetAll<GraphNode>("nodes"),
        dbGetAll<GraphEdge>("edges"),
      ]);
      const next = await Effect.runPromise(
        scopedScenesByProjectEffect(projects, nodesArr, edgesArr),
      );
      if (live) setScenesByProject(next);
    })();
    return () => {
      live = false;
    };
  }, [projects]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const attachmentIds: string[] = [];
      for (const r of references) {
        if (r.attachments) {
          for (const a of r.attachments) attachmentIds.push(a.id);
        }
      }
      if (attachmentIds.length === 0) {
        if (live) setPresent({});
        return;
      }
      const presence = await Effect.runPromise(checkAttachmentsPresenceEffect(attachmentIds));
      if (live) setPresent(presence);
    })();
    return () => {
      live = false;
    };
  }, [references]);

  const inScope = useMemo(
    () =>
      references.filter((r) =>
        scope === "all" ? true : scope === "shared" ? !r.parentId : r.parentId === scope,
      ),
    [references, scope],
  );

  const counts = useMemo(() => {
    let beats = 0;
    let notes = 0;
    let links = 0;
    let files = 0;
    for (const r of inScope) {
      if (r.beats) beats++;
      else if (!r.url) notes++;
      if (r.url) links++;
      if ((r.attachments?.length ?? 0) > 0) files++;
    }
    return {
      all: inScope.length,
      beats,
      notes,
      links,
      files,
    };
  }, [inScope]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return inScope.filter((r) => {
      if (typeFilter === "beats" && !r.beats) return false;
      if (typeFilter === "notes" && (r.beats || r.url)) return false;
      if (typeFilter === "links" && !r.url) return false;
      if (typeFilter === "files" && (!r.attachments || r.attachments.length === 0)) return false;

      if (!term) return true;
      if (r.title.toLowerCase().includes(term)) return true;
      if (r.synopsis?.toLowerCase().includes(term)) return true;
      if (r.url?.toLowerCase().includes(term)) return true;
      if (
        r.beats?.some(
          (b) => b.name.toLowerCase().includes(term) || b.note?.toLowerCase().includes(term),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [inScope, typeFilter, query]);

  const projectTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.title);
    }
    return map;
  }, [projects]);

  const titleOf = (id: string | undefined): string =>
    (id ? projectTitleMap.get(id) : undefined) ?? "Shared";

  const add = (): void => {
    const t = draft.trim();
    if (!t) {
      setCaptureActive(true);
      composerInputRef.current?.focus();
      return;
    }
    setProblem(null);
    const extra: Partial<GraphNode> = {};
    if (draftNote.trim()) {
      extra.synopsis = draftNote.trim();
    }
    addReference(t, scope === "all" || scope === "shared" ? null : scope, extra)
      .then((id) => {
        setOpenId(id);
        setDraft("");
        setDraftNote("");
        setCaptureActive(false);
      })
      .catch((err: unknown) => setProblem(String(err)));
  };

  const applySheet = (sheetId: string): void => {
    const sheet = BEAT_SHEETS.find((b) => b.id === sheetId);
    if (!sheet) return;
    setProblem(null);
    try {
      addReference(sheet.name, scope === "all" || scope === "shared" ? null : scope, {
        beats: beatSheetRows(sheet, () => newId()),
      })
        .then(setOpenId)
        .catch((err: unknown) => setProblem(String(err)));
    } catch (err) {
      setProblem(String(err));
    }
  };

  const saveGuide = (id: string): void => {
    const guide = GUIDES.find((g) => g.id === id);
    if (!guide) return;
    setProblem(null);
    addReference(guide.name, scope === "all" || scope === "shared" ? null : scope, {
      synopsis: guide.body,
    })
      .then((refId) => {
        setGuideId(null);
        setOpenId(refId);
      })
      .catch((err: unknown) => setProblem(String(err)));
  };

  const saveBook = (id: string): void => {
    const book = SHELF_BOOKS.find((b) => b.id === id);
    if (!book) return;
    setProblem(null);
    const body = [
      `${book.title} (${book.year}) — ${book.lang} · Books.`,
      `By ${book.author}. ${book.detail}.`,
      "",
      book.blurb,
      "",
      `Why read it: ${book.why}`,
    ].join("\n");
    addReference(`${book.title} — book`, scope === "all" || scope === "shared" ? null : scope, {
      synopsis: body,
      url: book.pageUrl,
    })
      .then((refId) => {
        setBookId(null);
        setOpenId(refId);
      })
      .catch((err: unknown) => setProblem(String(err)));
  };

  const saveTelugu = (id: string): void => {
    const script = TELUGU_SCRIPTS.find((t) => t.id === id);
    if (!script) return;
    setProblem(null);
    const body = [
      `${script.title} (${script.year}) — ${shelfCategoryLabel(script)}.`,
      `Written by ${script.writer}; directed by ${script.director}.`,
      `Format: ${script.format}. Source: ${script.source}.`,
      "",
      script.logline,
      "",
      `Why study it: ${script.studyNote}`,
    ].join("\n");
    addReference(
      `${script.title} (${script.year}) — screenplay`,
      scope === "all" || scope === "shared" ? null : scope,
      { synopsis: body, url: script.pageUrl },
    )
      .then((refId) => {
        setTeluguId(null);
        setOpenId(refId);
      })
      .catch((err: unknown) => setProblem(String(err)));
  };

  const attach = async (ref: GraphNode, file: File): Promise<void> => {
    if (file.size > MAX_FILE_BYTES) {
      setProblem(
        `${file.name} is ${describeSize(file.size)}; the limit is ${describeSize(MAX_FILE_BYTES)}.`,
      );
      return;
    }
    setProblem(null);
    const meta: Attachment = {
      id: newId(),
      name: file.name,
      mime: file.type,
      size: file.size,
    };
    await putFile(meta.id, file);
    await patchReference(ref.id, { attachments: [...(ref.attachments ?? []), meta] });
    setPresent((p) => ({ ...p, [meta.id]: true }));
  };

  return {
    references,
    projects,
    scope,
    setScope,
    setChosen,
    openId,
    setOpenId,
    guideId,
    setGuideId,
    teluguId,
    setTeluguId,
    bookId,
    setBookId,
    shelfWhat,
    setShelfWhat,
    shelfLang,
    setShelfLang,
    section,
    setSection,
    draft,
    setDraft,
    draftNote,
    setDraftNote,
    captureActive,
    setCaptureActive,
    composerInputRef,
    query,
    setQuery,
    typeFilter,
    setTypeFilter,
    problem,
    setProblem,
    present,
    scenesByProject,
    inScope,
    counts,
    shown,
    titleOf,
    add,
    applySheet,
    saveGuide,
    saveBook,
    saveTelugu,
    attach,
    patchReference,
    deleteReference,
  };
}
