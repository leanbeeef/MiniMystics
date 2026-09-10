import { optimizedAsset } from "./asset-url";

export type ComicVolume = {
  id: string;
  title: string;
  volume: number;
  cover: string;
  backCover: string;
  pages: string[];
};

// Only released volumes belong in this list; draft artwork folders do not publish a volume.
export const COMIC_VOLUMES: ComicVolume[] = [
  {
    id: "volume-1",
    title: "The Awakening",
    volume: 1,
    cover: optimizedAsset("/comic/Volume%201/cover.png"),
    backCover: optimizedAsset("/comic/Volume%201/back.png"),
    pages: Array.from({ length: 22 }, (_, index) => optimizedAsset(`/comic/Volume%201/page${index + 1}.png`)),
  },
];

export const comicVolume = (id: string) => COMIC_VOLUMES.find((volume) => volume.id === id);

export const UPCOMING_COMIC_VOLUMES: Pick<ComicVolume, "id" | "title" | "volume" | "cover">[] = [
  { id: "volume-2", title: "The Firstborn", volume: 2, cover: optimizedAsset("/comic/Volume%202/cover.png") },
];

export function comicSequence(volume: ComicVolume) {
  return [volume.cover, ...volume.pages, volume.backCover];
}

export function comicPageLabel(index: number, volume: ComicVolume) {
  if (index === 0) return "Front cover";
  if (index === volume.pages.length + 1) return "Back cover";
  return `Page ${index}`;
}
