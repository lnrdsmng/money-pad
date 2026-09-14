import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactCount } from '../src/utils/formatCompactCount.ts';

test('formatCompactCount formats paragraph comment counts', () => {
  assert.equal(formatCompactCount(999), '999');
  assert.equal(formatCompactCount(1_000), '1K');
  assert.equal(formatCompactCount(1_500), '1.5K');
  assert.equal(formatCompactCount(300_000), '300K');
  assert.equal(formatCompactCount(1_000_000), '1M');
});
