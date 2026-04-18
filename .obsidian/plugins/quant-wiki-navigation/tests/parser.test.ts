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
      external: false,
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

test('bold group with nested leaves', () => {
  const md = [
    '## 入门教程',
    '- **必懂概念入门**',
    '    - [夏普比率](start/sharpe.md)',
    '    - [波动率](start/volatility.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 1);
  const group = out[0].children[0];
  assert.equal(group.title, '必懂概念入门');
  assert.equal(group.href, undefined);
  assert.equal(group.children.length, 2);
  assert.equal(group.children[0].title, '夏普比率');
  assert.equal(group.children[0].href, 'start/sharpe.md');
});

test('leaves at chapter level and under group are separated', () => {
  const md = [
    '## X',
    '- [direct](d.md)',
    '- **group**',
    '    - [inside](i.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 2);
  assert.equal(out[0].children[0].title, 'direct');
  assert.equal(out[0].children[1].title, 'group');
  assert.equal(out[0].children[1].children[0].title, 'inside');
});

test('multi-link line split by ·', () => {
  const md = [
    '## X',
    '- [a](a.md) · [b](b.md) · [c](c.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 3);
  assert.deepEqual(out[0].children.map(c => c.title), ['a', 'b', 'c']);
});

test('multi-link line with prefix text splits links only', () => {
  const md = [
    '## X',
    '- 多因子系列：[中信](advanced/a/index.md) · [华泰](advanced/b/index.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 2);
  assert.equal(out[0].children[0].title, '中信');
  assert.equal(out[0].children[1].title, '华泰');
});

test('external https link flagged', () => {
  const md = [
    '## X',
    '- [site](https://example.com)',
  ].join('\n');
  assert.equal(parse(md)[0].children[0].external, true);
});

test('anchor preserved in href', () => {
  const md = [
    '## X',
    '- [sec](repo/quant_learn.md#backtesting-and-live-trading)',
  ].join('\n');
  assert.equal(
    parse(md)[0].children[0].href,
    'repo/quant_learn.md#backtesting-and-live-trading'
  );
});

test('plain bullet without link is skipped', () => {
  const md = [
    '## X',
    '- 人工智能：AI 与机器学习、前沿技术应用',
    '- [real](r.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 1);
  assert.equal(out[0].children[0].title, 'real');
});
