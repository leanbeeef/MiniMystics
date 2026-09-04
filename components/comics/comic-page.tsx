"use client";

import { forwardRef, useState } from "react";

type ComicPageProps = {
  src: string;
  label: string;
  hard?: boolean;
  eager?: boolean;
};

export const ComicPage = forwardRef<HTMLDivElement, ComicPageProps>(function ComicPage({ src, label, hard = false, eager = false }, ref) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return <div ref={ref} className={`comic-page-sheet ${loaded ? "loaded" : ""}`} data-density={hard ? "hard" : "soft"}>
    <div className="comic-page-loading" aria-hidden="true"><span /></div>
    {failed
      ? <div className="comic-page-error" role="img" aria-label={`${label} could not be loaded`}><strong>Page unavailable</strong><span>Try reloading the reader.</span></div>
      : <img src={src} alt={label} draggable={false} loading={eager ? "eager" : "lazy"} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    <span className="comic-paper-edge" aria-hidden="true" />
  </div>;
});
