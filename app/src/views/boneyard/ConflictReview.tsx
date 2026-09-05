import type { BoneyardController } from "./useBoneyard";

export function ConflictReview({
  by,
  onOpen,
}: {
  by: BoneyardController;
  onOpen: (id: string) => void;
}) {
  if (!by.snapshot.conflicts.length) return null;
  return (
    <details className="by-conflict">
      <summary>
        {by.snapshot.conflicts.length} concurrent edit
        {by.snapshot.conflicts.length === 1 ? "" : "s"} preserved for review
      </summary>
      <p>Nothing was discarded. Choosing a version keeps the others in saved history.</p>
      {by.snapshot.conflicts.map((conflict) => (
        <section key={conflict.entityId}>
          <h3>
            {conflict.kind === "idea"
              ? "Idea"
              : conflict.kind === "thought"
                ? "Follow-up thought"
                : "Organization change"}
          </h3>
          {conflict.versions.map((version) => (
            <div key={version.id}>
              <p className="by-prose">
                {"body" in version.value
                  ? version.value.body
                  : "title" in version.value
                    ? version.value.title
                    : "note" in version.value
                      ? version.value.note
                      : "Collection membership"}
              </p>
              {"deleted" in version.value && <p>{version.value.deleted ? "Removed" : "Kept"}</p>}
              <button
                className="tln-btn"
                disabled={by.pending}
                onClick={() => void by.run(() => by.resolve(version))}
              >
                Keep this version
              </button>
            </div>
          ))}
          {conflict.kind === "idea" && (
            <button className="tln-btn" onClick={() => onOpen(conflict.entityId)}>
              Open affected idea
            </button>
          )}
        </section>
      ))}
    </details>
  );
}
