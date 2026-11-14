/**
 * Validates integrity + i18n, builds the code-split web bundle (`dist/`),
 * and deploys it to GitHub Pages (`gh-pages` branch).
 *
 * Usage: node scripts/publish-web.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const DEFAULT_REMOTE = "https://github.com/Goanarchy/Watchdogs-NJ-Civic-Analytics.git";

function run(cmd, args, cwd = root, shell = false) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${res.status ?? "unknown"}`);
  }
}

function getRemoteUrl() {
  const res = spawnSync("git", ["-C", root, "remote", "get-url", "origin"], {
    encoding: "utf8",
  });
  const url = res.status === 0 ? res.stdout.trim() : "";
  return url || DEFAULT_REMOTE;
}

run(process.execPath, [path.join(root, "scripts", "validate-data.mjs")]);
run(process.execPath, [path.join(root, "scripts", "check-i18n.mjs")]);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
run(npmCmd, ["run", "build"], root, process.platform === "win32");

const distIndex = path.join(distDir, "index.html");
const distAssets = path.join(distDir, "assets");
if (!existsSync(distIndex) || !existsSync(distAssets)) {
  throw new Error("Missing built dist/index.html or dist/assets/ directory.");
}
if (readdirSync(distAssets).length === 0) {
  throw new Error("dist/assets/ directory is empty.");
}

writeFileSync(path.join(distDir, ".nojekyll"), "", "utf8");

const remoteUrl = getRemoteUrl();
const distGitDir = path.join(distDir, ".git");
rmSync(distGitDir, { recursive: true, force: true });

try {
  run("git", ["init", "-b", "gh-pages"], distDir);
  run("git", ["config", "user.name", "Goanarchy"], distDir);
  run("git", ["config", "user.email", "140470000+Goanarchy@users.noreply.github.com"], distDir);
  run("git", ["add", "-A"], distDir);
  run("git", ["commit", "-m", "chore(web): publish verified Watchdogs Media Civic Lab bundle"], distDir);
  run("git", ["push", "--force", remoteUrl, "HEAD:refs/heads/gh-pages"], distDir);
  console.log(`✓ Published verified web bundle to ${remoteUrl} (branch: gh-pages).`);
} finally {
  rmSync(distGitDir, { recursive: true, force: true });
}
