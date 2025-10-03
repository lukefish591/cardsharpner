import React, { useState } from 'react';
import { useReplayStore } from '../store/replayStore';

export const HandSelector: React.FC = () => {
  const [handText, setHandText] = useState('');
  const { loadHand, replay } = useReplayStore();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setHandText(text);
        
        // Parse first hand from file
        const hands = text.split(/(?=Poker Hand #)/);
        if (hands.length > 0 && hands[0].trim()) {
          loadHand(hands[0]);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTextLoad = () => {
    if (handText.trim()) {
      loadHand(handText);
    }
  };

  return (
    <div className="hand-selector">
      <h2>Load Hand History</h2>
      
      <div className="upload-section">
        <label className="file-upload-btn">
          <input
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          📁 Upload Hand History File
        </label>
      </div>

      <div className="text-input-section">
        <textarea
          className="hand-text-input"
          placeholder="Or paste hand history text here..."
          value={handText}
          onChange={(e) => setHandText(e.target.value)}
          rows={10}
        />
        <button onClick={handleTextLoad} className="load-btn">
          Load Hand
        </button>
      </div>

      {replay && (
        <div className="current-hand-info">
          <h3>Current Hand</h3>
          <div className="hand-details">
            <p><strong>Hand ID:</strong> {replay.handId}</p>
            <p><strong>Table:</strong> {replay.tableName}</p>
            <p><strong>Stakes:</strong> {replay.stakes}</p>
            <p><strong>Final Pot:</strong> ${replay.finalPot.toFixed(2)}</p>
            {replay.winner && <p><strong>Winner:</strong> {replay.winner}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

