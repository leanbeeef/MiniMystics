import { GameShell } from "@/components/game-shell";

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  return <GameShell view={view} />;
}
