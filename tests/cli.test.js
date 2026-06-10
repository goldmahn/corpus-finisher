import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCliArgs } from '../src/cli.js';

test('parseCliArgs parses folders and pad defaults', () => {
  const args = parseCliArgs(['./normalized', './training']);
  assert.equal(args.leadingPadMs, 75);
  assert.equal(args.trailingPadMs, 75);
  assert.equal(args.fadeMs, 3);
});

test('parseCliArgs supports pad and fade overrides', () => {
  const args = parseCliArgs(['./in', './out', '--pad', '80', '--fade', '0']);
  assert.equal(args.leadingPadMs, 80);
  assert.equal(args.trailingPadMs, 80);
  assert.equal(args.fadeMs, 0);
});
