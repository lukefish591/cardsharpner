import type { ReactNode } from "react";
import type { AppScreen } from "../../types/poker";
import { Nav } from "./Nav";

interface AppShellProps {
  active: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  children: ReactNode;
}

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Nav active={active} onNavigate={onNavigate} />
      <div className="app-main">{children}</div>
    </div>
  );
}
