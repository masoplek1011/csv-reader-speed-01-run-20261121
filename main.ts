// Driver for this entry: the program the harness runs as `node /bot/main.ts`
// (Node 22). It loads every case from the input directory, answers each one
// with run() from solve.js, and writes the answers in order to the output
// directory. Outside a container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output; the program writes nowhere else.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Switch V8's incremental marking off before solve.js is loaded, so all of
// the parsing work runs under that setting.
setFlagsFromString('--no-incremental-marking');

// solve.js is a plain .js module, so it is loaded by URL and typed here by
// the contract it keeps: run(input) answers one case's input.
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const raw = readFileSync(join(inputDir, 'cases.json'), 'utf8');
const cases = JSON.parse(raw) as { id: string; input: unknown }[];

const answers: unknown[] = [];
for (let i = 0; i < cases.length; i += 1) {
  answers.push(run(cases[i].input));
}

writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
