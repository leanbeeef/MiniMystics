"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { ComicProgress } from "@/lib/client-state";
import type { ComicVolume } from "@/lib/comics";

export function UpcomingComicVolumeTile({ volume }: { volume: Pick<ComicVolume, "title" | "volume" | "cover"> }) {
  return <article className="comic-volume-tile comic-volume-upcoming" aria-label={`Volume ${volume.volume}: ${volume.title}, coming soon`}>
    <div className="comic-cover-display">
      <span className="comic-cover-pages" aria-hidden="true" />
      <img src={volume.cover} alt={`Cover of Mini Mystics Volume ${volume.volume}: ${volume.title}`} />
      <span className="comic-coming-soon-banner">Coming Soon</span>
    </div>
    <div className="comic-volume-meta">
      <span>VOLUME {volume.volume}</span>
      <h2>{volume.title}</h2>
      <p>Not yet released</p>
      <span className="comic-release-status">Coming soon</span>
    </div>
  </article>;
}

export function ComicVolumeTile({ volume, progress }: { volume: ComicVolume; progress?: ComicProgress }) {
  const started = Boolean(progress && progress.pageIndex > 0 && !progress.completed);
  const page = Math.min(volume.pages.length, Math.max(1, progress?.pageIndex ?? 1));
  const percent = progress?.completed ? 100 : Math.round(((progress?.pageIndex ?? 0) / (volume.pages.length + 1)) * 100);

  return <article className="comic-volume-tile">
    <Link className="comic-cover-display" href={`/comics/${volume.id}`} aria-label={`${started ? "Continue" : "Read"} Volume ${volume.volume}: ${volume.title}`}>
      <span className="comic-cover-pages" aria-hidden="true" />
      <img src={volume.cover} alt={`Cover of Mini Mystics Volume ${volume.volume}: ${volume.title}`} />
      <span className="comic-cover-shine" aria-hidden="true" />
    </Link>
    <div className="comic-volume-meta">
      <span>VOLUME {volume.volume}</span>
      <h2>{volume.title}</h2>
      <p>{volume.pages.length} pages</p>
      {started ? <div className="comic-library-progress"><div><span>Page {page}</span><span>{percent}%</span></div><i><b style={{ width: `${percent}%` }} /></i></div> : null}
      <Link className="comic-read-button" href={`/comics/${volume.id}`}><BookOpen />{progress?.completed ? "Read Again" : started ? `Continue Reading — Page ${page}` : "Read"}<ArrowRight /></Link>
    </div>
  </article>;
}
