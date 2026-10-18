import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFormspreeAdapter } from '../../src/js/adapters/formspree.js';

const adapter = createFormspreeAdapter();

test('matches only the exact Formspree origin', () => {
  assert.equal(adapter.matches(new URL('https://formspree.io/f/x')), true);
  assert.equal(adapter.matches(new URL('https://formspree.io.evil.test/f/x')), false);
  assert.equal(adapter.matches(new URL('https://example.com/')), false);
});

test('only sends CORS-safelisted headers', () => {
  assert.deepEqual(adapter.headers, { Accept: 'application/json' });
});

const table = [
  ['200 with JSON', 200, '{"ok":true,"next":"/thanks"}', { ok: true, errors: [] }],
  ['200 with empty body', 200, '', { ok: true, errors: [] }],
  ['201 with non-JSON body', 201, '<html>', { ok: true, errors: [] }],
  [
    '422 with field errors',
    422,
    '{"error":"Validation","errors":[{"field":"email","code":"TYPE_EMAIL","message":"should be an email"},{"message":"general"}]}',
    { ok: false, errors: [{ field: 'email', message: 'should be an email' }, { message: 'general' }] },
  ],
  ['404 with plain error string', 404, '{"error":"Form not found"}', { ok: false, errors: [{ message: 'Form not found' }] }],
  ['400 without a body', 400, '', { ok: false, errors: [] }],
  ['500 with non-JSON body', 500, '<html>oops</html>', { ok: false, errors: [] }],
  ['422 with JSON that is not an object', 422, '"nope"', { ok: false, errors: [] }],
  ['422 with malformed errors entries', 422, '{"errors":[null,{"message":5},{"message":"ok"}]}', { ok: false, errors: [{ message: 'ok' }] }],
  ['422 with empty errors array', 422, '{"errors":[]}', { ok: false, errors: [] }],
];
for (const [name, status, body, expected] of table) {
  test(`parse: ${name}`, () => assert.deepEqual(adapter.parse(status, body), expected));
}
