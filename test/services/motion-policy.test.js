import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotionPolicy } from '../../src/js/services/motion-policy.js';

test('reads reduced motion live and exposes matchMedia conditions', () => {
  let reduce = false;
  const motion = createMotionPolicy({
    matchMedia: (q) => ({ matches: q.includes('reduce') ? reduce : !reduce }),
  });
  assert.equal(motion.prefersReduced(), false);
  reduce = true;
  assert.equal(motion.prefersReduced(), true);
  assert.deepEqual(Object.keys(motion.conditions), ['reduced', 'full']);
});

test('saveData follows the connection hint and tolerates its absence', () => {
  const none = createMotionPolicy({ matchMedia: () => ({ matches: false }) });
  assert.equal(none.saveData(), false);
  const on = createMotionPolicy({ matchMedia: () => ({ matches: false }), connection: { saveData: true } });
  assert.equal(on.saveData(), true);
});
