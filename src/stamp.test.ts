import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyStamp, byErrorMessage, parseStampConfig, todayIn, type StampConfig } from "./stamp.js";

const config: StampConfig = parseStampConfig(
    {
        STAMP_FIELDS: "senast_ändrad,senast_av",
        STAMP_BY_VALUES: "desktop,cowork,code-vps",
        STAMP_FOLDERS: "ai-minne,MCP TEST",
    },
    "Europe/Stockholm",
)!;
const today = "2026-09-27";
const P = "ai-minne/x.md";
const note = (fm: string, body = "Body\n") => `---\n${fm}\n---\n${body}`;
const OLD = note("skapad: 2026-09-01\nsenast_ändrad: 2026-09-01\nsenast_av: cowork\ntags: [a]");

describe("parseStampConfig", () => {
    it("is off without STAMP_FIELDS", () => {
        assert.equal(parseStampConfig({}, "UTC"), null);
    });
    it("rejects a field list that is not exactly two", () => {
        assert.throws(() => parseStampConfig({ STAMP_FIELDS: "a" }, "UTC"));
    });
    it("reads fields, values and folders", () => {
        assert.equal(config.dateField, "senast_ändrad");
        assert.equal(config.byField, "senast_av");
        assert.deepEqual(config.byValues, ["desktop", "cowork", "code-vps"]);
        assert.deepEqual(config.folders, ["ai-minne", "MCP TEST"]);
    });
});

describe("todayIn", () => {
    it("uses the zone, not UTC, across midnight", () => {
        const ms = Date.parse("2026-09-26T22:30:00Z"); // 00:30 CEST on the 27th
        assert.equal(todayIn("Europe/Stockholm", ms), "2026-09-27");
        assert.equal(todayIn("UTC", ms), "2026-09-26");
    });
});

