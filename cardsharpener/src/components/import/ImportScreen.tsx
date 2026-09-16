import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { fetchAppDataDir, fetchDbStatus } from "../../lib/db";
import type { DbStatus } from "../../types/poker";

export function ImportScreen() {
  const [db, setDb] = useState<DbStatus | null>(null);
  const [appDataDir, setAppDataDir] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [status, dir] = await Promise.all([
          fetchDbStatus(),
          fetchAppDataDir(),
        ]);
        if (!cancelled) {
          setDb(status);
          setAppDataDir(dir);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "DB status unavailable (UI-only / browser mode?)",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function pickFiles() {
    setError(null);
    if (!("__TAURI_INTERNALS__" in window)) {
      setError("File dialogs need the Tauri shell — run npm run tauri dev.");
      return;
    }
    try {
      const selection = await open({
        multiple: true,
        directory: false,
        filters: [{ name: "Hand histories", extensions: ["txt", "xml"] }],
      });
      if (selection == null) return;
      const paths = Array.isArray(selection) ? selection : [selection];
      setPicked(paths);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File dialog failed");
    }
  }

  async function pickFolder() {
    setError(null);
    if (!("__TAURI_INTERNALS__" in window)) {
      setError("Folder dialogs need the Tauri shell — run npm run tauri dev.");
      return;
    }
    try {
      const selection = await open({
        multiple: false,
        directory: true,
      });
      if (selection == null || Array.isArray(selection)) return;
      setPicked([selection]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Folder dialog failed");
    }
  }

  return (
    <section className="screen" aria-labelledby="import-title">
      <header className="screen__header">
        <h1 id="import-title" className="screen__title">
          Import
        </h1>
        <p className="screen__subtitle">
          Load hand histories from local files or folders. Nothing is uploaded.
        </p>
      </header>

      <div className="panel">
        <h2 className="panel__title">Local sources</h2>
        <div className="import-actions">
          <button type="button" className="btn btn--primary" onClick={pickFiles}>
            Choose files…
          </button>
          <button type="button" className="btn" onClick={pickFolder}>
            Choose folder…
          </button>
          <button type="button" className="btn" disabled title="Parser hook later">
            Import selected (stub)
          </button>
        </div>
        {picked.length > 0 ? (
          <ul className="mono" style={{ marginTop: 12 }}>
            {picked.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No files selected yet.
          </p>
        )}
        {error ? (
          <p style={{ color: "var(--cs-danger)", marginTop: 8 }}>{error}</p>
        ) : null}
      </div>

      <div className="panel">
        <h2 className="panel__title">Local database</h2>
        <dl className="import-status">
          <dt>App data directory</dt>
          <dd>{appDataDir || "—"}</dd>
          <dt>SQLite path</dt>
          <dd>{db?.path ?? "—"}</dd>
          <dt>Hands / actions</dt>
          <dd>
            {db
              ? `${db.handCount} hands · ${db.actionCount} actions`
              : "—"}
          </dd>
          <dt>Status</dt>
          <dd>{db?.ready ? "Ready (schema applied)" : "Not connected"}</dd>
        </dl>
        <p className="muted">
          Schema stub is ready for hands, players, actions, and import batches.
          Wire parsers here later (existing Python can stay local-only).
        </p>
      </div>
    </section>
  );
}
