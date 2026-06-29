import { useState } from "react";
import HomePage from "./HomePage";
import ViewerPage from "./ViewerPage";
import LivePage from "./LivePage";

export default function App() {
  const [page, setPage] = useState("home");
  const [sessionPick, setSessionPick] = useState(null);

  function navigate(target, pick) {
    setPage(target);
    if (pick) setSessionPick(pick);
  }

  if (page === "live") return <LivePage onBack={() => setPage("home")} />;
  if (page === "historical") return <ViewerPage onBack={() => setPage("home")} initialPick={sessionPick} />;
  return <HomePage onNavigate={navigate} />;
}
