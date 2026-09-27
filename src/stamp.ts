// Stamp "last modified" frontmatter fields on content writes (STAMP_FIELDS env var).
// Off unless configured. When on, write_note and edit_note set the modified-date
// field to today (in STAMP_TIMEZONE / DISPLAY_TIMEZONE) and the modified-by field
// to the caller-supplied `by`, unless the call marks itself `mechanical` or the
// call's own content already changed that field.

import { isPathWritable, parseWriteFolders } from "./write-scope.js";

export interface StampConfig {
    /** Frontmatter key for the date, e.g. "senast_ändrad". */
    dateField: string;
    /** Frontmatter key for the writer, e.g. "senast_av". */
    byField: string;
    /** Allowed values for `by`; null = any non-empty string. */
    byValues: [string, ...string[]] | null;
    /** Folders where stamping applies; null = the whole vault. */
    folders: string[] | null;
    /** IANA zone used for "today". */
    timeZone: string;
}

export interface StampResult {
    content: string;
    /** One line for the tool response. */
    report: string;
}

/**
 * STAMP_FIELDS="<date field>,<by field>" turns stamping on. STAMP_BY_VALUES limits
 * `by` to a list; STAMP_FOLDERS limits where it applies (same syntax as WRITE_FOLDERS).
 */
export function parseStampConfig(env: Record<string, string | undefined>, timeZone: string): StampConfig | null {
    const fields = (env.STAMP_FIELDS ?? "").split(",").map((f) => f.trim()).filter(Boolean);
    if (fields.length === 0) return null;
    if (fields.length !== 2) {
        throw new Error(`STAMP_FIELDS must name exactly two fields (date,by), got ${fields.length}.`);
    }
    const values = (env.STAMP_BY_VALUES ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    return {
        dateField: fields[0].normalize("NFC"),
        byField: fields[1].normalize("NFC"),
        byValues: values.length > 0 ? (values as [string, ...string[]]) : null,
        folders: parseWriteFolders(env.STAMP_FOLDERS),
        timeZone,
    };
}

/** "2026-09-27" for the given instant in the given zone. */
export function todayIn(timeZone: string, ms: number = Date.now()): string {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

const FRONTMATTER = /^---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)/;

interface Block {
    /** Offset of the first character of the first field line. */
    start: number;
    /** Offset just past the last field line (before the newline preceding the closing ---). */
    end: number;
    eol: string;
    lines: string[];
}

function findBlock(content: string): Block | null {
    const m = content.match(FRONTMATTER);
    if (!m) return null;
    const eol = m[1];
    const start = 3 + eol.length;
    const body = m[2];
    return { start, end: start + body.length, eol, lines: body.split(/\r?\n/) };
}

function keyOf(line: string): string | null {
    const m = line.match(/^([^\s:#-][^:]*?)\s*:/);
    return m ? m[1].normalize("NFC") : null;
}

function fieldLine(block: Block | null, field: string): string | undefined {
    if (!block) return undefined;
    return block.lines.find((l) => keyOf(l) === field);
}

function valueOf(line: string): string {
    return line.slice(line.indexOf(":") + 1).trim();
}

/**
 * Stamp `updated` (the text about to be written). `existing` is the note's current
 * text, or null for a new note. A field counts as set by the call when its line is
 * present in `updated` and either the note is new or the line differs from `existing`;
 * such a field is left as the call wrote it.
 */
export function applyStamp(
    path: string,
    existing: string | null,
    updated: string,
    opts: { by: string; mechanical?: boolean; today: string; config: StampConfig },
): StampResult {
    const { by, mechanical, today, config } = opts;
    if (mechanical) return { content: updated, report: "Not stamped (mechanical)." };
    if (!isPathWritable(path, config.folders)) {
        return { content: updated, report: "Not stamped: outside STAMP_FOLDERS." };
    }
    const block = findBlock(updated);
    if (!block) return { content: updated, report: "Not stamped: no frontmatter." };
    const before = existing === null ? null : findBlock(existing);

    const wanted: [string, string][] = [
        [config.dateField, today],
        [config.byField, by],
    ];
    const lines = [...block.lines];
    const notes: string[] = [];
    const stamped: string[] = [];
    for (const [field, value] of wanted) {
        const now = fieldLine(block, field);
        const was = fieldLine(before, field);
        const setByCall = now !== undefined && (existing === null || now !== was);
        if (setByCall) {
            notes.push(`kept ${field}=${valueOf(now!)} from the content`);
            continue;
        }
        const newLine = `${field}: ${value}`;
        const idx = lines.findIndex((l) => keyOf(l) === field);
        if (idx === -1) lines.push(newLine);
        else lines[idx] = newLine;
        stamped.push(`${field}=${value}`);
    }
    const content = updated.slice(0, block.start) + lines.join(block.eol) + updated.slice(block.end);
    const parts: string[] = [];
    if (stamped.length) parts.push(`Stamped: ${stamped.join(", ")}`);
    if (notes.length) parts.push((stamped.length ? "; " : "Not stamped: ") + notes.join(", ") + (notes.some((n) => n.startsWith(`kept ${config.byField}=`)) ? ` (by=${by})` : ""));
    return { content, report: parts.join("") + "." };
}

/**
 * Error text for a missing or unknown `by`. A client that loaded the tool list before
 * stamping was switched on may not show the parameter at all, so the message says what
 * to send and that the client's schema may be outdated.
 */
export function byErrorMessage(values: string[] | null, received: unknown): string {
    const list = values ? ` (one of: ${values.join(", ")})` : "";
    if (received === undefined) {
        return `Required: pass by = the surface that writes${list}. Your tool list may be outdated — the server requires this parameter even if your schema does not show it.`;
    }
    return `Unknown value ${JSON.stringify(received)}: pass by = the surface that writes${list}.`;
}
