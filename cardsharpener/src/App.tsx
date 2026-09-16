import { useState } from "react";
import { AppShell } from "./components/shell/AppShell";
import { ImportScreen } from "./components/import/ImportScreen";
import { HandListScreen } from "./components/hands/HandListScreen";
import { ReplayerScreen } from "./components/replayer/ReplayerScreen";
import { StatsScreen } from "./components/stats/StatsScreen";
import type { AppScreen } from "./types/poker";
import "./styles/tokens.css";
import "./styles/app.css";

function App() {
  const [screen, setScreen] = useState<AppScreen>("import");

  return (
    <AppShell active={screen} onNavigate={setScreen}>
      {screen === "import" ? <ImportScreen /> : null}
      {screen === "hands" ? (
        <HandListScreen onOpenHand={() => setScreen("replayer")} />
      ) : null}
      {screen === "replayer" ? <ReplayerScreen /> : null}
      {screen === "stats" ? <StatsScreen /> : null}
    </AppShell>
  );
}

export default App;
