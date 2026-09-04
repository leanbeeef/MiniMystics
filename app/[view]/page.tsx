import { GameProvider } from "@/components/game-provider";
import { GameShell } from "@/components/game-shell";

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  return <GameProvider><GameShell view={view} /></GameProvider>;
}
