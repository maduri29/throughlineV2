import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Compass,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  SunMoon,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useGraphStore } from "../store";
import { SECTIONS } from "../shell/navigation";

type Item = {
  id: string;
  group: "Commands" | "Places" | "Stories" | "In your current story";
  label: string;
  sub: string;
  href?: string;
  type?: string;
  icon?: React.ComponentType<{
    size: number;
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  execute?: () => void;
};

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function Palette({
  open,
  onClose,
  onJump,
  onNavigate,
  onToggleTheme,
  onOpenDiagnostics,
  onSelectLens,
  onAddScene,
  onAddCharacter,
}: {
  open: boolean;
  onClose: () => void;
  onJump: (id: string, type: string) => void;
  onNavigate: (href: string) => void;
  onToggleTheme?: () => void;
  onOpenDiagnostics?: () => void;
  onSelectLens?: (lens: "map" | "timeline" | "characters" | "script") => void;
  onAddScene?: () => void;
  onAddCharacter?: () => void;
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
    const terms = q.split(/\s+/).filter(Boolean);
    const matchesTerms = (haystack: string) => {
      if (terms.length === 0) return true;
      const norm = haystack.toLowerCase().normalize("NFD");
      return terms.every((t) => norm.includes(t.normalize("NFD")));
    };

    // Action Commands
    const commands: Item[] = [];
    if (onOpenDiagnostics) {
      commands.push({
        id: "cmd-diagnostics",
        group: "Commands",
        label: "Story Architecture Diagnostics",
        sub: "Effect-powered narrative health check for cycles, orphans, and craft gaps",
        icon: Activity,
        execute: onOpenDiagnostics,
      });
    }
    if (onToggleTheme) {
      commands.push({
        id: "cmd-theme",
        group: "Commands",
        label: "Toggle Theme",
        sub: "Switch between dark and light workspace themes",
        icon: SunMoon,
        execute: onToggleTheme,
      });
    }
    if (onSelectLens) {
      commands.push(
        {
          id: "cmd-lens-map",
          group: "Commands",
          label: "Switch to Story Map",
          sub: "View beat-board canvas and relationship graph",
          icon: LayoutGrid,
          execute: () => onSelectLens("map"),
        },
        {
          id: "cmd-lens-timeline",
          group: "Commands",
          label: "Switch to Sequence Board",
          sub: "Arrange scenes chronologically into sequences and episodes",
          icon: Calendar,
          execute: () => onSelectLens("timeline"),
        },
        {
          id: "cmd-lens-characters",
          group: "Commands",
          label: "Switch to Character Dossiers",
          sub: "Explore cast roster, arcs, and character profiles",
          icon: Users,
          execute: () => onSelectLens("characters"),
        },
        {
          id: "cmd-lens-script",
          group: "Commands",
          label: "Switch to Script Editor",
          sub: "Write screenplay in Fountain with live preview & Telugu font support",
          icon: FileText,
          execute: () => onSelectLens("script"),
        },
      );
    }
    if (onAddScene && projectId) {
      commands.push({
        id: "cmd-add-scene",
        group: "Commands",
        label: "Add New Scene",
        sub: "Create a new scene card in the current story",
        icon: Plus,
        execute: onAddScene,
      });
    }
    if (onAddCharacter && projectId) {
      commands.push({
        id: "cmd-add-character",
        group: "Commands",
        label: "Add New Character",
        sub: "Create a new character in the story's cast roster",
        icon: UserPlus,
        execute: onAddCharacter,
      });
    }

    const filteredCommands = commands.filter((cmd) =>
      matchesTerms(`${cmd.label} ${cmd.sub} ${cmd.id}`),
    );

    const places: Item[] = SECTIONS.filter((section) =>
      matchesTerms(
        `${section.label} ${section.id === "boneyard" ? "ideas capture" : section.id === "research" ? "references sources telugu scripts" : "library stories"}`,
      ),
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
        matchesTerms(`${story.title} ${story.synopsis ?? ""} ${story.author ?? ""}`),
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
          matchesTerms(
            `${node.title} ${node.synopsis ?? ""} ${node.type} ${node.fountain ?? ""} ${node.backstory ?? ""} ${node.role ?? ""} ${node.age ?? ""} ${node.traits ?? ""} ${node.motivation ?? ""} ${node.conflict ?? ""} ${node.appearance ?? ""} ${node.relationships ?? ""}`,
          ),
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

    if (q) {
      return [...filteredCommands, ...stories, ...storyNodes, ...places];
    }
    return [...filteredCommands.slice(0, 4), ...places, ...stories, ...storyNodes];
  }, [
    q,
    nodes,
    projects,
    projectId,
    onOpenDiagnostics,
    onToggleTheme,
    onSelectLens,
    onAddScene,
    onAddCharacter,
  ]);

  const safeActive = Math.max(0, Math.min(active, items.length - 1));
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [safeActive, items]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.execute) {
      item.execute();
    } else if (item.href) {
      onNavigate(item.href);
    } else {
      onJump(item.id, item.type ?? "scene");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="tln-palette"
      aria-label="Quick search and commands"
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
          aria-label="Search stories, commands, and current story content"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-activedescendant={items.length ? `${id}-item-${safeActive}` : undefined}
          placeholder="Find a story, scene, or type a command (diagnostics, theme, lens)…"
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
        Stories · Commands · Scenes & characters in your current story
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
                {item.icon ? (
                  <item.icon size={17} />
                ) : item.group === "Places" ? (
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
          <p>Try a story title, command (diagnostics, theme, add), or character name.</p>
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
          <kbd>↑</kbd> <kbd>↓</kbd> navigate <kbd>↵</kbd> run/open <kbd>esc</kbd> close
        </span>
        <span role="status">
          {items.length} {items.length === 1 ? "result" : "results"} shown
        </span>
      </div>
    </dialog>
  );
}
