import { ArrowUpRight, Film, Users } from "lucide-react";
import type { GraphNode } from "../../types";
import type { StoryStats } from "../../data/library";

export function StoryCard({
  story,
  stats,
  disabled,
  onOpen,
}: {
  story: GraphNode;
  stats?: StoryStats;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <button className="tln-storycard" disabled={disabled} onClick={onOpen}>
      <span className="tln-storycard__top">
        <Film size={18} aria-hidden="true" />
        <span>Story project</span>
        <ArrowUpRight className="tln-storycard__arrow" size={20} aria-hidden="true" />
      </span>
      <span className="tln-storycard__title">{story.title}</span>
      <span className="tln-storycard__by">
        {story.author ? `by ${story.author}` : "Your next draft starts here"}
      </span>
      <span className="tln-storycard__synopsis">
        {story.synopsis || "Build the world. Find the characters. Follow the story."}
      </span>
      <span className="tln-storycard__stats">
        <span>
          <Film size={14} aria-hidden="true" />{" "}
          {stats ? `${stats.scenes} scene${stats.scenes === 1 ? "" : "s"}` : "Counts unavailable"}
        </span>
        {stats && (
          <span>
            <Users size={14} aria-hidden="true" /> {stats.characters} in the cast
          </span>
        )}
      </span>
    </button>
  );
}
