import { Pin } from "lucide-react";
import type { Idea } from "../../data/boneyard/types";
import { ideaLabel } from "../../data/boneyard/repository";
import { date } from "./Draft";

export interface IdeaCardProps {
  idea: Idea;
  isSelected: boolean;
  isChosenForEvolution: boolean;
  matchedThoughtText?: string;
  thoughtCount: number;
  pending: boolean;
  onOpen: (id: string) => void;
  onTogglePin: (idea: Idea) => void;
  onToggleSelectForEvolution: (id: string, selected: boolean) => void;
}

export function IdeaCard({
  idea,
  isSelected,
  isChosenForEvolution,
  matchedThoughtText,
  thoughtCount,
  pending,
  onOpen,
  onTogglePin,
  onToggleSelectForEvolution,
}: IdeaCardProps) {
  const label = ideaLabel(idea);

  return (
    <article className={`by-card${isSelected ? " by-card--on" : ""}`}>
      <div className="by-card__head">
        <button className="by-card__title" onClick={() => onOpen(idea.id)}>
          {label}
        </button>
        <button
          className="by-icon-button"
          aria-label={idea.pinned ? "Unpin idea" : "Pin idea"}
          aria-pressed={idea.pinned}
          disabled={pending}
          onClick={() => onTogglePin(idea)}
        >
          <Pin size={16} />
        </button>
      </div>
      <p className="by-card__summary">{idea.body}</p>
      {matchedThoughtText && (
        <p className="by-match">In a thought: {matchedThoughtText.slice(0, 180)}</p>
      )}
      <div className="by-meta">
        <span>{date(idea.createdAt)}</span>
        <span>{thoughtCount} thoughts</span>
        {idea.tags.map((tag) => (
          <span key={tag} className="by-tag">
            {tag}
          </span>
        ))}
      </div>
      <div className="by-actions">
        <button className="tln-btn" onClick={() => onOpen(idea.id)}>
          Explore idea
        </button>
        {idea.disposition !== "trash" && (
          <label className="by-select">
            <input
              type="checkbox"
              aria-label={`Select ${label} for evolution`}
              checked={isChosenForEvolution}
              onChange={(e) => onToggleSelectForEvolution(idea.id, e.target.checked)}
            />{" "}
            Select
          </label>
        )}
      </div>
    </article>
  );
}
