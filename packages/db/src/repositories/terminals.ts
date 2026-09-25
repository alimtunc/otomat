import {
  terminalSessionSchema,
  type TerminalConversationEvidence,
  type TerminalSession,
} from "@otomat/domain";
import { and, asc, eq, inArray, lt } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues } from "../schema/issues.js";
import { projects } from "../schema/projects.js";
import { terminalFrames, terminalSessions } from "../schema/terminals.js";

export function createTerminalRecord(db: Db, session: TerminalSession): void {
  db.insert(terminalSessions)
    .values({
      id: session.id,
      project_id: session.project_id,
      session,
      updated_at: session.started_at,
    })
    .run();
}

export function deleteTerminalRecord(db: Db, id: string): void {
  db.delete(terminalSessions).where(eq(terminalSessions.id, id)).run();
}

export function listTerminalRecords(db: Db) {
  return db
    .select()
    .from(terminalSessions)
    .all()
    .map((row) => ({
      session: terminalSessionSchema.parse(row.session),
      updated_at: row.updated_at,
    }));
}

export function listTerminalConversationEvidence(db: Db): TerminalConversationEvidence[] {
  const rows = db
    .select({
      session: terminalSessions.session,
      updated_at: terminalSessions.updated_at,
      project_name: projects.name,
    })
    .from(terminalSessions)
    .innerJoin(projects, eq(terminalSessions.project_id, projects.id))
    .all()
    .map((row) => ({ ...row, session: terminalSessionSchema.parse(row.session) }));
  const issueIds = [
    ...new Set(
      rows.flatMap((row) => (row.session.issue_id === null ? [] : [row.session.issue_id])),
    ),
  ];
  const issueById = new Map(
    issueIds.length === 0
      ? []
      : db
          .select({ id: issues.id, identifier: issues.source_identifier, title: issues.title })
          .from(issues)
          .where(inArray(issues.id, issueIds))
          .all()
          .map((issue) => [issue.id, issue]),
  );
  return rows.map((row) => ({
    ...row,
    issue: row.session.issue_id === null ? null : (issueById.get(row.session.issue_id) ?? null),
  }));
}

export function finishTerminalRecord(db: Db, session: TerminalSession): void {
  db.update(terminalSessions)
    .set({ session, updated_at: new Date().toISOString() })
    .where(eq(terminalSessions.id, session.id))
    .run();
}

export function interruptTerminalRecords(db: Db): void {
  db.transaction(() => {
    for (const { session } of listTerminalRecords(db)) {
      if (session.state !== "exited")
        finishTerminalRecord(db, { ...session, state: "exited", exit_code: null, signal: null });
    }
  });
}

export function appendTerminalFrame(
  db: Db,
  id: string,
  seq: number,
  data: string,
  firstSeq: number,
): void {
  db.transaction((tx) => {
    tx.insert(terminalFrames).values({ terminal_id: id, seq, data }).run();
    tx.delete(terminalFrames)
      .where(and(eq(terminalFrames.terminal_id, id), lt(terminalFrames.seq, firstSeq)))
      .run();
  });
}

export function readTerminalOutput(db: Db, id: string, after: number) {
  const record = db.select().from(terminalSessions).where(eq(terminalSessions.id, id)).get();
  if (!record) return null;
  const frames = db
    .select()
    .from(terminalFrames)
    .where(eq(terminalFrames.terminal_id, id))
    .orderBy(asc(terminalFrames.seq))
    .all();
  return {
    session: terminalSessionSchema.parse(record.session),
    cursor: frames.at(-1)?.seq ?? 0,
    truncated: after < (frames[0]?.seq ?? 1) - 1,
    data: frames
      .filter((frame) => frame.seq > after)
      .map((frame) => frame.data)
      .join(""),
  };
}
