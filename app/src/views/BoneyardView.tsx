import { useMemo, useRef, useState } from "react";
import type { Thought } from "../data/boneyard/types";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowLeft, Search, Pin, Lightbulb, Download, Upload } from "lucide-react";
import { ideaLabel } from "../data/boneyard/repository";
import { useBoneyard } from "./boneyard/useBoneyard";
import { useDraft, DraftWarning, date } from "./boneyard/Draft";
import { CollectionEditor } from "./boneyard/CollectionEditor";
import { IdeaDetail } from "./boneyard/IdeaDetail";
import { EvolutionPreview } from "./boneyard/EvolutionPreview";
import { ConflictReview } from "./boneyard/ConflictReview";

export default function BoneyardView({ onGrown }: { onGrown: (id: string) => void }) {
  const by = useBoneyard();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("idea");
  const selected = by.snapshot.ideas.find((i) => i.id === selectedId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [collectionId, setCollectionId] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [evolving, setEvolving] = useState<string[] | null>(null);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const draft = useDraft("throughline:boneyard:draft");
  const activeCollections = by.snapshot.collections.filter((c) => !c.deleted);
  const open = (id: string) => router.push(`/boneyard?idea=${encodeURIComponent(id)}`);
  const close = () => router.push("/boneyard");
  const term = query.trim().toLocaleLowerCase();
  const [visibleLimit, setVisibleLimit] = useState(100);
  const thoughtsByIdea = useMemo(() => {
    const grouped = new Map<string, Thought[]>();
    for (const thought of by.snapshot.thoughts)
      if (!thought.deleted) {
        const list = grouped.get(thought.ideaId) ?? [];
        list.push(thought);
        grouped.set(thought.ideaId, list);
      }
    return grouped;
  }, [by.snapshot.thoughts]);
  const searchIndex = useMemo(
    () =>
      new Map(
        by.snapshot.ideas.map((idea) => [
          idea.id,
          [
            idea.title,
            idea.body,
            ...idea.tags,
            ...(thoughtsByIdea.get(idea.id) ?? []).map((t) => t.body),
          ]
            .join("\n")
            .toLocaleLowerCase(),
        ]),
      ),
    [by.snapshot.ideas, thoughtsByIdea],
  );
  const matches = by.snapshot.ideas.filter((idea) => {
    if (
      filter === "pinned"
        ? !idea.pinned || idea.disposition !== "active"
        : idea.disposition !== filter
    )
      return false;
    if (
      collectionId &&
      !by.snapshot.memberships.some(
        (m) => !m.deleted && m.ideaId === idea.id && m.collectionId === collectionId,
      )
    )
      return false;
    return !term || !!searchIndex.get(idea.id)?.includes(term);
  });
  async function capture() {
    if (await by.run(() => by.capture(draft.text))) {
      draft.setText("");
      setNotice("Idea kept. Leave another whenever it arrives.");
      composer.current?.focus();
    }
  }
  return (
    <main className={`tln-library by-page${selectedId ? " by-page--selected" : ""}`}>
      <header className="by-header">
        <div>
          <p className="by-eyebrow">ROOM TO WANDER</p>
          <h1 className="by-title">Boneyard</h1>
          <p className="by-subtitle">
            Loose thoughts. Unexpected connections. Stories still becoming.
          </p>
        </div>
        <div className="by-actions">
          <button
            className="tln-btn"
            disabled={by.pending}
            onClick={() => void by.run(by.exportBackup)}
          >
            <Download size={15} /> Back up ideas
          </button>
          <button className="tln-btn" disabled={by.pending} onClick={() => input.current?.click()}>
            <Upload size={15} /> Import ideas
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json"
            aria-label="Import ideas backup"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void by.run(() => by.importBackup(file));
            }}
          />
        </div>
      </header>
      <ConflictReview by={by} onOpen={open} />
      {by.error && (
        <p className="by-error" role="alert">
          {by.error}
        </p>
      )}
      {notice && (
        <p role="status" className="by-notice">
          {notice}
        </p>
      )}
      <section className="by-capture" aria-label="Capture an idea">
        <textarea
          ref={composer}
          aria-label="New idea"
          placeholder="Leave a thought here. A line, a question, a whole possibility…"
          value={draft.text}
          onChange={(e) => draft.setText(e.target.value)}
          rows={3}
          disabled={by.pending}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (draft.text.trim()) void capture();
            }
          }}
        />
        <div className="by-capture__actions">
          <span>No title or category needed. Ctrl / ⌘ + Enter to keep.</span>
          <button
            className="tln-btn tln-btn--accent"
            disabled={!draft.text.trim() || by.pending}
            onClick={() => void capture()}
          >
            <Plus size={16} /> {by.pending ? "Saving…" : "Keep idea"}
          </button>
        </div>
        <DraftWarning show={draft.draftError} />
      </section>
      <div className="by-controls">
        <div className="by-search">
          <Search size={16} />
          <input
            aria-label="Search ideas"
            placeholder="Find a thought, phrase, or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="by-filters">
          {[
            ["active", "All ideas"],
            ["pinned", "Pinned"],
            ["aside", "Set aside"],
            ["trash", "Trash"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`by-filter${filter === value ? " by-filter--on" : ""}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value!)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by collection"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
        >
          <option value="">Every collection</option>
          {activeCollections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          className="tln-btn"
          disabled={by.pending}
          onClick={() =>
            void by.run(async () => {
              const id = await by.revisit();
              if (id) {
                open(id);
                setNotice("An idea to revisit. Skip it freely; it won’t be suggested again today.");
              } else
                setNotice(
                  "Nothing to revisit right now. Recently shown and snoozed ideas are resting.",
                );
            })
          }
        >
          Revisit an idea
        </button>
      </div>
      <details className="by-collections">
        <summary>
          Collections <span>{activeCollections.length}</span>
        </summary>
        <form
          className="by-actions"
          onSubmit={(e) => {
            e.preventDefault();
            void by
              .run(() => by.createCollection(collectionTitle))
              .then((ok) => {
                if (ok) setCollectionTitle("");
              });
          }}
        >
          <input
            aria-label="New collection name"
            placeholder="A loose collection…"
            value={collectionTitle}
            onChange={(e) => setCollectionTitle(e.target.value)}
          />
          <button className="tln-btn" disabled={!collectionTitle.trim() || by.pending}>
            Create collection
          </button>
        </form>
        {activeCollections.map((c) => (
          <CollectionEditor
            key={c.id}
            collection={c}
            by={by}
            onRemoved={() => {
              if (collectionId === c.id) setCollectionId("");
            }}
          />
        ))}
        {by.snapshot.collections
          .filter((c) => c.deleted)
          .map((c) => (
            <p key={c.id}>
              {c.title}{" "}
              <button
                className="tln-btn"
                disabled={by.pending}
                onClick={() => void by.run(() => by.editCollection(c.id, { deleted: false }))}
              >
                Restore collection
              </button>
            </p>
          ))}
      </details>
      {chosen.length > 0 && (
        <div className="by-selection">
          <span>{chosen.length} selected</span>
          <button className="tln-btn tln-btn--accent" onClick={() => setEvolving(chosen)}>
            Evolve selected ideas
          </button>
          <button className="tln-btn" onClick={() => setChosen([])}>
            Clear selection
          </button>
        </div>
      )}
      <div className={`by-workspace${selectedId ? " by-workspace--detail" : ""}`}>
        <section className="by-list" aria-label="Ideas">
          <p className="by-meta" role="status">
            {by.loading
              ? "Opening your ideas…"
              : `${matches.length} idea${matches.length === 1 ? "" : "s"}`}
          </p>
          {!by.loading && !matches.length && (
            <div className="by-empty">
              <Lightbulb size={28} />
              <h2>
                {by.snapshot.ideas.length
                  ? "No ideas here yet"
                  : "It doesn’t have to be a story yet."}
              </h2>
              <p>
                {term
                  ? "Try another phrase. Search includes your follow-up thoughts."
                  : "Keep the fragment. You can figure out what it means later."}
              </p>
            </div>
          )}
          {matches.slice(0, visibleLimit).map((idea) => {
            const thoughts = thoughtsByIdea.get(idea.id) ?? [];
            const matchedThought = term
              ? thoughts.find((t) => t.body.toLocaleLowerCase().includes(term))
              : undefined;
            return (
              <article
                key={idea.id}
                className={`by-card${selectedId === idea.id ? " by-card--on" : ""}`}
              >
                <div className="by-card__head">
                  <button className="by-card__title" onClick={() => open(idea.id)}>
                    {ideaLabel(idea)}
                  </button>
                  <button
                    className="by-icon-button"
                    aria-label={idea.pinned ? "Unpin idea" : "Pin idea"}
                    aria-pressed={idea.pinned}
                    disabled={by.pending}
                    onClick={() =>
                      void by.run(() => by.editIdea(idea.id, { pinned: !idea.pinned }))
                    }
                  >
                    <Pin size={16} />
                  </button>
                </div>
                <p className="by-card__summary">{idea.body}</p>
                {matchedThought && (
                  <p className="by-match">In a thought: {matchedThought.body.slice(0, 180)}</p>
                )}
                <div className="by-meta">
                  <span>{date(idea.createdAt)}</span>
                  <span>{thoughts.length} thoughts</span>
                  {idea.tags.map((tag) => (
                    <span key={tag} className="by-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="by-actions">
                  <button className="tln-btn" onClick={() => open(idea.id)}>
                    Explore idea
                  </button>
                  {idea.disposition !== "trash" && (
                    <label className="by-select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${ideaLabel(idea)} for evolution`}
                        checked={chosen.includes(idea.id)}
                        onChange={(e) =>
                          setChosen((ids) =>
                            e.target.checked
                              ? [...ids, idea.id]
                              : ids.filter((id) => id !== idea.id),
                          )
                        }
                      />{" "}
                      Select
                    </label>
                  )}
                </div>
              </article>
            );
          })}
          {matches.length > visibleLimit && (
            <button className="tln-btn" onClick={() => setVisibleLimit((limit) => limit + 100)}>
              Show more ideas ({matches.length - visibleLimit} remaining)
            </button>
          )}
        </section>
        {selected && (
          <IdeaDetail
            key={selected.id}
            idea={selected}
            by={by}
            onClose={close}
            onOpen={open}
            onEvolve={() => setEvolving([selected.id])}
            onGrown={onGrown}
          />
        )}
        {selectedId && !selected && !by.loading && (
          <section className="by-detail">
            <button className="tln-btn" onClick={close}>
              <ArrowLeft size={15} /> Back to ideas
            </button>
            <p>
              This idea isn’t available on this device. Import its Boneyard backup or sync to
              recover it.
            </p>
          </section>
        )}
      </div>
      {evolving && (
        <EvolutionPreview
          sourceIds={evolving}
          by={by}
          onClose={() => setEvolving(null)}
          onGrown={onGrown}
        />
      )}
    </main>
  );
}
