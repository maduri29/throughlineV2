import type React from "react";
import { posterHue, posterMonogram } from "./posterImage";

interface CharacterPosterProps {
  id: string;
  title: string;
  src?: string;
}

export function CharacterPoster({ id, title, src }: CharacterPosterProps) {
  const hue = posterHue(id);

  return (
    <span className="character-poster" style={{ "--poster-hue": hue } as React.CSSProperties}>
      {src ? (
        <img src={src} alt={`${title} poster`} />
      ) : (
        <>
          <svg viewBox="0 0 240 320" aria-hidden="true">
            <circle cx="120" cy="113" r="43" />
            <path d="M30 320v-48c0-62 40-101 90-101s90 39 90 101v48Z" />
          </svg>
          <span className="character-poster__monogram" aria-hidden="true">
            {posterMonogram(title)}
          </span>
        </>
      )}
    </span>
  );
}
