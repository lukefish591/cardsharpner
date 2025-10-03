import React from 'react';
import { PlayerState } from '../types/poker';
import { Card } from './Card';

interface PlayerCardProps {
  player: PlayerState;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  const getCardClass = () => {
    if (!player.isActive) return 'player-card folded';
    if (player.isHero) return 'player-card hero';
    return 'player-card active';
  };

  return (
    <div className={getCardClass()}>
      <div className="player-name">
        {player.name}
        {player.isHero && ' 👤'}
      </div>
      
      <div className="player-info">
        <span className="player-position">{player.position}</span>
        <span className="player-seat">Seat {player.seat}</span>
      </div>
      
      <div className="player-stack">${player.stack.toFixed(2)}</div>
      
      <div className="player-cards">
        {player.holeCards.length > 0 && player.cardsVisible ? (
          player.holeCards.map((card, i) => (
            <Card key={i} card={card} />
          ))
        ) : player.holeCards.length > 0 ? (
          <>
            <Card card="??" />
            <Card card="??" />
          </>
        ) : null}
      </div>
      
      {player.currentBet > 0 && (
        <div className="player-bet">
          Bet: ${player.currentBet.toFixed(2)}
        </div>
      )}
    </div>
  );
};

