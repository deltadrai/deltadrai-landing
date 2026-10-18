import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContactViewModel } from '../../src/js/viewmodels/contact.js';

test('decodes every part once and joins the e-mail', () => {
  const calls = [];
  const decode = (codes) => {
    calls.push(codes);
    return codes.join('-');
  };
  const vm = createContactViewModel({
    contact: { company: [1], street: [2], city: [3], country: [4], emailLocal: [5], emailDomain: [6] },
    decode,
  });
  assert.deepEqual([vm.company, vm.street, vm.city, vm.country, vm.email], ['1', '2', '3', '4', '5@6']);
  assert.equal(calls.length, 6);
});