describe("applyStamp", () => {
    it("stamps a content change to an existing note", () => {
        const updated = OLD.replace("Body", "Body changed");
        const r = applyStamp(P, OLD, updated, { by: "desktop", today, config });
        assert.match(r.content, /^senast_ändrad: 2026-09-27$/m);
        assert.match(r.content, /^senast_av: desktop$/m);
        assert.match(r.content, /^skapad: 2026-09-01$/m, "other fields untouched");
        assert.ok(r.content.endsWith("Body changed\n"));
        assert.equal(r.report, "Stamped: senast_ändrad=2026-09-27, senast_av=desktop.");
    });

    it("leaves everything alone when mechanical", () => {
        const updated = OLD.replace("[a]", "[a, b]");
        const r = applyStamp(P, OLD, updated, { by: "desktop", mechanical: true, today, config });
        assert.equal(r.content, updated);
        assert.equal(r.report, "Not stamped (mechanical).");
    });

    it("keeps a senast_av the call itself changed, and still stamps the date", () => {
        const updated = OLD.replace("senast_av: cowork", "senast_av: code-vps");
        const r = applyStamp(P, OLD, updated, { by: "desktop", today, config });
        assert.match(r.content, /^senast_av: code-vps$/m);
        assert.match(r.content, /^senast_ändrad: 2026-09-27$/m);
        assert.equal(r.report, "Stamped: senast_ändrad=2026-09-27; kept senast_av=code-vps from the content (by=desktop).");
    });

    it("keeps both fields when the call sets both", () => {
        const updated = OLD.replace("senast_ändrad: 2026-09-01", "senast_ändrad: 2026-09-20").replace("senast_av: cowork", "senast_av: desktop");
        const r = applyStamp(P, OLD, updated, { by: "code-vps", today, config });
        assert.equal(r.content, updated);
        assert.match(r.report, /^Not stamped: kept senast_ändrad=2026-09-20 from the content, kept senast_av=desktop/);
    });

    it("keeps fields a new note brings, fills the ones it lacks", () => {
        const fresh = note("skapad: 2026-09-27\nskapad_av: desktop\nsenast_av: desktop");
        const r = applyStamp(P, null, fresh, { by: "code-vps", today, config });
        assert.match(r.content, /^senast_av: desktop$/m);
        assert.match(r.content, /^senast_ändrad: 2026-09-27$/m);
    });

    it("adds missing fields at the end of the block", () => {
        const old = note("ämne: x");
        const r = applyStamp(P, old, old.replace("Body", "New"), { by: "cowork", today, config });
        assert.equal(r.content, "---\nämne: x\nsenast_ändrad: 2026-09-27\nsenast_av: cowork\n---\nNew\n");
    });

    it("re-adds fields a write_note dropped", () => {
        const updated = note("skapad: 2026-09-01\ntags: [a]", "Rewritten\n");
        const r = applyStamp(P, OLD, updated, { by: "cowork", today, config });
        assert.match(r.content, /^senast_ändrad: 2026-09-27$/m);
        assert.match(r.content, /^senast_av: cowork$/m);
    });

    it("does nothing without frontmatter", () => {
        const r = applyStamp(P, "plain\n", "plain more\n", { by: "cowork", today, config });
        assert.equal(r.content, "plain more\n");
        assert.equal(r.report, "Not stamped: no frontmatter.");
    });

    it("does nothing outside STAMP_FOLDERS (SPS)", () => {
        const r = applyStamp("SPS/x.md", OLD, OLD.replace("Body", "B2"), { by: "cowork", today, config });
        assert.equal(r.content, OLD.replace("Body", "B2"));
        assert.equal(r.report, "Not stamped: outside STAMP_FOLDERS.");
    });

    it("stamps inside MCP TEST", () => {
        const r = applyStamp("MCP TEST/MCP-TEST-x.md", OLD, OLD.replace("Body", "B2"), { by: "cowork", today, config });
        assert.match(r.report, /^Stamped/);
    });

    it("keeps CRLF line endings", () => {
        const old = OLD.replace(/\n/g, "\r\n");
        const r = applyStamp(P, old, old.replace("Body", "B2"), { by: "desktop", today, config });
        assert.ok(r.content.includes("senast_ändrad: 2026-09-27\r\nsenast_av: desktop\r\n"));
        assert.ok(!/[^\r]\n/.test(r.content), "no bare LF introduced");
    });

    it("matches an NFD-spelled key", () => {
        const nfd = "senast_ändrad".normalize("NFD");
        const old = note(`${nfd}: 2026-09-01\nsenast_av: cowork`);
        const r = applyStamp(P, old, old.replace("Body", "B2"), { by: "desktop", today, config });
        assert.equal((r.content.match(/senast_a/g) ?? []).length, 1, "no duplicate line added");
        assert.match(r.content, /^senast_ändrad: 2026-09-27$/m);
    });

    it("ignores a --- rule in the body", () => {
        const old = note("senast_av: cowork", "Text\n---\nsenast_av: nope\n");
        const r = applyStamp(P, old, old.replace("Text", "T2"), { by: "desktop", today, config });
        assert.match(r.content, /\nsenast_av: nope\n$/, "body untouched");
        assert.match(r.content, /^---\nsenast_av: desktop\nsenast_ändrad: 2026-09-27\n---\n/);
    });

    it("reports an unchanged stamp as stamped (same day, same writer)", () => {
        const same = note("senast_ändrad: 2026-09-27\nsenast_av: desktop");
        const r = applyStamp(P, same, same.replace("Body", "B2"), { by: "desktop", today, config });
        assert.equal(r.content, same.replace("Body", "B2"));
        assert.match(r.report, /^Stamped/);
    });
});

describe("byErrorMessage", () => {
    it("says what to send and that the schema may be outdated when by is missing", () => {
        const m = byErrorMessage(["desktop", "code-vps"], undefined);
        assert.match(m, /^Required: pass by = the surface that writes \(one of: desktop, code-vps\)\./);
        assert.match(m, /tool list may be outdated/);
    });
    it("names the bad value and the valid ones", () => {
        assert.equal(byErrorMessage(["desktop"], "nobody"), 'Unknown value "nobody": pass by = the surface that writes (one of: desktop).');
    });
});
