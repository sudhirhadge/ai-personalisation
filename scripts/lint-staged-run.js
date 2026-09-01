#!/usr/bin/env node
/**
 * Runs eslint --fix and prettier --write for one package's staged files,
 * with that package's directory as cwd (so its local eslint.config.js /
 * dependencies are used, matching how you'd run them by hand).
 *
 * Exists because lint-staged executes returned command strings without a
 * shell on this setup — `cd pkgDir && npx eslint ...` fails since `cd` and
 * `&&` are shell constructs, not a real executable. Resolving each tool's
 * actual bin script and running it via `node` directly (rather than via
 * `npx`, a .cmd wrapper on Windows that needs shell:true — and shell:true
 * with an args array trips Node's DEP0190 unescaped-args warning) avoids
 * needing a shell at all.
 *
 * Usage: node scripts/lint-staged-run.js <pkgDir> <file1> [file2 ...]
 * File paths are relative to <pkgDir>.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const [pkgDir, ...files] = process.argv.slice(2);
if (!pkgDir || files.length === 0) {
    console.error('Usage: node lint-staged-run.js <pkgDir> <file...>');
    process.exit(1);
}

const cwd = path.resolve(__dirname, '..', pkgDir);

/** Resolve a package's CLI bin script path from pkgDir's own node_modules. */
function resolveBin(pkgName) {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [cwd] });
    const pkgJson = require(pkgJsonPath);
    const binField = typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin[pkgName];
    return path.join(path.dirname(pkgJsonPath), binField);
}

function run(pkgName, args) {
    const binPath = resolveBin(pkgName);
    const result = spawnSync(process.execPath, [binPath, ...args], { cwd, stdio: 'inherit' });
    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run('eslint', ['--fix', ...files]);
run('prettier', ['--write', ...files]);
