import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq } from "drizzle-orm";

import type { WorldPackRepository } from "../../application/ports";
import { listCuratedWorldPacks } from "../../domain/world-packs";
import type { StoredWorldPack, WorldPack } from "../../domain/world-types";
import { getDatabase, type XMochaDatabase } from "./database";
import { worldPacks } from "./schema";

function worldPackBaseDir(): string {
  return path.join(process.cwd(), ".xmocha-data", "world-packs");
}

export class FileWorldPackRepository implements WorldPackRepository {
  constructor(private readonly baseDir = worldPackBaseDir()) {}

  async save(record: StoredWorldPack): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(
      path.join(this.baseDir, `${record.pack.worldPackId}-v${record.pack.version}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
  }

  async load(worldPackId: string, version?: number): Promise<StoredWorldPack | null> {
    const curated = listCuratedWorldPacks().find(
      (pack) => pack.worldPackId === worldPackId && (!version || pack.version === version),
    );
    if (curated) return curatedRecord(curated);

    await mkdir(this.baseDir, { recursive: true });
    const files = (await readdir(this.baseDir))
      .filter((file) => file.startsWith(`${worldPackId}-v`) && file.endsWith(".json"))
      .sort()
      .reverse();
    const selected = version
      ? files.find((file) => file === `${worldPackId}-v${version}.json`)
      : files[0];
    if (!selected) return null;
    return JSON.parse(await readFile(path.join(this.baseDir, selected), "utf8")) as StoredWorldPack;
  }

  async listCurated(): Promise<WorldPack[]> {
    return listCuratedWorldPacks();
  }
}

export class PostgresWorldPackRepository implements WorldPackRepository {
  constructor(private readonly database: XMochaDatabase = getDatabase()) {}

  async save(record: StoredWorldPack): Promise<void> {
    await this.database.insert(worldPacks).values({
      id: record.pack.worldPackId,
      version: record.pack.version,
      visibility: record.pack.visibility,
      sourceType: record.pack.sourceType,
      ownerTokenHash: record.ownerTokenHash,
      packJson: record.pack,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  async load(worldPackId: string, version?: number): Promise<StoredWorldPack | null> {
    const curated = listCuratedWorldPacks().find(
      (pack) => pack.worldPackId === worldPackId && (!version || pack.version === version),
    );
    if (curated) return curatedRecord(curated);

    const rows = await this.database
      .select()
      .from(worldPacks)
      .where(
        version
          ? and(eq(worldPacks.id, worldPackId), eq(worldPacks.version, version))
          : eq(worldPacks.id, worldPackId),
      )
      .orderBy(desc(worldPacks.version))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      pack: row.packJson,
      ownerTokenHash: row.ownerTokenHash ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listCurated(): Promise<WorldPack[]> {
    return listCuratedWorldPacks();
  }
}

function curatedRecord(pack: WorldPack): StoredWorldPack {
  return {
    pack,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
  };
}

