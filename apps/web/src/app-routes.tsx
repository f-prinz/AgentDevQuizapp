import type { RouteObject } from "react-router";
import { AppShell } from "./routes/AppShell";
import { HomePage, HostPage, JoinPage, PlayerPage, ProjectorPage } from "./routes/Pages";

export const appRoutes: RouteObject[] = [{
  path: "/",
  element: <AppShell />,
  children: [
    { index: true, element: <HomePage /> },
    { path: "lobbies/:lobbyId/host", element: <HostPage /> },
    { path: "join", element: <JoinPage /> },
    { path: "player", element: <PlayerPage /> },
    { path: "projector", element: <ProjectorPage /> },
  ],
}];