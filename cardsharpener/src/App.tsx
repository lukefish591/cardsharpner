import { useState } from "react";
import { AppShell } from "./components/shell/AppShell";
import { ImportScreen } from "./components/import/ImportScreen";
import { HandListScreen } from "./components/hands/HandListScreen";
import { ReplayerScreen } from "./components/replayer/ReplayerScreen";
import { StatsScreen } from "./components/stats/StatsScreen";
import { clearQueryCache } from "./lib/queryCache";
import type { AppScreen } from "./types/poker";
import "./styles/tokens.css";
import "./styles/app.css";

function App() {
  const [screen, setScreen] = useState<AppScreen>("import");
  const [selectedHandId, setSelectedHandId] = useState<number | null>(null);
  const [dataRevision, setDataRevision] = useState(0);

  function onDataChanged() {
    clearQueryCache();
    setDataRevision((n) => n + 1);
  }

  return (
    <AppShell active={screen} onNavigate={setScreen}>
      <div
        className="screen-slot"
        hidden={screen !== "import"}
        aria-hidden={screen !== "import"}
      >
        <ImportScreen onImported={onDataChanged} />
      </div>
      <div
        className="screen-slot"
        hidden={screen !== "hands"}
        aria-hidden={screen !== "hands"}
      >
        <HandListScreen
          dataRevision={dataRevision}
          onOpenHand={(hand) => {
            setSelectedHandId(hand.id);
            setScreen("replayer");
          }}
        />
      </div>
      <div
        className="screen-slot"
        hidden={screen !== "replayer"}
        aria-hidden={screen !== "replayer"}
      >
        <ReplayerScreen
          dataRevision={dataRevision}
          selectedHandId={selectedHandId}
          onSelectHand={setSelectedHandId}
        />
      </div>
      <div
        className="screen-slot"
        hidden={screen !== "stats"}
        aria-hidden={screen !== "stats"}
      >
        <StatsScreen dataRevision={dataRevision} />
      </div>
    </AppShell>
  );
}

export default App;
