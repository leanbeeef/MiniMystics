import { NextResponse } from "next/server";
import catalog from "@/lib/data/cards.generated.json";

export const dynamic = "force-static";
export function GET() {
  return NextResponse.json({ mystics: catalog.mystics.length, handlers: catalog.handlers.length, warnings: catalog.importWarnings });
}
