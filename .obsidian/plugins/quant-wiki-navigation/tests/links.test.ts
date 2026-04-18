import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toObsidianLinkText } from '../links.ts';

test('plain .md path', () => {
  assert.equal(toObsidianLinkText('index.md'), 'docs/index');
});

test('nested .md path', () => {
  assert.equal(toObsidianLinkText('basic/finance/index.md'), 'docs/basic/finance/index');
});

test('path with anchor', () => {
  assert.equal(
    toObsidianLinkText('repo/quant_learn.md#backtesting-and-live-trading'),
    'docs/repo/quant_learn#backtesting-and-live-trading'
  );
});

test('path without .md extension', () => {
  assert.equal(toObsidianLinkText('repo/quant_learn'), 'docs/repo/quant_learn');
});
