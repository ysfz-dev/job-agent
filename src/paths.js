import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// "Was this module run directly?" On Windows a hand-built `file://` + argv[1]
// string does not match import.meta.url — the URL form has three slashes and an
// encoded drive letter, so the comparison silently fails and main() never runs.
// argv[1] is undefined under `node -e` and `node --eval`, where nothing is the
// main module — guard it, or importing any of these files from a one-liner
// throws before it can run.
export const isMain = (url) => !!process.argv[1] && url === pathToFileURL(process.argv[1]).href;
