/**
 * Fails if React Compiler silently skips a component.
 *
 * `reactCompiler: true` in app.json is not a guarantee: a `try/finally`, an
 * `eslint-disable` of a react-hooks rule, or a shared value written while it is
 * named in a dependency array all make the compiler skip the *whole* file, with
 * no build error and no warning. GameScreen and MenuSheet were both being
 * skipped this way, so every child re-rendered on every render of the screen.
 *
 * Run with `bun run check:compiler`.
 */
import * as babel from '@babel/core';
import fs from 'node:fs';
import path from 'node:path';

/** Files allowed to opt out, with the reason they do. */
const ALLOWED_SKIPS = new Map([
  [
    'src/game/useMeterTap.ts',
    'declares "use no memo": a gesture worklet reading shared values is ' +
      'indistinguishable from a ref read during render. Memoized by hand.',
  ],
]);

const ROOT = process.cwd();

function sourceFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : sourceFiles(full);
      }
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
}

const events = [];
const logger = {
  logEvent: (filename, event) => events.push({ filename, event }),
};

for (const file of sourceFiles(path.join(ROOT, 'src'))) {
  babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [['babel-plugin-react-compiler', { logger, panicThreshold: 'none' }]],
  });
}

const problems = [];
for (const { filename, event } of events) {
  if (event.kind === 'CompileSuccess') continue;
  const rel = path.relative(ROOT, filename ?? '');
  if (event.kind === 'CompileSkip' && ALLOWED_SKIPS.has(rel)) continue;
  const detail = event.detail ?? {};
  problems.push({
    file: rel,
    kind: event.kind,
    reason: detail.reason ?? detail.description ?? event.kind,
  });
}

if (problems.length === 0) {
  const opted = [...ALLOWED_SKIPS.keys()].join(', ');
  console.log(
    `React Compiler: every component compiles${opted ? ` (opted out: ${opted})` : ''}.`,
  );
  process.exit(0);
}

console.error('React Compiler is skipping optimization:\n');
for (const p of problems) {
  console.error(`  ${p.file}\n    ${p.kind}: ${p.reason}\n`);
}
console.error(
  'A skipped component re-renders its children on every render. Fix the cause,\n' +
    'or add the file to ALLOWED_SKIPS in this script with a reason.',
);
process.exit(1);
