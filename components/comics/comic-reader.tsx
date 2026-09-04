"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Fullscreen, List, Maximize2 } from "lucide-react";
import HTMLFlipBook from "react-pageflip";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/components/game-provider";
import { comicPageLabel, comicSequence, type ComicVolume } from "@/lib/comics";
import { ComicPage } from "./comic-page";
import { ComicReaderToolbar } from "./comic-reader-toolbar";

type FlipBookHandle = {
  pageFlip(): {
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
  };
};

type PanStart = { x: number; y: number; left: number; top: number };
type BookSize = { width: number; height: number };

const COMIC_PAGE_RATIO = 1015 / 1550;

function emitComicSound(cue: "comic_open" | "page_turn" | "comic_close") {
  window.dispatchEvent(new CustomEvent("mini-mystics:sound", { detail: { cue } }));
}

export function ComicReader({ volume }: { volume: ComicVolume }) {
  const { state, ready, saveComicProgress } = useGame();
  const router = useRouter();
  const saved = state.comicProgress?.[volume.id];
  const sequence = useMemo(() => comicSequence(volume), [volume]);
  const lastIndex = sequence.length - 1;
  const initialPage = saved?.completed ? 0 : Math.min(lastIndex, saved?.pageIndex ?? 0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [bookSize, setBookSize] = useState<BookSize>({ width: 420, height: 641 });
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [zoom, setZoom] = useState(1);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsIdle, setControlsIdle] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const readerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<FlipBookHandle | null>(null);
  const idleTimer = useRef<number | null>(null);
  const panStart = useRef<PanStart | null>(null);

  useEffect(() => {
    if (ready && !state.account) router.replace("/");
  }, [ready, state.account, router]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === readerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    for (let index = Math.max(0, currentPage - 2); index <= Math.min(lastIndex, currentPage + 3); index += 1) {
      const image = new Image();
      image.src = sequence[index];
    }
  }, [currentPage, lastIndex, sequence]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    const fitBook = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const availableWidth = Math.max(100, stage.clientWidth - 12);
        const availableHeight = Math.max(120, stage.clientHeight - 8);
        const useSpread = availableWidth >= 720 || (availableWidth >= 560 && availableWidth / availableHeight >= 1.35);
        const widthLimit = availableWidth / (useSpread ? 2 : 1);
        const width = Math.max(78, Math.floor(Math.min(widthLimit, availableHeight * COMIC_PAGE_RATIO)));
        const height = Math.floor(width / COMIC_PAGE_RATIO);
        setBookSize((current) => current.width === width && current.height === height ? current : { width, height });
        setOrientation(useSpread ? "landscape" : "portrait");
      });
    };

    fitBook();
    const observer = new ResizeObserver(fitBook);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const wakeControls = useCallback(() => {
    setControlsIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (fullscreen) idleTimer.current = window.setTimeout(() => setControlsIdle(true), 2600);
  }, [fullscreen]);

  useEffect(() => {
    wakeControls();
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); };
  }, [fullscreen, wakeControls]);

  const previous = useCallback(() => bookRef.current?.pageFlip().flipPrev("bottom"), []);
  const next = useCallback(() => bookRef.current?.pageFlip().flipNext("bottom"), []);
  const jump = useCallback((page: number) => bookRef.current?.pageFlip().turnToPage(Math.max(0, Math.min(lastIndex, page))), [lastIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await readerRef.current?.requestFullscreen();
  }, []);

  const onFlip = useCallback((event: { data: number }) => {
    const page = Number(event.data);
    setCurrentPage(page);
    saveComicProgress(volume.id, page, page >= lastIndex);
    emitComicSound(page === 1 ? "comic_open" : page >= lastIndex ? "comic_close" : "page_turn");
  }, [lastIndex, saveComicProgress, volume.id]);

  const indicator = currentPage === 0
    ? "Front Cover"
    : currentPage >= lastIndex
      ? "Back Cover"
      : orientation === "landscape"
        ? `Pages ${currentPage}–${Math.min(volume.pages.length, currentPage + 1)} of ${volume.pages.length}`
        : `Page ${currentPage} of ${volume.pages.length}`;

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || !stageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panStart.current = { x: event.clientX, y: event.clientY, left: stageRef.current.scrollLeft, top: stageRef.current.scrollTop };
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current || !stageRef.current) return;
    stageRef.current.scrollLeft = panStart.current.left - (event.clientX - panStart.current.x);
    stageRef.current.scrollTop = panStart.current.top - (event.clientY - panStart.current.y);
  };
  const endPan = () => { panStart.current = null; };

  if (!ready || !state.account) return <main className="comic-reader-loading"><span /><p>Opening the archive…</p></main>;

  return <main ref={readerRef} className={`comic-reader ${fullscreen ? "is-fullscreen" : ""} ${controlsIdle ? "controls-idle" : ""} ${zoom > 1 ? "is-zoomed" : ""}`} onPointerMove={wakeControls} onPointerDown={wakeControls}>
    <header className="comic-reader-topbar">
      <Link href="/comics"><ArrowLeft />Back to Library</Link>
      <div><span>MINI MYSTICS</span><strong>Volume {volume.volume} — {volume.title}</strong></div>
      <nav aria-label="Reader display options">
        <button className={thumbnailsOpen ? "active" : ""} onClick={() => setThumbnailsOpen((open) => !open)} aria-label="Toggle page thumbnails" aria-pressed={thumbnailsOpen}><List /></button>
        <button onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? <Maximize2 /> : <Fullscreen />}</button>
      </nav>
    </header>

    <section className="comic-reading-surface" aria-label={`Reading Volume ${volume.volume}: ${volume.title}`}>
      <div ref={stageRef} className="comic-book-stage" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        <div className="comic-book-zoom-space" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <div className="comic-book-scale" style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }}>
            <HTMLFlipBook
              key={`${bookSize.width}x${bookSize.height}`}
              ref={bookRef}
              className="comic-flip-book"
              style={{}}
              width={bookSize.width}
              height={bookSize.height}
              size="fixed"
              minWidth={78}
              maxWidth={680}
              minHeight={119}
              maxHeight={1038}
              startPage={currentPage}
              drawShadow
              flippingTime={reducedMotion ? 220 : 760}
              usePortrait
              startZIndex={1}
              autoSize
              maxShadowOpacity={reducedMotion ? .14 : .48}
              showCover
              mobileScrollSupport={zoom <= 1}
              clickEventForward
              useMouseEvents={zoom <= 1}
              swipeDistance={24}
              showPageCorners={!reducedMotion}
              disableFlipByClick={zoom > 1}
              onFlip={onFlip}
              onChangeOrientation={(event: { data: "portrait" | "landscape" }) => setOrientation(event.data)}
            >
              {sequence.map((src, index) => <ComicPage key={src} src={src} label={comicPageLabel(index, volume)} hard={index === 0 || index === lastIndex} eager={Math.abs(index - currentPage) <= 2} />)}
            </HTMLFlipBook>
          </div>
        </div>
        {currentPage >= lastIndex ? <div className="comic-complete-card"><BookOpen /><span>THE END</span><h2>Volume {volume.volume} Complete</h2><p>{volume.title}</p><Link href="/comics">Return to Library</Link></div> : null}
      </div>
    </section>

    {thumbnailsOpen ? <nav className="comic-thumbnail-strip" aria-label="Comic pages">
      {sequence.map((src, index) => {
        const active = index === currentPage || (orientation === "landscape" && currentPage > 0 && index === currentPage + 1 && index < lastIndex);
        return <button key={src} className={active ? "active" : ""} onClick={() => jump(index)} aria-label={`Go to ${comicPageLabel(index, volume)}`} aria-current={active ? "page" : undefined}><img src={src} alt="" loading="lazy" /><span>{index === 0 ? "Cover" : index === lastIndex ? "Back" : index}</span></button>;
      })}
    </nav> : null}

    <ComicReaderToolbar current={currentPage} max={lastIndex} indicator={indicator} zoom={zoom} thumbnailsOpen={thumbnailsOpen} fullscreen={fullscreen} onPrevious={previous} onNext={next} onJump={jump} onZoom={setZoom} onToggleThumbnails={() => setThumbnailsOpen((open) => !open)} onToggleFullscreen={toggleFullscreen} />
  </main>;
}
