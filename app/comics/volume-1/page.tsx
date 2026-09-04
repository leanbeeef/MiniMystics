import { ComicReader } from "@/components/comics/comic-reader";
import { GameProvider } from "@/components/game-provider";
import { comicVolume } from "@/lib/comics";

export default function VolumeOnePage() {
  const volume = comicVolume("volume-1");
  if (!volume) return null;
  return <GameProvider><ComicReader volume={volume} /></GameProvider>;
}
