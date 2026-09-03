#!/usr/bin/env node
/**
 * Prose lint for the Description tab.
 *
 * The Description tab is what a learner lands on, and it was written the way a
 * specification is written: long sentences, several clauses deep, packed into
 * one unbroken block per concept. That is dense rather than wrong, and dense
 * is the thing being fixed - so it has to be measurable, section by section,
 * across a curriculum too large to re-read.
 *
 * Four numbers, all of them about how much a reader must hold at once:
 *
 *   mean    average sentence length, in words
 *   max     the longest single sentence
 *   long%   share of sentences over LONG_SENTENCE words
 *   1-block concepts whose explanation is a single paragraph
 *
 * The last one is structural rather than stylistic. `detail` may be an array,
 * and the renderer prints one <p> per entry, so a three-part explanation can
 * arrive as three paragraphs. Writing it as one string is what produces the
 * wall of text, whatever the sentences inside it look like.
 *
 * Usage:
 *   node tools/readability.js                 whole-curriculum report
 *   node tools/readability.js <section-id>    that section's long sentences
 *   node tools/readability.js --strict        exit non-zero on any section
 *                                             over budget
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'js', 'content');
const SECTION_DIR = path.join(ROOT, 'src', 'js', 'sections');

const LONG_SENTENCE = 30;
const BUDGET = { mean: 20, max: 36, longPct: 12, singleBlock: 0 };

const scan = require('./prose-scan.js');

function loadRegistries() {
  fs.readdirSync(CONTENT_DIR)
    .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
    .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });
  return require(path.join(CONTENT_DIR, 'registries.js'));
}

/** Everything the Description tab prints as prose, for one section. */
function proseOf(sectionId, registries) {
  const parts = scan.configProse(path.join(SECTION_DIR, sectionId + '-section.js'));

  (registries.ConceptRegistry.get(sectionId) || []).forEach(function (concept) {
    parts.push(concept.plain, concept.readAs, concept.example);
    if (concept.diagram) parts.push(concept.diagram.caption);
    scan.paragraphsOf(concept.detail).forEach(function (text) { parts.push(text); });
  });
  return parts.filter(Boolean);
}

function singleBlockCount(sectionId, registries) {
  return (registries.ConceptRegistry.get(sectionId) || []).filter(function (concept) {
    return scan.paragraphsOf(concept.detail).length < 2;
  }).length;
}

function score(sectionId, registries) {
  const lengths = proseOf(sectionId, registries)
    .flatMap(scan.sentences).map(scan.wordCount);

  if (!lengths.length) return null;
  const long = lengths.filter(function (n) { return n > LONG_SENTENCE; }).length;
  return {
    id: sectionId,
    sentences: lengths.length,
    mean: lengths.reduce(function (a, b) { return a + b; }, 0) / lengths.length,
    max: Math.max.apply(null, lengths),
    longPct: (100 * long) / lengths.length,
    singleBlock: singleBlockCount(sectionId, registries)
  };
}

function overBudget(row) {
  return row.mean > BUDGET.mean || row.max > BUDGET.max ||
    row.longPct > BUDGET.longPct || row.singleBlock > BUDGET.singleBlock;
}

function formatRow(row) {
  return '  ' + row.id.padEnd(34) +
    ' mean ' + row.mean.toFixed(1).padStart(5) +
    '  max ' + String(row.max).padStart(3) +
    '  long ' + (row.longPct.toFixed(0) + '%').padStart(4) +
    '  1-block ' + String(row.singleBlock).padStart(2) +
    (overBudget(row) ? '' : '   ok');
}

function reportSection(sectionId, registries) {
  const row = score(sectionId, registries);

  if (!row) throw new Error('no prose found for ' + sectionId);
  process.stdout.write('===== ' + sectionId + ' =====\n' + formatRow(row) + '\n\n');
  proseOf(sectionId, registries).flatMap(scan.sentences)
    .filter(function (s) { return scan.wordCount(s) > LONG_SENTENCE; })
    .forEach(function (s) {
      process.stdout.write('  [' + scan.wordCount(s) + 'w] ' + s + '\n\n');
    });
}

function totals(rows) {
  const sentences = rows.reduce(function (a, r) { return a + r.sentences; }, 0);
  const weighted = rows.reduce(function (a, r) { return a + r.mean * r.sentences; }, 0);
  const long = rows.reduce(function (a, r) { return a + (r.longPct / 100) * r.sentences; }, 0);
  return {
    sections: rows.length,
    passing: rows.filter(function (r) { return !overBudget(r); }).length,
    mean: weighted / sentences,
    longPct: (100 * long) / sentences,
    singleBlock: rows.reduce(function (a, r) { return a + r.singleBlock; }, 0)
  };
}

function reportAll(rows, strict) {
  const sorted = rows.slice().sort(function (a, b) { return b.longPct - a.longPct; });
  const failing = sorted.filter(overBudget);
  const sum = totals(rows);

  process.stdout.write('Description prose — ' + sum.passing + ' of ' + sum.sections +
    ' sections within budget\n');
  process.stdout.write('  mean sentence ' + sum.mean.toFixed(1) + ' words (budget ' +
    BUDGET.mean + ')   over ' + LONG_SENTENCE + ' words ' + sum.longPct.toFixed(1) +
    '% (budget ' + BUDGET.longPct + '%)   single-block explanations ' + sum.singleBlock + '\n\n');
  process.stdout.write(strict ? 'over budget:\n' : 'densest 25:\n');
  (strict ? failing : sorted.slice(0, 25)).forEach(function (row) {
    process.stdout.write(formatRow(row) + '\n');
  });
  return failing.length;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.indexOf('--strict') >= 0;
  const target = args.filter(function (a) { return a.indexOf('--') !== 0; })[0];
  const registries = loadRegistries();
  const Curriculum = require(path.join(ROOT, 'src', 'js', 'core', 'curriculum.js'));

  if (target) { reportSection(target, registries); return; }
  const rows = Curriculum.teachingSections()
    .map(function (section) { return score(section.id, registries); })
    .filter(Boolean);
  const failing = reportAll(rows, strict);

  if (strict && failing) process.exitCode = 1;
}

main();
