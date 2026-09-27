import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeDeepLink } from "./deeplink.js";

describe("makeDeepLink", () => {
    it("strips .md extension from path", () => {
        assert.equal(
            makeDeepLink("MyVault", "notes/hello.md"),
            "obsidian://open?vault=MyVault&file=notes/hello",
        );
    });

    it("handles path without .md extension", () => {
        assert.equal(
            makeDeepLink("MyVault", "notes/hello"),
            "obsidian://open?vault=MyVault&file=notes/hello",
        );
    });

    it("encodes spaces in vault name", () => {
        assert.equal(
            makeDeepLink("My Vault", "note.md"),
            "obsidian://open?vault=My%20Vault&file=note",
        );
    });

    it("encodes spaces but keeps slashes in path", () => {
        assert.equal(
            makeDeepLink("V", "folder/sub folder/note.md"),
            "obsidian://open?vault=V&file=folder/sub%20folder/note",
        );
    });

    it("handles empty path", () => {
        assert.equal(makeDeepLink("V", ""), "obsidian://open?vault=V&file=");
    });

    it("only strips trailing .md, not mid-path", () => {
        assert.equal(
            makeDeepLink("V", "my.md.backup/note.md"),
            "obsidian://open?vault=V&file=my.md.backup/note",
        );
    });

    it("keeps slashes, encodes space, å/ä/ö and query delimiters", () => {
        assert.equal(
            makeDeepLink("MittNav", "MCP TEST/u137 länkprov/a&b#c?d åäö.md"),
            "obsidian://open?vault=MittNav&file=MCP%20TEST/u137%20l%C3%A4nkprov/a%26b%23c%3Fd%20%C3%A5%C3%A4%C3%B6",
        );
    });

    it("still encodes a slash in the vault name", () => {
        assert.equal(makeDeepLink("A/B", "n.md"), "obsidian://open?vault=A%2FB&file=n");
    });
});
