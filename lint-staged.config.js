/**
 * lint-staged runs from the repo root, but eslint/prettier for client/ and
 * server/ are installed per-package (different plugins/configs). Each glob
 * hands off to scripts/lint-staged-run.js, which runs eslint --fix and
 * prettier --write with that package's directory as cwd — see that file's
 * header comment for why a plain `cd pkgDir && npx eslint ...` string
 * doesn't work here (lint-staged executes commands without a shell).
 */
const path = require('path');

function forPackage(pkgDir) {
    return (absoluteFiles) => {
        // path.relative returns backslash-separated paths on Windows;
        // normalize to forward slashes for eslint/prettier's file args.
        const relativeFiles = absoluteFiles.map((f) =>
            path.relative(path.join(__dirname, pkgDir), f).split(path.sep).join('/')
        );
        const quoted = relativeFiles.map((f) => `"${f}"`).join(' ');
        return [`node scripts/lint-staged-run.js ${pkgDir} ${quoted}`];
    };
}

module.exports = {
    'client/**/*.{js,jsx,ts,tsx}': forPackage('client'),
    'server/**/*.js': forPackage('server'),
};
