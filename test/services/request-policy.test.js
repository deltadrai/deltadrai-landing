import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestPolicy } from '../../src/js/services/request-policy.js';

const policy = createRequestPolicy({
  ownOrigin: 'https://deltadr.ai',
  allowedOrigins: ['https://formspree.io'],
});

for (const [url, expected] of [
  ['https://deltadr.ai/impressum/', true],
  ['https://formspree.io/f/abc', true],
  ['https://formspree.io.evil.test/f/abc', false],
  ['https://evilformspree.io/f/abc', false],
  ['http://formspree.io/f/abc', false],
  ['https://formspree.io:8443/f/abc', false],
  ['https://deltadr.ai.evil.test/', false],
  ['https://example.com/', false],
  ['https://formspree.io@evil.test/', false],
]) {
  test(`${url} → ${expected ? 'allowed' : 'rejected'}`, () => {
    assert.equal(policy.allows(new URL(url)), expected);
  });
}
