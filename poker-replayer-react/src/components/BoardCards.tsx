import React from 'react';
import { Card } from './Card';

interface BoardCardsProps {
  cards: string[];
}

export const BoardCards: React.FC<BoardCardsProps> = ({ cards }) => {
  return (
    <div className="board-cards">
      {cards.map((card, index) => (
        <Card key={index} card={card} />
      ))}
    </div>
  );
};

