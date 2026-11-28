// Line endings: every text file in the repo is LF (UV, 28 Nov).
//   node tools/eol/fix-eol.mjs          converts CRLF to LF in place, lists what changed
//   node tools/eol/fix-eol.mjs --check  changes nothing; exits 1 and lists any CRLF file
//   node tools/eol/fix-eol.mjs <file>…  converts only the files given (used by the Claude Code hook)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP_DIRS = new Set(["node_modules", "_site", ".git", "private-data", ".temp", "worktrees"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svgz|mp4|webm|mov|mp3|wav|ogg|glb|gltf|bin|woff2?|ttf|otf|eot|pdf|zip|gz|7z|exe|dll)$/i;

const args = process.argv.slice(2);
const check = args.includes("--check");
const files = args.filter(a => a !== "--check");

function walk(dir, out) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
		else if (e.isFile() && !BINARY.test(e.name)) out.push(path.join(dir, e.name));
	}
	return out;
}

const targets = files.length ? files.map(f => path.resolve(f)) : walk(root, []);
const hits = [];
for (const f of targets) {
	if (!fs.existsSync(f) || BINARY.test(f)) continue;
	const buf = fs.readFileSync(f);
	if (buf.includes(0)) continue; // binary
	const s = buf.toString("utf8");
	if (!s.includes("\r\n")) continue;
	hits.push(path.relative(root, f));
	if (!check) fs.writeFileSync(f, s.replace(/\r\n/g, "\n"));
}

if (check) {
	if (hits.length) {
		console.error(`[EOL] ${hits.length} file(s) with CRLF — run: npm run eol`);
		hits.forEach(h => console.error("  " + h));
		process.exit(1);
	}
	console.log("[EOL] all LF");
} else if (!files.length) {
	console.log(hits.length ? `[EOL] converted ${hits.length} file(s) to LF` : "[EOL] all LF already");
	hits.forEach(h => console.log("  " + h));
}
