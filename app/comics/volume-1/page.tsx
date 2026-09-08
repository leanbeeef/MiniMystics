import { ComicReader } from "@/components/comics/comic-reader";
import { comicVolume } from "@/lib/comics";

export default function VolumeOnePage() {
  const volume = comicVolume("volume-1");
  if (!volume) return null;
  return <ComicReader volume={volume} />;
}
