# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/masoplek1011/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/masoplek1011/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free drop-in for csv-reader 1.0.0: it returns exactly
csv-reader's `{columns, rows, errors}` for every `{text, header}` input,
including its broken-row policy (BOM, stray CR, unterminated quotes,
quote junk, short/long rows), but parses with a single-pass state machine
built on `indexOf` jumps and whole-segment `slice` copies instead of
walking the text one character at a time.

## Run it

```sh
node main.ts
```

The driver reads cases from `/input/cases.json` (or `MAKEFUN_INPUT_DIR`
outside a container) and writes the answers to `/output/answers.json`
(or `MAKEFUN_OUTPUT_DIR`). No dependencies, no build step, no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
