#!/usr/bin/env node
/**
 * Size lint: files under 1000 lines, functions under 50.
 *
 * The function measure counts a function's *own* lines - its total span minus
 * the spans of the functions nested inside it. That is the number the limit is
 * actually about: how much code a reader must hold at once. Counting nested
 * bodies against the parent would flag every factory and every module IIFE,
 * which are exactly the patterns that keep the code small.
 *
 * It exits non-zero so the limit is enforced rather than reported.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE_LIMIT = 1000;
const FUNCTION_LIMIT = 50;
const DIRS = ['src/js', 'tests'];

const FUNCTION_START = /(^|\s)(function\b|[\w$]+\s*\([^)]*\)\s*\{|=>\s*\{)/;

function walk(dir, out) {
  const results = out || [];
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return results;

  fs.readdirSync(full, { withFileTypes: true }).forEach(function (entry) {
    const relative = dir + '/' + entry.name;
    if (entry.isDirectory()) walk(relative, results);
    else if (entry.name.endsWith('.js')) results.push(relative);
  });
  return results;
}

function countDelta(line) {
  const stripped = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"/g, '');
  const opens = (stripped.match(/\{/g) || []).length;
  const closes = (stripped.match(/\}/g) || []).length;
  return opens - closes;
}

function closeFrame(frame, endLine, stack, offenders) {
  const span = endLine - frame.line + 1;
  const own = span - frame.childLines;
  if (stack.length) stack[stack.length - 1].childLines += span;
  if (own > FUNCTION_LIMIT) {
    offenders.push({ line: frame.line, length: own, span: span, name: frame.name });
  }
}

function longFunctions(source) {
  const lines = source.split('\n');
  const offenders = [];
  const stack = [];
  let depth = 0;

  lines.forEach(function (line, index) {
    const isStart = FUNCTION_START.test(line) && line.indexOf('{') !== -1;
    if (isStart) {
      stack.push({ line: index + 1, depth: depth, childLines: 0, name: line.trim().slice(0, 60) });
    }

    depth += countDelta(line);

    while (stack.length && depth <= stack[stack.length - 1].depth) {
      closeFrame(stack.pop(), index + 1, stack, offenders);
    }
  });

  return offenders;
}

function run() {
  const files = DIRS.reduce(function (acc, dir) { return walk(dir, acc); }, []);
  const problems = [];

  files.forEach(function (file) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const lineCount = source.split('\n').length;

    if (lineCount > FILE_LIMIT) {
      problems.push(file + ': ' + lineCount + ' lines (limit ' + FILE_LIMIT + ')');
    }

    longFunctions(source).forEach(function (offender) {
      problems.push(file + ':' + offender.line + ': ' + offender.length + ' own lines of ' +
        offender.span + ' (limit ' + FUNCTION_LIMIT + ') — ' + offender.name);
    });
  });

  if (problems.length) {
    console.error('SIZE LINT FAILED');
    problems.forEach(function (line) { console.error('  ✗ ' + line); });
    process.exit(1);
  }

  console.log('size lint passed — ' + files.length + ' files, none over ' + FILE_LIMIT +
    ' lines, no function over ' + FUNCTION_LIMIT);
}

run();
