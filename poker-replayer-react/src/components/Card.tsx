import React from 'react';

interface CardProps {
  card: string;
}

export const Card: React.FC<CardProps> = ({ card }) => {
  const isBackCard = card === '??';
  
  const getCardColor = () => {
    if (isBackCard) return '';
    const suit = card.charAt(1);
    return suit === 'h' || suit === 'd' ? 'red' : 'black';
  };

  const formatCard = () => {
    if (isBackCard) return '🂠';
    return card.toUpperCase();
  };

  return (
    <div className={`playing-card ${isBackCard ? 'back' : getCardColor()}`}>
      {formatCard()}
    </div>
  );
};

