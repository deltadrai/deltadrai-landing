import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSiteNavViewModel } from '../../src/js/viewmodels/site-nav.js';

test('marks the current page and follows location changes', () => {
  let path = '/impressum/';
  const vm = createSiteNavViewModel({ currentPath: () => path });
  assert.equal(vm.current('/impressum/'), 'page');
  assert.equal(vm.current('/datenschutz/'), null);
  path = '/datenschutz/';
  vm.refresh();
  assert.equal(vm.current('/impressum/'), null);
  assert.equal(vm.current('/datenschutz/'), 'page');
});
