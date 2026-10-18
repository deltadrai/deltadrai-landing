import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode } from '../../src/js/lib/decode.js';
import { config } from '../../src/js/config.js';

test('decode reverses the code-point shift', () => {
  assert.equal(decode([...'abc'].map((c) => c.charCodeAt(0) + 23)), 'abc');
  assert.equal(decode([]), '');
});

test('the encoded contact parts decode to plausible values and are not plain text', () => {
  const { contact } = config;
  assert.match(decode(contact.company), /GmbH$/);
  assert.match(decode(contact.city), /^\d{4} /);
  assert.ok(/^[a-z]+$/.test(decode(contact.emailLocal)));
  assert.ok(!JSON.stringify(config).includes('@'), 'no plain e-mail address in config');
});
