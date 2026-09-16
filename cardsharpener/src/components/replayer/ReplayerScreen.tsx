import { useEffect, useMemo, useState } from "react";
import { fetchHandReplay, fetchHandsPage } from "../../lib/db";
import { computeFrame } from "../../lib/replay";
import type { HandReplay } from "../../types/poker";
import { ActionLog } from "./ActionLog";
import { HandPicker } from "./HandPicker";
import { PlaybackControls } from "./PlaybackControls";
import { PokerTable } from "./PokerTable";

interface ReplayerScreenProps {
  selectedHandId?: number | null;
  onSelectHand?: (handId: number) => void;
  dataRevision?: number;
}

export function ReplayerScreen({
  selectedHandId = null,
  onSelectHand,
  dataRevision = 0,
}: ReplayerScreenProps) {
  const [hand, setHand] = useState<HandReplay | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useBigBlinds, setUseBigBlinds] = useState(false);

  useEffect(() => {
    if (selectedHandId != null) return;
    let cancelled = false;
    fetchHandsPage({ query: "", limit: 1, offset: 0 })
      .then((page) => {
        const newest = page.hands[0];
        if (!cancelled && newest) onSelectHand?.(newest.id);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load hands");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedHandId, onSelectHand, dataRevision]);

  const activeId = selectedHandId;

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
  }, [activeId]);

  const maxStep = hand?.actions.length ?? 0;
  const frame = useMemo(
    () => (hand ? computeFrame(hand, step) : null),
    [hand, step],
  );
  const selectedLabel = hand
    ? `${hand.externalHandId ?? `Hand #${hand.id}`}${
        hand.heroCards ? ` · ${hand.heroCards}` : ""
      }`
    : activeId != null
      ? `Hand #${activeId}`
      : "Search hand ID or cards…";

  return (
    <section className="screen" aria-labelledby="replayer-title">
      <header className="screen__header replayer-header">
        <div>
          <h1 id="replayer-title" className="screen__title">
            Replayer
          </h1>
          <p className="screen__subtitle">
            Step through an imported hand.
          </p>
        </div>
        <div className="replayer-header__tools">
          <div className="amount-toggle" role="group" aria-label="Amount display">
            <button
              type="button"
              className={`amount-toggle__btn${useBigBlinds ? "" : " is-active"}`}
              onClick={() => setUseBigBlinds(false)}
            >
              $
            </button>
            <button
              type="button"
              className={`amount-toggle__btn${useBigBlinds ? " is-active" : ""}`}
              onClick={() => setUseBigBlinds(true)}
            >
              BB
            </button>
          </div>
          <HandPicker
            selectedId={activeId}
            selectedLabel={selectedLabel}
            onSelect={(id) => {
              onSelectHand?.(id);
              setStep(0);
            }}
          />
        </div>
      </header>

      {error ? <p style={{ color: "var(--cs-danger)" }}>{error}</p> : null}

      <div className="replayer-layout">
        <PokerTable frame={frame} useBigBlinds={useBigBlinds} />
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
