"use client";

import { ChevronLeft, ChevronRight, Fullscreen, List, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

type Props = {
  current: number;
  max: number;
  indicator: string;
  zoom: number;
  thumbnailsOpen: boolean;
  fullscreen: boolean;
  onPrevious(): void;
  onNext(): void;
  onJump(page: number): void;
  onZoom(value: number): void;
  onToggleThumbnails(): void;
  onToggleFullscreen(): void;
};

export function ComicReaderToolbar({ current, max, indicator, zoom, thumbnailsOpen, fullscreen, onPrevious, onNext, onJump, onZoom, onToggleThumbnails, onToggleFullscreen }: Props) {
  return <footer className="comic-reader-toolbar" aria-label="Comic reader controls">
    <button onClick={onPrevious} disabled={current === 0} aria-label="Previous page"><ChevronLeft /><span>Previous</span></button>
    <div className="comic-progress-control">
      <strong>{indicator}</strong>
      <input type="range" min={0} max={max} value={current} onChange={(event) => onJump(Number(event.target.value))} aria-label="Reading progress" />
    </div>
    <div className="comic-zoom-controls" aria-label="Zoom controls">
      <button onClick={() => onZoom(Math.max(.8, zoom - .2))} disabled={zoom <= .8} aria-label="Zoom out"><Minus /></button>
      <button onClick={() => onZoom(1)} aria-label="Reset zoom"><RotateCcw /><span>{Math.round(zoom * 100)}%</span></button>
      <button onClick={() => onZoom(Math.min(2, zoom + .2))} disabled={zoom >= 2} aria-label="Zoom in"><Plus /></button>
    </div>
    <button className={thumbnailsOpen ? "active" : ""} onClick={onToggleThumbnails} aria-label="Toggle page thumbnails" aria-pressed={thumbnailsOpen}><List /><span>Pages</span></button>
    <button onClick={onToggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? <Maximize2 /> : <Fullscreen />}<span>{fullscreen ? "Exit" : "Fullscreen"}</span></button>
    <button onClick={onNext} disabled={current >= max} aria-label="Next page"><span>Next</span><ChevronRight /></button>
  </footer>;
}
