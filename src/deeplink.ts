/**
 * Generate Obsidian deep links for notes.
 * Works on Mac and iOS: obsidian://open?vault=<name>&file=<path>
 * The path keeps "/" literal so the link stays readable; every other
 * reserved character is percent-encoded as before.
 */
export function makeDeepLink(vaultName: string, notePath: string): string {
    const cleanPath = notePath.replace(/\.md$/, "");
    const encodedVault = encodeURIComponent(vaultName);
    const encodedPath = encodeURIComponent(cleanPath).replace(/%2F/g, "/");
    return `obsidian://open?vault=${encodedVault}&file=${encodedPath}`;
}
