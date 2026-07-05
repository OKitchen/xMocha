import { NextResponse } from "next/server";

import { listPublicWorldPacks } from "../../../src/interfaces/web/world-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../src/interfaces/web/rate-limit-response";

export async function GET(request: Request) {
  try {
    const limited = await rateLimitResponse(request, publicRateLimits.worldList);
    if (limited) return limited;

    const worlds = (await listPublicWorldPacks()).map((pack) => ({
      ...pack,
      characters: pack.characters.map((character) => ({
        ...character,
        hiddenAgenda: undefined,
        unknownFactIds: [],
      })),
    }));
    return NextResponse.json({ worlds });
  } catch (error) {
    console.error("world_list_failed", error);
    return NextResponse.json(
      { error: "Failed to load world packs." },
      { status: 500 },
    );
  }
}
