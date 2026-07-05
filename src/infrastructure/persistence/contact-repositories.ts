import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ContactRepository,
  ContactSubmission,
} from "../../application/ports";
import { getDatabase, type XMochaDatabase } from "./database";
import { contacts } from "./schema";

export class FileContactRepository implements ContactRepository {
  constructor(
    private readonly baseDir = path.join(
      process.cwd(),
      ".xmocha-data",
      "contacts",
    ),
  ) {}

  async save(submission: ContactSubmission): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await appendFile(
      path.join(this.baseDir, "contacts.jsonl"),
      `${JSON.stringify(submission)}\n`,
      "utf8",
    );
  }
}

export class PostgresContactRepository implements ContactRepository {
  constructor(private readonly database: XMochaDatabase = getDatabase()) {}

  async save(submission: ContactSubmission): Promise<void> {
    await this.database.insert(contacts).values({
      id: submission.id,
      contact: submission.contact,
      intent: submission.intent,
      message: submission.message,
      sessionId: submission.sessionId,
      createdAt: new Date(submission.createdAt),
    });
  }
}
