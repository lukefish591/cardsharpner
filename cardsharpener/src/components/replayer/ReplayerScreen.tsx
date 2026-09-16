import { useEffect, useMemo, useState } from "react";
import { fetchHandReplay, fetchHands } from "../../lib/db";
import { computeFrame } from "../../lib/replay";
import type { HandReplay, HandSummary } from "../../types/poker";
import { ActionLog } from "./ActionLog";
import { HandPicker } from "./HandPicker";
import { PlaybackControls } from "./PlaybackControls";
import { PokerTable } from "./PokerTable";

interface ReplayerScreenProps {
  selectedHandId?: number | null;
  onSelectHand?: (handId: number) => void;
}

export function ReplayerScreen({
  selectedHandId = null,
  onSelectHand,
}: ReplayerScreenProps) {
  const [hands, setHands] = useState<HandSummary[]>([]);
  const [hand, setHand] = useState<HandReplay | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchHands();
        if (!cancelled) setHands(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load hands");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeId = selectedHandId ?? hands[0]?.id ?? null;

  useEffect(() => {
    if (activeId == null) {
      setHand(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const replay = await fetchHandReplay(activeId);
        if (cancelled) return;
        setHand(replay);
        setStep(0);
        setError(null);
        if (onSelectHand && selectedHandId == null) {
          onSelectHand(activeId);
        }
      } catch (e) {
        if (!cancelled) {
          setHand(null);
          setError(e instanceof Error ? e.message : "Could not load hand");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, onSelectHand, selectedHandId]);

  const maxStep = hand?.actions.length ?? 0;
  const frame = useMemo(
    () => (hand ? computeFrame(hand, step) : null),
    [hand, step],
  );

  return (
    <section className="screen" aria-labelledby="replayer-title">
      <header className="screen__header replayer-header">
        <div>
          <h1 id="replayer-title" className="screen__title">
            Replayer
          </h1>
          <p className="screen__subtitle">
            Step through an imported hand. Streets, pot, stacks, and chips stay
            on this Mac.
          </p>
        </div>
        <HandPicker
          hands={hands}
          selectedId={activeId}
          onSelect={(id) => {
            onSelectHand?.(id);
            setStep(0);
          }}
        />
      </header>

      {error ? <p style={{ color: "var(--cs-danger)" }}>{error}</p> : null}

      <div className="replayer-layout">
        <PokerTable frame={frame} />
        <ActionLog
          actions={hand?.actions ?? []}
          appliedCount={step}
          onSelect={setStep}
        />
        <PlaybackControls
          step={step}
          maxStep={maxStep}
          streetLabel={frame?.streetLabel ?? "—"}
          onStepChange={setStep}
        />
      </div>
    </section>
  );
}
