import { CharacterDossier } from "./characters/CharacterDossier";
import { CharacterRoster } from "./characters/CharacterRoster";
import { useCharacterWorkspace } from "./characters/useCharacterWorkspace";
import "./characters.css";

export default function CharactersView({ onOpenNode }: { onOpenNode: (id: string) => void }) {
  const ws = useCharacterWorkspace();

  return (
    <div className="characters-workspace">
      <CharacterRoster
        charactersCount={ws.characters.length}
        visibleCharacters={ws.visibleCharacters}
        activeId={ws.activeId}
        draftActive={Boolean(ws.draft)}
        castQuery={ws.castQuery}
        onCastQueryChange={ws.setCastQuery}
        onCreate={ws.create}
        onChoose={ws.choose}
        details={ws.details}
      />

      <CharacterDossier
        character={ws.character}
        draft={ws.draft}
        context={ws.context}
        nodes={ws.nodes}
        imageBusy={ws.imageBusy}
        imageError={ws.imageError}
        onEdit={() => ws.edit()}
        onCancel={() => ws.setDraft(null)}
        onSave={ws.save}
        onCreate={ws.create}
        onChoose={ws.choose}
        onOpenNode={(id) => {
          ws.setDraft(null);
          ws.select([id]);
          onOpenNode(id);
        }}
        onChangeField={ws.changeField}
        onUploadPoster={(file) => void ws.uploadPoster(file)}
      />
    </div>
  );
}
