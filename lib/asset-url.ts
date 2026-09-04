export function optimizedAsset(source: string): string;
export function optimizedAsset(source: null): null;
export function optimizedAsset(source: string | null): string | null;
export function optimizedAsset(source: string | null): string | null {
  if (!source || !source.startsWith("/") || !/\.(png|jpe?g)$/i.test(source)) return source;
  return `/optimized${source.replace(/\.(png|jpe?g)$/i, ".webp")}`;
}
