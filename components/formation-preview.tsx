import { definitionFor, type OwnedCard } from "@/lib/client-state";

type FormationPreviewProps = {
  ownedCards: OwnedCard[];
  mysticIds: string[];
  handlerIds: string[];
  size: 3 | 5 | 8;
  concealed?: boolean;
};

function PreviewCard({ owned, concealed = false }: { owned?: OwnedCard; concealed?: boolean }) {
  const definition = owned ? definitionFor(owned.definitionId) : null;
  return <span className={`formation-preview-card ${concealed ? "concealed" : ""}`} title={definition?.name}>
    {concealed ? <img src="/cards/Mystics/back.png" alt="Random card" /> : definition?.image ? <img src={definition.image} alt={definition.name} loading="lazy" decoding="async" /> : <span>Empty</span>}
  </span>;
}

export function FormationPreview({ ownedCards, mysticIds, handlerIds, size, concealed = false }: FormationPreviewProps) {
  const mystics = mysticIds.map((id) => ownedCards.find((card) => card.id === id));
  const handlers = handlerIds.map((id) => ownedCards.find((card) => card.id === id));
  return <div className={`formation-preview formation-size-${size}`}>
    <div className="formation-preview-mystics">
      {Array.from({ length: size }, (_, index) => <PreviewCard key={mystics[index]?.id ?? `mystic-${index}`} owned={mystics[index]} concealed={concealed} />)}
    </div>
    <div className="formation-preview-handlers" aria-label={`${handlers.length} selected Handlers`}>
      {handlers.length ? handlers.map((owned, index) => <PreviewCard key={owned?.id ?? `handler-${index}`} owned={owned} concealed={concealed} />) : <small>No Handlers</small>}
    </div>
  </div>;
}
