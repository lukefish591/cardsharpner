import React, { useRef, useEffect } from 'react';
import { GameState } from '../types/poker';
import { PlayerCard } from './PlayerCard';
import { BoardCards } from './BoardCards';

interface PokerTableProps {
  gameState: GameState;
}

export const PokerTable: React.FC<PokerTableProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw poker table background
    drawTable(ctx, canvas.width, canvas.height);
  }, [gameState]);

  const drawTable = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Outer border
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, width, height);

    // Green felt
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = width * 0.4;
    const radiusY = height * 0.35;

    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Inner border
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 8;
    ctx.stroke();
  };

  // Calculate player positions around the table
  const getPlayerPosition = (seat: number, totalSeats: number) => {
    const angleStep = (2 * Math.PI) / totalSeats;
    const angle = angleStep * (seat - 1) - Math.PI / 2;
    
    const radiusX = 35; // percentage
    const radiusY = 30; // percentage
    
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    
    return { x: `${x}%`, y: `${y}%` };
  };

  const totalSeats = gameState.players.length;

  return (
    <div className="poker-table-container">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="poker-table-canvas"
      />
      
      <div className="poker-table-overlay">
        {/* Pot display in center */}
        <div className="pot-display">
          <div className="pot-label">POT</div>
          <div className="pot-amount">${gameState.pot.toFixed(2)}</div>
          {gameState.street && (
            <div className="street-label">{gameState.street.toUpperCase()}</div>
          )}
        </div>

        {/* Board cards */}
        {gameState.boardCards.length > 0 && (
          <div className="board-cards-container">
            <BoardCards cards={gameState.boardCards} />
          </div>
        )}

        {/* Players positioned around table */}
        {gameState.players.map((player) => {
          const pos = getPlayerPosition(player.seat, totalSeats);
          return (
            <div
              key={player.seat}
              className="player-position"
              style={{ left: pos.x, top: pos.y }}
            >
              <PlayerCard player={player} />
            </div>
          );
        })}

        {/* Current action banner */}
        {gameState.currentAction && (
          <div className="action-banner">
            <span className="action-player">{gameState.currentAction.player}</span>
            <span className="action-description">{gameState.currentAction.description}</span>
          </div>
        )}
      </div>
    </div>
  );
};

