import { useState } from "react";
import { ActionLog } from "./ActionLog";
import { PlaybackControls } from "./PlaybackControls";
import { PokerTable } from "./PokerTable";

const STREETS = ["Preflop", "Preflop", "Preflop", "Preflop", "Flop", "Flop", "Flop"];

export function ReplayerScreen() {
  const maxStep = STREETS.length - 1;
  const [step, setStep] = useState(0);

  return (
    <section className="screen" aria-labelledby="replayer-title">
      <header className="screen__header">
        <h1 id="replayer-title" className="screen__title">
          Replayer
        </h1>
        <p className="screen__subtitle">
          Skeleton table playback shell. Regions are separate DOM components for
          later restyle.
        </p>
      </header>

      <div className="replayer-layout">
        <PokerTable />
        <ActionLog activeIndex={step} onSelect={setStep} />
        <PlaybackControls
          step={step}
          maxStep={maxStep}
          streetLabel={STREETS[step] ?? "—"}
          onStepChange={setStep}
        />
      </div>
    </section>
  );
}
