import React, { useEffect } from 'react';
import { useReplayStore } from './store/replayStore';
import { PokerTable } from './components/PokerTable';
import { Controls } from './components/Controls';
import { HandSelector } from './components/HandSelector';
import { ActionHistory } from './components/ActionHistory';
import './App.css';

function App() {
  const { gameState, replay, isPlaying, playbackSpeed, nextAction } = useReplayStore();

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !replay) return;

    const interval = setInterval(() => {
      nextAction();
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, nextAction, replay]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>♠️ Poker Hand Replayer</h1>
        <p>Interactive hand history visualization</p>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <HandSelector />
          {replay && <ActionHistory />}
        </aside>

        <main className="main-content">
          {gameState ? (
            <>
              <PokerTable gameState={gameState} />
              <Controls />
              
              {replay && gameState.actionIndex >= replay.actions.length && (
                <div className="hand-complete">
                  <h2>🏆 Hand Complete</h2>
                  {replay.winner && (
                    <div className="winner-info">
                      <p><strong>Winner:</strong> {replay.winner}</p>
                      {replay.winningHand && (
                        <p><strong>Winning Hand:</strong> {replay.winningHand}</p>
                      )}
                      <div className="final-stats">
                        <span>Final Pot: ${replay.finalPot.toFixed(2)}</span>
                        <span>Rake: ${replay.rake.toFixed(2)}</span>
                        {replay.jackpot > 0 && (
                          <span>Jackpot: ${replay.jackpot.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="no-hand-loaded">
              <h2>No Hand Loaded</h2>
              <p>Upload a hand history file or paste hand text to get started</p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>Built with React + TypeScript | Parser ported from Python</p>
      </footer>
    </div>
  );
}

export default App;

