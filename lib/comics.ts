import { optimizedAsset } from "./asset-url";

export type ComicVolume = {
  id: string;
  title: string;
  volume: number;
  cover: string;
  backCover: string;
  pages: string[];
};

export const COMIC_VOLUMES: ComicVolume[] = [
  {
    id: "volume-1",
    title: "The Awakening",
    volume: 1,
    cover: optimizedAsset("/comic/cover.png"),
    backCover: optimizedAsset("/comic/back.png"),
    pages: Array.from({ length: 22 }, (_, index) => optimizedAsset(`/comic/page${index + 1}.png`)),
  },
];

export const comicVolume = (id: string) => COMIC_VOLUMES.find((volume) => volume.id === id);

export function comicSequence(volume: ComicVolume) {
  return [volume.cover, ...volume.pages, volume.backCover];
}

export function comicPageLabel(index: number, volume: ComicVolume) {
  if (index === 0) return "Front cover";
  if (index === volume.pages.length + 1) return "Back cover";
  return `Page ${index}`;
}
