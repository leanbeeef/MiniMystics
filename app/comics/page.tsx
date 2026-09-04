import { GameProvider } from "@/components/game-provider";
import { GameShell } from "@/components/game-shell";

export default function ComicsPage() {
  return <GameProvider><GameShell view="comics" /></GameProvider>;
}
