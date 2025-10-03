import React from 'react';
import { 
  SkipBack, 
  ChevronLeft, 
  Play, 
  Pause, 
  ChevronRight, 
  SkipForward 
} from 'lucide-react';
import { useReplayStore } from '../store/replayStore';

export const Controls: React.FC = () => {
  const {
    currentActionIndex,
    replay,
    isPlaying,
    playbackSpeed,
    goToStart,
    previousAction,
    togglePlay,
    nextAction,
    goToEnd,
    setActionIndex,
    setPlaybackSpeed,
  } = useReplayStore();

  if (!replay) return null;

  const progress = (currentActionIndex / replay.actions.length) * 100;

  return (
    <div className="controls-container">
      <div className="controls-buttons">
        <button onClick={goToStart} className="control-btn" title="Start">
          <SkipBack size={20} />
        </button>
        
        <button onClick={previousAction} className="control-btn" title="Previous">
          <ChevronLeft size={20} />
        </button>
        
        <button onClick={togglePlay} className="control-btn play-btn" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button onClick={nextAction} className="control-btn" title="Next">
          <ChevronRight size={20} />
        </button>
        
        <button onClick={goToEnd} className="control-btn" title="End">
          <SkipForward size={20} />
        </button>
      </div>

      <div className="progress-container">
        <input
          type="range"
          min={0}
          max={replay.actions.length}
          value={currentActionIndex}
          onChange={(e) => setActionIndex(parseInt(e.target.value))}
          className="progress-slider"
        />
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="progress-info">
        <span>Action {currentActionIndex} of {replay.actions.length}</span>
        
        <div className="speed-control">
          <label>Speed:</label>
          <select 
            value={playbackSpeed} 
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="speed-select"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>
    </div>
  );
};

