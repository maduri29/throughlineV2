// Library (T4 level 1): all stories on this machine; open or create.
import { useState } from "react";
import { useGraphStore } from "../store";

export default function LibraryView() {
  const projects = useGraphStore((s) => s.projects);
  const switchProject = useGraphStore((s) => s.switchProject);
  const createProject = useGraphStore((s) => s.createProject);
  const [title, setTitle] = useState("");

  return (
    <div className="tln-library">
      <h1 className="tln-library__head">Your stories</h1>
      <div className="tln-library__grid">
        {projects.map((p) => (
          <button key={p.id} className="tln-storycard" onClick={() => void switchProject(p.id)}>
            <span className="tln-storycard__title">{p.title}</span>
            <span className="tln-storycard__by">
              {p.author ? `by ${p.author}` : "untitled author"}
            </span>
          </button>
        ))}
        <div className="tln-storycard tln-storycard--new">
          <input
            className="tln-storycard__input"
            placeholder="New story title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                void createProject(title.trim());
                setTitle("");
              }
            }}
          />
          <button
            className="tln-btn"
            disabled={!title.trim()}
            onClick={() => {
              if (!title.trim()) return;
              void createProject(title.trim());
              setTitle("");
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
