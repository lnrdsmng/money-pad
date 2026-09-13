import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReferralInput } from '../src/utils/referral.ts';

test('parseReferralInput correctly handles various formats', () => {
  // Plain usernames
  assert.equal(parseReferralInput('alice'), 'alice');
  assert.equal(parseReferralInput('  bob_writer  '), 'bob_writer');

  // Full URLs with ?ref=
  assert.equal(parseReferralInput('http://localhost:5173/register?ref=charlie'), 'charlie');
  assert.equal(parseReferralInput('https://moneypad.app/register?ref=diana'), 'diana');

  // URL with trailing slash or fragments
  assert.equal(parseReferralInput('https://moneypad.app/register?ref=eric/'), 'eric');
  assert.equal(parseReferralInput('https://moneypad.app/register?ref=fiona#hero'), 'fiona');

  // URL with multiple query params
  assert.equal(parseReferralInput('https://moneypad.app/register?utm_source=twitter&ref=george&plan=free'), 'george');

  // URL without protocol
  assert.equal(parseReferralInput('moneypad.app/register?ref=helen'), 'helen');

  // Encoded characters
  assert.equal(parseReferralInput('https://moneypad.app/register?ref=ian%5Fwriter'), 'ian_writer');

  // Empty or invalid input
  assert.equal(parseReferralInput(''), '');
  assert.equal(parseReferralInput('   '), '');
});
