import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Compass, Search, X } from "lucide-react";
import { useGraphStore } from "../store";
import { SECTIONS } from "../shell/navigation";

type Item = {
  id: string;
  group: "Places" | "Stories" | "In your current story";
  label: string;
  sub: string;
  href?: string;
  type?: string;
};

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export default function Palette({
  open,
  onClose,
  onJump,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onJump: (id: string, type: string) => void;
  onNavigate: (href: string) => void;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const projects = useGraphStore((s) => s.projects);
  const projectId = useGraphStore((s) => s.projectId);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const q = query.trim().toLowerCase();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    inputRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const places: Item[] = SECTIONS.filter((section) =>
      `${section.label} ${section.id === "boneyard" ? "ideas capture" : section.id === "research" ? "references sources" : "library"}`
        .toLowerCase()
        .includes(q),
    ).map((section) => ({
      id: section.id,
      group: "Places",
      label: section.label,
      sub:
        section.id === "stories"
          ? "Your story library"
          : section.id === "boneyard"
            ? "Capture and develop ideas"
            : "Explore your sources and references",
      href: section.href,
    }));
    const stories: Item[] = projects
      .filter((story) =>
        `${story.title} ${story.synopsis ?? ""} ${story.author ?? ""}`.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          Number(b.id === projectId) - Number(a.id === projectId) || a.title.localeCompare(b.title),
      )
      .slice(0, 8)
      .map((story) => ({
        id: story.id,
        group: "Stories",
        label: story.title,
        sub: story.id === projectId ? "Current story" : "Open story",
        href: `/stories/${encodeURIComponent(story.id)}`,
      }));
    const storyNodes: Item[] = Object.values(nodes)
      .filter(
        (node) =>
          node.type !== "project" &&
          node.type !== "reference" &&
          `${node.title} ${node.synopsis ?? ""} ${node.type} ${node.fountain ?? ""} ${node.backstory ?? ""} ${node.role ?? ""} ${node.age ?? ""} ${node.traits ?? ""} ${node.motivation ?? ""} ${node.conflict ?? ""} ${node.appearance ?? ""} ${node.relationships ?? ""}`
            .toLowerCase()
            .includes(q),
      )
      .sort(
        (a, b) =>
          Number(b.title.toLowerCase().startsWith(q)) -
            Number(a.title.toLowerCase().startsWith(q)) || a.title.localeCompare(b.title),
      )
      .slice(0, 12)
      .map((node) => ({
        id: node.id,
        group: "In your current story",
        label: node.title || "Untitled",
        sub: node.type + (node.synopsis ? ` · ${node.synopsis}` : ""),
        type: node.type,
      }));
    return q ? [...stories, ...storyNodes, ...places] : [...places, ...stories, ...storyNodes];
  }, [q, nodes, projects, projectId]);

  const safeActive = Math.max(0, Math.min(active, items.length - 1));
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [safeActive, items]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.href) onNavigate(item.href);
    else onJump(item.id, item.type ?? "scene");
  }

  return (
    <dialog
      ref={dialogRef}
      className="tln-palette"
      aria-label="Quick search"
      aria-describedby={`${id}-scope`}
      onCancel={onClose}
      onKeyDown={(event) => {
        // Keep map and editor shortcuts from acting behind the modal.
        if (!((event.ctrlKey || event.metaKey) && ["k", "s"].includes(event.key.toLowerCase()))) {
          event.stopPropagation();
        }
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("input, button");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="tln-palette__search-row">
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          className="tln-palette__input"
          role="combobox"
          aria-label="Search stories and current story content"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-activedescendant={items.length ? `${id}-item-${safeActive}` : undefined}
          placeholder="Find a story, scene, or place…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setActive(items.length ? (safeActive + direction + items.length) % items.length : 0);
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(items[safeActive]);
            }
          }}
        />
        <button className="tln-palette__close" aria-label="Close quick search" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="tln-palette__scope" id={`${id}-scope`}>
        All story titles · Scenes and characters in your current story
      </p>
      <div
        className="tln-palette__list"
        ref={listRef}
        id={`${id}-results`}
        role="listbox"
        aria-label="Search results"
      >
        {items.map((item, index) => (
          <div key={`${item.group}-${item.id}`} role="presentation">
            {items[index - 1]?.group !== item.group && (
              <div className="tln-palette__group" role="presentation">
                {item.group}
              </div>
            )}
            <div
              id={`${id}-item-${index}`}
              role="option"
              aria-selected={index === safeActive}
              className={`tln-palette__item${index === safeActive ? " tln-palette__item--on" : ""}`}
              onMouseMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span className="tln-palette__icon" aria-hidden="true">
                {item.group === "Places" ? (
                  <Compass size={17} />
                ) : item.group === "Stories" ? (
                  <BookOpen size={17} />
                ) : (
                  <Search size={17} />
                )}
              </span>
              <span className="tln-palette__copy">
                <span className="tln-palette__label">
                  <Highlight text={item.label} query={q} />
                </span>
                <span className="tln-palette__sub">{item.sub}</span>
              </span>
              <ArrowUpRight size={15} className="tln-palette__arrow" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
      {!items.length && (
        <div className="tln-palette__empty">
          <Search size={25} aria-hidden="true" />
          <strong>No matches for “{query.trim()}”</strong>
          <p>Try a story title, character, or a few words from a scene.</p>
          <button
            className="tln-btn"
            onClick={() => {
              setQuery("");
              setActive(0);
              inputRef.current?.focus();
            }}
          >
            Clear search
          </button>
        </div>
      )}
      <div className="tln-palette__hint">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close
        </span>
        <span role="status">
          {items.length} {items.length === 1 ? "result" : "results"} shown
        </span>
      </div>
    </dialog>
  );
}
