// Claude Code hook (PostToolUse on Edit/Write/MultiEdit): whatever file was just
// written is converted to LF at once, so a CRLF file can never reach a test (UV, 28 Nov).
import { spawnSync } from "node:child_process";
import path from "node:path";

let input = "";
process.stdin.on("data", c => (input += c));
process.stdin.on("end", () => {
	try {
		const file = JSON.parse(input)?.tool_input?.file_path;
		if (!file) return;
		const script = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), "tools/eol/fix-eol.mjs");
		spawnSync(process.execPath, [script, file], { stdio: "inherit" });
	} catch { /* never block a write */ }
});
