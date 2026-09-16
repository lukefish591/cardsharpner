import { Card } from "./Card";

interface BoardProps {
  cards: (string | null)[];
}

export function Board({ cards }: BoardProps) {
  const slots = [...cards];
  while (slots.length < 5) slots.push(null);

  return (
    <div className="poker-table__board" data-region="board">
      {slots.map((c, i) => (
        <Card key={i} code={c} />
      ))}
    </div>
  );
}
