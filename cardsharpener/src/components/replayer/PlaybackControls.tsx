interface PlaybackControlsProps {
  step: number;
  maxStep: number;
  streetLabel: string;
  onStepChange: (step: number) => void;
}

export function PlaybackControls({
  step,
  maxStep,
  streetLabel,
  onStepChange,
}: PlaybackControlsProps) {
  return (
    <div className="panel replayer-controls" data-region="playback-controls">
      <button
        type="button"
        className="btn"
        disabled={step <= 0}
        onClick={() => onStepChange(0)}
      >
        Start
      </button>
      <button
        type="button"
        className="btn"
        disabled={step <= 0}
        onClick={() => onStepChange(Math.max(0, step - 1))}
      >
        Prev
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={step >= maxStep}
        onClick={() => onStepChange(Math.min(maxStep, step + 1))}
      >
        Next
      </button>
      <button
        type="button"
        className="btn"
        disabled={step >= maxStep}
        onClick={() => onStepChange(maxStep)}
      >
        End
      </button>
      <span className="muted" data-region="street">
        {streetLabel} · step {step}/{maxStep}
      </span>
    </div>
  );
}
