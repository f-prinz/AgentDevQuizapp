import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { CreateLobbyResponseSchema, JoinPlayerResponseSchema, ServerMessageSchema, SessionSchema, type Session, type Snapshot } from "@raccoons/contracts";
import { HostGameView, PlayerGameView, ProjectorGameView, ProjectorRanking } from "../GameViews";

type Role = "host" | "player" | "projector";

function sessionStorageKey(lobbyId: string, role: Role) {
  return `lobby:${lobbyId}:${role}`;
}

function readSession(lobbyId: string, role: Role, fragment = ""): Session | null {
  if (role !== "player" && fragment) {
    const params = new URLSearchParams(fragment.replace(/^#/, ""));
    const sessionId = params.get("sessionId");
    const token = params.get("token");
    if (sessionId && token) {
      const parsed = SessionSchema.safeParse({ lobbyId, sessionId, role, token });
      if (parsed.success) {
        try { localStorage.setItem(sessionStorageKey(lobbyId, role), JSON.stringify(parsed.data)); } catch { /* Storage may be disabled. */ }
        return parsed.data;
      }
    }
  }
  try {
    const raw = localStorage.getItem(sessionStorageKey(lobbyId, role));
    if (!raw) return null;
    const parsed = SessionSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.lobbyId === lobbyId && parsed.data.role === role ? parsed.data : null;
  } catch {
    return null;
  }
}

function useLobbySnapshot(lobbyId: string | undefined, role: Role, enabled = true, sessionOverride: Session | null = null, onSessionInvalidated?: () => void) {
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setSnapshot(null);
    setConnectionError("");
  }, [lobbyId, role]);

  useEffect(() => {
    if (!lobbyId || !enabled) return;
    const session = sessionOverride ?? readSession(lobbyId, role, location.hash);
    if (!session) {
      setConnectionError("Sitzung fehlt. Öffne den persönlichen Link erneut.");
      return;
    }
    if (location.hash && role !== "player") {
      window.history.replaceState(null, "", `${location.pathname}${location.search}`);
    }

    let socket: WebSocket;
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    } catch {
      setConnectionError("Verbindung zur Lobby konnte nicht hergestellt werden.");
      return;
    }
    socketRef.current = socket;
    let lastRevision = -1;
    socket.onopen = () => {
      socket.send(JSON.stringify({ version: 1, type: "auth", requestId: crypto.randomUUID(), lobbyId, sessionId: session.sessionId, token: session.token }));
      setConnectionError("");
    };
    socket.onmessage = (event) => {
      try {
        const value: unknown = JSON.parse(String(event.data));
        const parsed = ServerMessageSchema.safeParse(value);
        if (!parsed.success) return;
        if (parsed.data.type === "error") {
          if (parsed.data.code === "LOBBY_NOT_FOUND" || parsed.data.code === "UNAUTHORIZED") {
            try { localStorage.removeItem(sessionStorageKey(lobbyId, role)); } catch { /* Storage may be disabled. */ }
            setSnapshot(null);
            onSessionInvalidated?.();
            setConnectionError(parsed.data.code === "LOBBY_NOT_FOUND"
              ? "Diese Lobby ist nicht mehr verfügbar. Bitte erstelle eine neue Lobby und öffne den neuen persönlichen Link."
              : "Diese Sitzung ist abgelaufen oder ungültig. Bitte öffne den persönlichen Link erneut.");
          } else {
            setConnectionError("Die Lobby-Anfrage konnte nicht verarbeitet werden.");
          }
          return;
        }
        if (parsed.data.type !== "snapshot" || parsed.data.role !== role || parsed.data.lobbyId !== lobbyId || parsed.data.revision <= lastRevision) return;
        lastRevision = parsed.data.revision;
        setSnapshot(parsed.data);
      } catch {
        setConnectionError("Lobby-Antwort konnte nicht verarbeitet werden.");
      }
    };
    socket.onerror = () => setConnectionError("Verbindung zur Lobby fehlgeschlagen.");
    return () => { socketRef.current = null; socket.close(); };
  }, [lobbyId, role, enabled, sessionOverride, onSessionInvalidated, location.hash, location.pathname, location.search]);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);
  return { snapshot, connectionError, send };
}

function ParticipantList({ snapshot, label = "Teilnehmer" }: { snapshot: Snapshot | null; label?: string }) {
  return <section className="participants" aria-label={label}>
    <h2>Teilnehmer</h2>
    {snapshot ? <ul>{snapshot.participants.map((participant) => <li key={participant.id}>
      <span>{participant.name || `Spieler ${participant.number}`}</span>
      <span className="participant-status">{participant.waiting ? "Wartet auf die nächste Spielauswahl" : participant.connected ? "Verbunden" : "Getrennt"}</span>
    </li>)}</ul> : <p>Warte auf die Lobbyverbindung …</p>}
  </section>;
}

