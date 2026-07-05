import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SessionRepository } from "../../application/ports";
import type { SessionState } from "../../domain/types";

function resolveSessionBaseDir(): string {
  const configuredDir = process.env.XMOCHA_SESSION_DIR;

  if (!configuredDir) {
    return path.join(process.cwd(), ".xmocha-data", "sessions");
  }

  if (path.isAbsolute(configuredDir)) {
    return configuredDir;
  }

  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    configuredDir,
  );
}

export class FileSessionRepository implements SessionRepository {
  constructor(private readonly baseDir = resolveSessionBaseDir()) {}

  async save(session: SessionState): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const filePath = this.getFilePath(session.sessionId);
    await writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  }

  async load(sessionId: string): Promise<SessionState | null> {
    const filePath = this.getFilePath(sessionId);

    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content) as SessionState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async list(): Promise<SessionState[]> {
    await mkdir(this.baseDir, { recursive: true });
    const files = await readdir(this.baseDir);

    const loaded = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const content = await readFile(path.join(this.baseDir, file), "utf8");
            const parsed = JSON.parse(content) as Partial<SessionState>;
            return typeof parsed.sessionId === "string"
              ? parsed as SessionState
              : null;
          } catch {
            return null;
          }
        }),
    );

    const sessions = loaded.filter((session): session is SessionState => Boolean(session));
    return sessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  }

  private getFilePath(sessionId: string): string {
    const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitized || sanitized !== sessionId) {
      throw new Error("Invalid session id.");
    }
    const resolved = path.join(this.baseDir, `${sanitized}.json`);
    if (!resolved.startsWith(this.baseDir + path.sep)) {
      throw new Error("Invalid session id.");
    }
    return resolved;
  }
}
