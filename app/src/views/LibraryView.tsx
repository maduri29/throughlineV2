import { useRef, useState } from "react";
import { ArrowRight, BookOpen, Film, Plus, Search, ShieldCheck, Upload, X } from "lucide-react";
import { describeUsage } from "../data/durability";
import { selectStories, type StorySort } from "../data/library";
import { useStoryLibrary } from "./library/useStoryLibrary";
import { StoryCard } from "./library/StoryCard";
import { CreateStoryForm } from "./library/CreateStoryForm";

export default function LibraryView({ onOpen }: { onOpen: (id: string) => void }) {
  const library = useStoryLibrary(onOpen);
  const [naming, setNaming] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<StorySort>("library");
  const importInput = useRef<HTMLInputElement>(null);
  const newStoryButton = useRef<HTMLButtonElement>(null);
  const empty = library.projects.length === 0;
  const visible = selectStories(library.projects, query, sort, library.stats);
  function cancelCreate() {
    setNaming(false);
    newStoryButton.current?.focus();
  }

  return (
    <main className="tln-library">
      <div className="tln-library__inner">
        <header className="tln-library__head">
          <div>
            <p className="tln-library__eyebrow">
              <span /> THE WRITING ROOM
            </p>
            <h1 className="tln-library__title">Your stories</h1>
            <p className="tln-library__count">A little structure. A world of possibilities.</p>
          </div>
          <div className="tln-library__actions">
            <button
              className="tln-btn"
              disabled={library.pending}
              onClick={() => importInput.current?.click()}
            >
              <Upload size={15} aria-hidden="true" /> Import backup…
            </button>
            <input
              ref={importInput}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Import backup file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void library.importBackup(file);
              }}
            />
            <button
              ref={newStoryButton}
              className="tln-btn tln-btn--accent"
              disabled={library.pending}
              aria-expanded={naming}
              onClick={() => setNaming(true)}
            >
              <Plus size={16} aria-hidden="true" /> New story
            </button>
          </div>
        </header>
        {naming && (
          <CreateStoryForm
            pending={library.pending}
            onCancel={cancelCreate}
            onCreate={library.create}
          />
        )}
        {library.error && (
          <p className="tln-library__error" role="alert">
            {library.error}
          </p>
        )}
        {library.statsError && (
          <p className="tln-library__note" role="status">
            {library.statsError}
          </p>
        )}
        {empty ? (
          <section className="tln-library__welcome" aria-labelledby="welcome-title">
            <div className="tln-library__welcome-copy">
              <BookOpen size={30} strokeWidth={1.25} aria-hidden="true" />
              <h2 id="welcome-title">
                Every story starts
                <br />
                with a possibility.
              </h2>
              <p>
                Give that idea somewhere to go. Connect scenes, get to know your characters, and
                turn the pieces into a screenplay.
              </p>
              <button
                className="tln-library__sample"
                disabled={library.pending}
                onClick={() => void library.sample()}
              >
                Open the sample story <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="tln-library__outline" aria-label="Your writing workflow">
              <span className="tln-library__outline-label">FROM FIRST THOUGHT TO FINAL DRAFT</span>
              {[
                ["01", "Find the spark", "Capture an idea worth following."],
                ["02", "Shape the story", "Connect your scenes and characters."],
                ["03", "Write it into being", "Bring it all together on the page."],
              ].map(([number, title, detail]) => (
                <div className="tln-library__step" key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="tln-library__toolbar">
              <h2>
                All stories <span>{library.projects.length}</span>
              </h2>
              <div className="tln-library__filters">
                <div className="tln-library__search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search stories"
                    placeholder="Find a story…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button aria-label="Clear search" onClick={() => setQuery("")}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Sort stories"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as StorySort)}
                >
                  <option value="library">Library order</option>
                  <option value="title">Title A–Z</option>
                  <option value="scenes">Most scenes</option>
                </select>
              </div>
            </div>
            <p className="tln-sr-only" role="status">
              {visible.length} stories shown
            </p>
            {visible.length ? (
              <div className="tln-library__grid">
                {visible.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    stats={library.stats[story.id]}
                    disabled={library.pending}
                    onOpen={() => void library.open(story.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="tln-library__no-results">
                <Search size={24} aria-hidden="true" />
                <h3>No stories found</h3>
                <p>Try another title, author, or phrase.</p>
                <button className="tln-btn" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
        <footer className="tln-library__footer">
          <p className="tln-library__storage">
            <ShieldCheck size={15} aria-hidden="true" />
            {library.durability === null
              ? "Checking local storage…"
              : library.durability.persisted
                ? `Stored in this browser, protected from automatic cleanup${describeUsage(library.durability) ? ` · ${describeUsage(library.durability)}` : ""}`
                : "Stored in this browser. Keep a backup of your work."}
          </p>
          <span>
            <Film size={14} aria-hidden="true" /> Made for the stories only you can tell.
          </span>
        </footer>
      </div>
    </main>
  );
}