function LobbyStatus({ error }: { error: string }) {
  return <>
    {error && <p className="error-message" role="status">{error}</p>}
  </>;
}

export function HomePage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function createLobby() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/lobbies", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      const parsed = CreateLobbyResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error();
      navigate(parsed.data.links.host);
    } catch {
      setError("Lobby konnte nicht erstellt werden. Bitte versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  return <main className="page">
    <h1>Prinzgame</h1>
    <p>Erstelle eine Lobby — du landest direkt in der Host-Ansicht und kannst die Links für Spieler und Projektor teilen.</p>
    <button type="button" onClick={() => void createLobby()} disabled={pending}>{pending ? "Lobby wird erstellt …" : "Lobby erstellen"}</button>
    {error && <p className="error-message" role="alert">{error}</p>}
  </main>;
}

export function HostPage() {
  const { lobbyId } = useParams();
  const { snapshot, connectionError, send } = useLobbySnapshot(lobbyId, "host");
  return <main className="page">
    <h1>Hostbereich</h1>
    <p>Lobby: {lobbyId}</p>
    <LobbyStatus error={connectionError} />
    {snapshot?.phase === "lobby" && <ParticipantList snapshot={snapshot} />}
    {snapshot?.role === "host" && <HostGameView snapshot={snapshot} send={send} />}
  </main>;
}

export function JoinPage() {
  const { lobbyId } = useParams();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState(() => lobbyId ? readSession(lobbyId, "player") : null);
  const activeSession = session && session.lobbyId === lobbyId && session.role === "player" ? session : null;
  const joined = Boolean(activeSession);
  useEffect(() => {
    setSession(lobbyId ? readSession(lobbyId, "player") : null);
  }, [lobbyId]);
  const invalidateSession = useCallback(() => setSession(null), []);
  const { snapshot, connectionError, send } = useLobbySnapshot(lobbyId, "player", joined, activeSession, invalidateSession);

  async function joinLobby() {
    if (!lobbyId || name.trim().length > 20) {
      setError("Bitte gib einen Namen mit höchstens 20 Zeichen ein.");
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error();
      const parsed = JoinPlayerResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.session.lobbyId !== lobbyId) throw new Error();
      // The server has already accepted the join. Keep this session in memory even
      // when browser storage is unavailable, so a storage error cannot invite a
      // retry that would create a second participant.
      setSession(parsed.data.session);
      try {
        localStorage.setItem(sessionStorageKey(lobbyId, "player"), JSON.stringify(parsed.data.session));
      } catch {
        // This browser session remains usable until the page is closed.
      }
    } catch {
      setError("Beitritt fehlgeschlagen. Prüfe den Link und versuche es erneut.");
    }
  }

  return <main className="page">
    {!joined && <form onSubmit={(event) => { event.preventDefault(); void joinLobby(); }}>
    <h1>Lobby beitreten</h1>
      <label htmlFor="player-name">Dein Name</label>
      <input id="player-name" name="name" value={name} maxLength={20} autoComplete="nickname" onChange={(event) => setName(event.target.value)} />
      <button type="submit">Beitreten</button>
    </form>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <LobbyStatus error={connectionError} />
    {snapshot?.role === "player" && <PlayerGameView snapshot={snapshot} send={send} />}
  </main>;
}

export function PlayerPage() {
  const { lobbyId } = useParams();
  const { snapshot, connectionError, send } = useLobbySnapshot(lobbyId, "player");
  return <main className="page">
    <h1>Spieleransicht</h1>
    <LobbyStatus error={connectionError} />
    {snapshot?.role === "player" && <PlayerGameView snapshot={snapshot} send={send} />}
  </main>;
}

export function ProjectorPage() {
  const { lobbyId } = useParams();
  const { snapshot, connectionError, send } = useLobbySnapshot(lobbyId, "projector");
  return <main className="projector" aria-label="Projektor">
    <LobbyStatus error={connectionError} />
    <div className="projector-layout">
      
        {snapshot?.role === "projector" && <ProjectorGameView snapshot={snapshot} send={send} />}
        {!snapshot && <p>Warte auf die Lobbyverbindung …</p>}
      
      <section className="projector-ranking" aria-label="Rangliste"><h2>Rangliste</h2>
        {snapshot?.role === "projector" && <ProjectorRanking snapshot={snapshot} />}
        {!snapshot && <p>Warte auf die Lobbyverbindung …</p>}
      </section>
    </div>
  </main>;
}
