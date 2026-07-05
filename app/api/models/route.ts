import { NextResponse } from "next/server";

import { buildPublicModelCatalog } from "../../../src/infrastructure/llm/model-catalog";

export async function GET() {
  return NextResponse.json(buildPublicModelCatalog());
}
