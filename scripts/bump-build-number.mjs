#!/usr/bin/env node
// Bump the shared version/build number across teacher/student/root.
//
//   npm run bump:build              → increment build number by 1 (keeps VERSION)
//   npm run bump:build -- 42        → set build number to 42 (keeps VERSION)
//   npm run bump:build -- 2.2.1.0   → set full version: VERSION=2.2.1, BUILD_NUMBER=0
//   npm run bump:build -- 3.1.0     → set VERSION=3.1.0, BUILD_NUMBER=0
//
// Updated targets (only when present):
//   teacher/.env.production, teacher/.env   → VERSION / BUILD_NUMBER
//   student/.env.production, student/.env   → VERSION / BUILD_NUMBER
//   teacher/package.json, student/package.json, ./package.json → version/buildNumber/buildVersion

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readFile = (rel) => {
    const abs = path.join(ROOT, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
};

const writeFile = (rel, content) => {
    fs.writeFileSync(path.join(ROOT, rel), content);
};

const readEnvNumber = (rel) => {
    const content = readFile(rel);
    if (content == null) return null;
    const match = content.match(/^BUILD_NUMBER\s*=\s*"?(\d+)"?$/m);
    return match ? parseInt(match[1], 10) : null;
};

const readPkgNumber = (rel) => {
    const content = readFile(rel);
    if (content == null) return null;
    try {
        const pkg = JSON.parse(content);
        return pkg.buildNumber != null ? parseInt(String(pkg.buildNumber), 10) : null;
    } catch {
        return null;
    }
};

const sources = [
    { file: 'teacher/.env.production', value: readEnvNumber('teacher/.env.production') },
    { file: 'teacher/.env', value: readEnvNumber('teacher/.env') },
    { file: 'teacher/package.json', value: readPkgNumber('teacher/package.json') },
    { file: 'student/.env.production', value: readEnvNumber('student/.env.production') },
    { file: 'student/.env', value: readEnvNumber('student/.env') },
    { file: 'student/package.json', value: readPkgNumber('student/package.json') }
];

const currentMax = sources.reduce((max, source) => (source.value != null ? Math.max(max, source.value) : max), 0);

// Parse CLI: dotted full version (3 or 4 parts) or integer build number.
let nextBuild = null;
let nextVersion = null;
const arg = process.argv[2];
if (arg != null) {
    if (/^\d+\.\d+\.\d+(\.\d+)?$/.test(arg)) {
        const parts = arg.split('.').map(Number);
        nextVersion = parts.slice(0, 3).join('.');
        nextBuild = parts.length === 4 ? parts[3] : 0;
    } else {
        const parsed = parseInt(arg, 10);
        if (!Number.isInteger(parsed) || parsed < 0) {
            console.error(`❌ invalid build number: ${arg}`);
            process.exit(1);
        }
        nextBuild = parsed;
    }
} else {
    nextBuild = currentMax + 1;
}

if (nextVersion) {
    console.log(`📦 Version: → ${nextVersion}.${nextBuild}`);
} else {
    console.log(`🔢 Build number: current=${currentMax} → next=${nextBuild}`);
}

const bumpEnv = (rel) => {
    const content = readFile(rel);
    if (content == null) return 'skipped (missing)';
    if (nextVersion != null && !/^VERSION\s*=/m.test(content)) return 'skipped (no VERSION)';
    if (!/^BUILD_NUMBER\s*=/m.test(content)) return 'skipped (no BUILD_NUMBER)';
    let updated = content;
    if (nextVersion != null) {
        updated = updated.replace(/^(VERSION\s*=\s*)("?)\d+\.\d+\.\d+("?)$/m, `$1$2${nextVersion}$3`);
    }
    updated = updated.replace(/^(BUILD_NUMBER\s*=\s*)("?)\d+("?)$/m, `$1$2${nextBuild}$3`);
    if (updated === content) return 'skipped (already at target)';
    writeFile(rel, updated);
    return 'updated';
};

const bumpPkg = (rel) => {
    const content = readFile(rel);
    if (content == null) return 'skipped (missing)';
    let pkg;
    try {
        pkg = JSON.parse(content);
    } catch (error) {
        return `skipped (invalid JSON: ${error.message})`;
    }
    let changed = false;
    const version = nextVersion ?? pkg.version;
    if (nextVersion != null && pkg.version !== nextVersion) {
        pkg.version = nextVersion;
        changed = true;
    }
    if (String(pkg.buildNumber ?? '') !== String(nextBuild)) {
        pkg.buildNumber = String(nextBuild);
        changed = true;
    }
    if (version) {
        const buildVersion = `${version}.${nextBuild}`;
        if (pkg.buildVersion !== buildVersion) {
            pkg.buildVersion = buildVersion;
            changed = true;
        }
    }
    if (!changed) return 'skipped (already at target)';
    writeFile(rel, JSON.stringify(pkg, null, 2) + '\n');
    return 'updated';
};

for (const source of sources) {
    let status;
    if (source.file.endsWith('.env') || source.file.endsWith('.env.production')) {
        status = bumpEnv(source.file);
    } else {
        status = bumpPkg(source.file);
    }
    console.log(`  ${source.file.padEnd(30)} ${status}`);
}
