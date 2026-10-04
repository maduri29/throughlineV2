import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Lightbulb, Upload } from "lucide-react";
import Loader from "./Loader";
import { useBoneyard } from "./boneyard/useBoneyard";
import { useDraft } from "./boneyard/Draft";
import { ConflictReview } from "./boneyard/ConflictReview";
import { EvolutionPreview } from "./boneyard/EvolutionPreview";
import { IdeaDetail } from "./boneyard/IdeaDetail";
import { useBoneyardSearch } from "./boneyard/useBoneyardSearch";
import { IdeaCapture } from "./boneyard/IdeaCapture";
import { BoneyardToolbar } from "./boneyard/BoneyardToolbar";
import { CollectionsSection } from "./boneyard/CollectionsSection";
import { IdeaCard } from "./boneyard/IdeaCard";

export default function BoneyardView({ onGrown }: { onGrown: (id: string) => void }) {
  const by = useBoneyard();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("idea");
  const selected = by.snapshot.ideas.find((i) => i.id === selectedId);

  const [chosen, setChosen] = useState<string[]>([]);
  const [evolving, setEvolving] = useState<string[] | null>(null);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const draft = useDraft("throughline:boneyard:draft");

  const search = useBoneyardSearch({
    ideas: by.snapshot.ideas,
    thoughts: by.snapshot.thoughts,
    memberships: by.snapshot.memberships,
  });

  const activeCollections = useMemo(
    () => by.snapshot.collections.filter((c) => !c.deleted),
    [by.snapshot.collections],
  );
  const deletedCollections = useMemo(
    () => by.snapshot.collections.filter((c) => c.deleted),
    [by.snapshot.collections],
  );

  const open = (id: string) => router.push(`/boneyard?idea=${encodeURIComponent(id)}`);
  const close = () => router.push("/boneyard");

  async function capture() {
    if (await by.run(() => by.capture(draft.text))) {
      draft.setText("");
      setNotice("Idea kept. Leave another whenever it arrives.");
      composer.current?.focus();
    }
  }

  const handleRevisit = () => {
    void by.run(async () => {
      const id = await by.revisit();
      if (id) {
        open(id);
        setNotice("An idea to revisit. Skip it freely; it won’t be suggested again today.");
      } else {
        setNotice("Nothing to revisit right now. Recently shown and snoozed ideas are resting.");
      }
    });
  };

  const handleToggleSelectForEvolution = (id: string, isSelected: boolean) => {
    setChosen((ids) => (isSelected ? [...ids, id] : ids.filter((item) => item !== id)));
  };

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

      <IdeaCapture
        composerRef={composer}
        text={draft.text}
        onTextChange={draft.setText}
        onCapture={() => void capture()}
        pending={by.pending}
        draftError={draft.draftError}
      />

      <BoneyardToolbar
        query={search.query}
        onQueryChange={search.setQuery}
        filter={search.filter}
        onFilterChange={search.setFilter}
        collectionId={search.collectionId}
        onCollectionChange={search.setCollectionId}
        activeCollections={activeCollections}
        onRevisit={handleRevisit}
        pending={by.pending}
      />

      <CollectionsSection
        by={by}
        activeCollections={activeCollections}
        deletedCollections={deletedCollections}
        selectedCollectionId={search.collectionId}
        onCollectionRemoved={(id) => {
          if (search.collectionId === id) search.setCollectionId("");
        }}
      />

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
          {by.loading ? (
            <div className="by-meta">
              <Loader inline label="Opening ideas" />
            </div>
          ) : (
            <p className="by-meta" role="status">
              {`${search.matches.length} idea${search.matches.length === 1 ? "" : "s"}`}
            </p>
          )}

          {!by.loading && !search.matches.length && (
            <div className="by-empty">
              <Lightbulb size={28} />
              <h2>
                {by.snapshot.ideas.length
                  ? "No ideas here yet"
                  : "It doesn’t have to be a story yet."}
              </h2>
              <p>
                {search.term
                  ? "Try another phrase. Search includes your follow-up thoughts."
                  : "Keep the fragment. You can figure out what it means later."}
              </p>
            </div>
          )}

          {search.matches.slice(0, search.visibleLimit).map((idea) => {
            const thoughts = search.thoughtsByIdea.get(idea.id) ?? [];
            const matchedThought = search.term
              ? thoughts.find((t) => t.body.toLocaleLowerCase().includes(search.term))
              : undefined;

            return (
              <IdeaCard
                key={idea.id}
                idea={idea}
                isSelected={selectedId === idea.id}
                isChosenForEvolution={chosen.includes(idea.id)}
                matchedThoughtText={matchedThought?.body}
                thoughtCount={thoughts.length}
                pending={by.pending}
                onOpen={open}
                onTogglePin={(item) =>
                  void by.run(() => by.editIdea(item.id, { pinned: !item.pinned }))
                }
                onToggleSelectForEvolution={handleToggleSelectForEvolution}
              />
            );
          })}

          {search.matches.length > search.visibleLimit && (
            <button
              className="tln-btn"
              onClick={() => search.setVisibleLimit((limit) => limit + 100)}
            >
              Show more ideas ({search.matches.length - search.visibleLimit} remaining)
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
