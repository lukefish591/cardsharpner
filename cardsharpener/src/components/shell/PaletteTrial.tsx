import { useMemo, useState } from "react";
import {
  DARK_SKELETON,
  PRESETS,
  SLOT_HINT,
  applyAndPersist,
  formatHex5,
  parseHex5,
  readSavedTrialPalette,
  type Hex5,
} from "../../lib/palette";

export function PaletteTrial() {
  const initial = useMemo(() => readSavedTrialPalette(), []);
  const [presetId, setPresetId] = useState(initial.id);
  const [hex, setHex] = useState<Hex5>(initial.hex);
  const [paste, setPaste] = useState(formatHex5(initial.hex));
  const [error, setError] = useState<string | null>(null);

  function adopt(next: Hex5) {
    const saved = applyAndPersist(next);
    setHex(saved.hex);
    setPresetId(saved.id);
    setPaste(formatHex5(saved.hex));
    setError(null);
  }

  function onPresetChange(id: string) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    adopt(preset.hex);
  }

  function onApplyPaste() {
    const parsed = parseHex5(paste);
    if (!parsed) {
      setError('Need 5 hex colours, e.g. ["#ccd5ae","#e9edc9","#fefae0","#faedcd","#d4a373"]');
      return;
    }
    adopt(parsed);
  }

  return (
    <section className="palette-trial" aria-label="Colour scheme trial">
      <h2 className="palette-trial__title">Trial colours</h2>
      <p className="palette-trial__hint">{SLOT_HINT}</p>
      <ol className="palette-trial__swatches">
        {hex.map((colour, index) => (
          <li key={`${colour}-${index}`}>
            <span
              className="palette-trial__swatch"
              style={{ background: colour }}
              title={`Slot ${index + 1}: ${colour}`}
            />
            <span className="palette-trial__slot">{index + 1}</span>
          </li>
        ))}
      </ol>
      <label className="palette-trial__field">
        Preset
        <select
          value={PRESETS.some((item) => item.id === presetId) ? presetId : "custom"}
          onChange={(event) => onPresetChange(event.target.value)}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
          {presetId === "custom" || !PRESETS.some((item) => item.id === presetId) ? (
            <option value="custom">Custom paste</option>
          ) : null}
        </select>
      </label>
      <label className="palette-trial__field">
        Paste a 5-colour array
        <textarea
          rows={3}
          spellCheck={false}
          value={paste}
          onChange={(event) => {
            setPaste(event.target.value);
            setError(null);
          }}
          placeholder='["#ccd5ae","#e9edc9","#fefae0","#faedcd","#d4a373"]'
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onApplyPaste();
            }
          }}
        />
      </label>
      <div className="palette-trial__actions">
        <button type="button" className="btn btn--primary" onClick={onApplyPaste}>
          Apply
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onPresetChange(DARK_SKELETON.id)}
        >
          Revert
        </button>
      </div>
      {error ? <p className="palette-trial__error">{error}</p> : null}
    </section>
  );
}
