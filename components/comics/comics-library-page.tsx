"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { useGame } from "@/components/game-provider";
import { COMIC_VOLUMES } from "@/lib/comics";
import { ComicVolumeTile } from "./comic-volume-tile";

export function ComicsLibraryPage() {
  const { state } = useGame();

  return <div className="page comics-library-page">
    <header className="comics-library-head">
      <div><span className="eyebrow">THE ARCHIVE</span><h1>Comics</h1><p>Read the stories behind the Mystics, Handlers, Orders, and Convergence.</p></div>
      <div className="archive-mark" aria-hidden="true"><Sparkles /><BookOpen /></div>
    </header>
    <section className="comic-shelf" aria-label="Comic library">
      <div className="comic-shelf-volumes">
        {COMIC_VOLUMES.map((volume) => <ComicVolumeTile key={volume.id} volume={volume} progress={state.comicProgress?.[volume.id]} />)}
      </div>
      <div className="comic-shelf-edge" aria-hidden="true" />
    </section>
  </div>;
}
