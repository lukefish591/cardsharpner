import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { backfillHandStats, fetchAppDataDir, fetchDbStatus, importHands } from "../../lib/db";
import type { DbStatus, ImportResult } from "../../types/poker";

interface ImportScreenProps {
  onImported?: () => void;
}

export function ImportScreen({ onImported }: ImportScreenProps) {
  const [db, setDb] = useState<DbStatus | null>(null);
  const [appDataDir, setAppDataDir] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function refreshStatus() {
    const [status, dir] = await Promise.all([
      fetchDbStatus(),
      fetchAppDataDir(),
    ]);
    setDb(status);
    setAppDataDir(dir);
  }

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
        if (status.statsPending > 0) {
          await backfillHandStats();
          const refreshed = await fetchDbStatus();
          if (!cancelled) setDb(refreshed);
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
      setResult(null);
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
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Folder dialog failed");
    }
  }

  async function importSelected() {
    setError(null);
    setResult(null);
    if (picked.length === 0) {
      setError("Choose files or a folder first.");
      return;
    }
    setBusy(true);
    try {
      const imported = await importHands(picked);
      setResult(imported);
      await refreshStatus();
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      try {
        await refreshStatus();
      } catch {
        // status refresh is best-effort after a failed import
      }
    } finally {
      setBusy(false);
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
          <button
            type="button"
            className="btn"
            onClick={importSelected}
            disabled={busy || picked.length === 0}
          >
            {busy ? "Importing…" : "Import selected"}
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
        {result ? (
          <p style={{ marginTop: 12 }}>
            Imported {result.handCount} hands from {result.fileCount} files
            {result.skippedCount > 0
              ? ` · ${result.skippedCount} already in the database`
              : ""}
            {result.errorCount > 0
              ? ` · ${result.errorCount} parser issues`
              : ""}
            . Open Hands to browse them.
          </p>
        ) : null}
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
          <dt>Hand stats</dt>
          <dd>
            {db
              ? db.statsReady
                ? `Ready · ${db.handCount} indexed`
                : `Backfilling · ${db.statsPending} remaining`
              : "—"}
          </dd>
          <dt>SQLite journal</dt>
          <dd>{db?.journalMode ?? "—"}</dd>
          <dt>Status</dt>
          <dd>{db?.ready ? "Ready" : "Not connected"}</dd>
        </dl>
        <p className="muted">
          Parsers run locally (Python) and write to the SQLite store.
        </p>
      </div>
    </section>
  );
}
