import { AuthView } from "@/components/auth-view";
import { GameProvider } from "@/components/game-provider";

export default function HomePage() { return <GameProvider><AuthView /></GameProvider>; }
