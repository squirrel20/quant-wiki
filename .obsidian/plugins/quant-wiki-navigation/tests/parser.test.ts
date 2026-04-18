import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../parser.ts';

test('empty input returns empty array', () => {
  assert.deepEqual(parse(''), []);
});

test('single chapter with one leaf', () => {
  const md = [
    '## 简介',
    '',
    '- [关于项目](index.md)',
  ].join('\n');
  assert.deepEqual(parse(md), [
    {
      title: '简介',
      children: [
        { title: '关于项目', href: 'index.md', external: false, children: [] },
      ],
    },
  ]);
});

test('multiple chapters keep order', () => {
  const md = [
    '## A',
    '- [a1](a1.md)',
    '## B',
    '- [b1](b1.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'A');
  assert.equal(out[1].title, 'B');
});
