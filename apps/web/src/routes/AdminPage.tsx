import { useCallback, useEffect, useRef, useState } from "react";

interface CatalogGame { id: string; kind: string; title: string; rules: string }

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", sorting: "Sortieren", estimation: "Schätzen" };

// FEAT-16: Admin-Seite — Katalog ansehen (GET), JSON-Upload (POST) und
// Loeschen (DELETE). Schreibende Aufrufe brauchen das ADMIN_TOKEN als Bearer.
export function AdminPage() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [games, setGames] = useState<CatalogGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) throw new Error(String(response.status));
      setGames(((await response.json()) as { games: CatalogGame[] }).games);
    } catch {
      setError("Katalog konnte nicht geladen werden.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    void file.text().then(setDraft).catch(() => setError("Datei konnte nicht gelesen werden."));
  };

  const upload = async () => {
    setError(null); setNotice(null);
    let body: unknown;
    try {
      body = JSON.parse(draft);
    } catch {
      setError("Die Eingabe ist kein gültiges JSON.");
      return;
    }
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (response.status === 201) {
        setDraft("");
        setNotice("Spiel wurde hinzugefügt.");
        await load();
      } else if (response.status === 401) {
        setError("Token fehlt oder ist ungültig.");
      } else {
        setError("Das JSON ist kein gültiges Spiel (Schema prüfen).");
      }
    } catch {
      setError("Upload fehlgeschlagen — Server nicht erreichbar.");
    }
  };

  const remove = async (id: string) => {
    setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 204) {
        setNotice("Spiel wurde gelöscht.");
        await load();
      } else if (response.status === 401) {
        setError("Token fehlt oder ist ungültig.");
      } else {
        setError("Spiel konnte nicht gelöscht werden.");
      }
    } catch {
      setError("Löschen fehlgeschlagen — Server nicht erreichbar.");
    }
  };

  return <section className="game-view admin-panel" aria-label="Admin">
    <h2>Katalog-Verwaltung</h2>
    <label className="admin-token">Admin-Token
      <input type="password" value={token} autoComplete="off" onChange={event => setToken(event.target.value)} />
    </label>
    <section aria-label="Neues Spiel"><h3>Neues Spiel hochladen</h3>
      <p className="admin-hint">JSON wie eine Seed-Datei — ohne <code>id</code>-Felder; Quiz benutzt <code>correctOptionIndex</code> (0-basiert). Alle IDs erzeugt der Server.</p>
      <label className="admin-draft">Spiel-JSON
        <textarea rows={12} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} />
      </label>
      <div className="admin-actions">
        <input ref={fileInput} type="file" accept=".json,application/json" onChange={event => readFile(event.target.files?.[0])} />
        <button type="button" disabled={!token || !draft.trim()} onClick={() => { void upload(); }}>Hochladen</button>
      </div>
    </section>
    <section aria-label="Spiele im Katalog"><h3>Spiele im Katalog</h3>
      {games === null ? <p>Lade…</p> : games.length === 0 ? <p>Keine Spiele.</p> :
        <ul className="admin-games">{games.map(game => <li key={game.id}>
          <code>{game.id}</code> — {KIND_LABEL[game.kind] ?? game.kind}: <span className="admin-game-title">{game.title}</span>
          <button type="button" disabled={!token} onClick={() => { void remove(game.id); }}>Löschen</button>
        </li>)}</ul>}
    </section>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {notice && <p role="status" className="admin-notice">{notice}</p>}
  </section>;
}
