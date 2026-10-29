import { Outlet } from "react-router";
import { ThemeToggle } from "../ThemeToggle";

export function AppShell() {
  return <div className="app-shell"><ThemeToggle /><Outlet /></div>;
}