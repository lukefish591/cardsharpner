import React from 'react';
import { useReplayStore } from '../store/replayStore';

export const ActionHistory: React.FC = () => {
  const { replay, currentActionIndex, setActionIndex } = useReplayStore();

  if (!replay) return null;

  const actionsByStreet = {
    preflop: replay.actions.filter(a => a.street === 'preflop'),
    flop: replay.actions.filter(a => a.street === 'flop'),
    turn: replay.actions.filter(a => a.street === 'turn'),
    river: replay.actions.filter(a => a.street === 'river'),
    showdown: replay.actions.filter(a => a.street === 'showdown'),
  };

  return (
    <div className="action-history">
      <h3>Action History</h3>
      
      {Object.entries(actionsByStreet).map(([street, actions]) => {
        if (actions.length === 0) return null;
        
        return (
          <div key={street} className="street-section">
            <h4 className="street-header">{street.toUpperCase()}</h4>
            <div className="actions-list">
              {actions.map((action) => (
                <div
                  key={action.actionNumber}
                  className={`action-item ${
                    action.actionNumber === currentActionIndex ? 'current' : ''
                  }`}
                  onClick={() => setActionIndex(action.actionNumber)}
                >
                  <span className="action-number">{action.actionNumber}.</span>
                  <span className="action-player">{action.player}:</span>
                  <span className="action-desc">{action.description}</span>
                  <span className="action-pot">(Pot: ${action.potAfter.toFixed(2)})</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

