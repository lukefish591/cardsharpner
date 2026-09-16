import { Card } from "./Card";

interface BoardProps {
  cards: (string | null)[];
}

export function Board({ cards }: BoardProps) {
  const dealt = cards.filter((c): c is string => Boolean(c));
  if (dealt.length === 0) return null;

  return (
    <div className="poker-table__board" data-region="board">
      {dealt.map((c, i) => (
        <Card key={`${c}-${i}`} code={c} />
      ))}
    </div>
  );
}
