import assert from 'node:assert/strict';
import { ELECTRON_POINTER_TARGET, distanceToSegment, pickElectronAtPointer } from '../src/electron-interaction.js';

const electron = (atomId, index, screenX, screenY, restScreenX = screenX, restScreenY = screenY, priority = 0) => ({ atomId, index, screenX, screenY, restScreenX, restScreenY, priority });

assert.equal(ELECTRON_POINTER_TARGET.coreRadiusPx, 36);
assert.equal(ELECTRON_POINTER_TARGET.assistRadiusPx, 52);
assert.equal(ELECTRON_POINTER_TARGET.touchLiftPx, 24);

{
  const picked = pickElectronAtPointer(100, 100, [electron(1, 0, 128, 100), electron(2, 0, 133, 100)]);
  assert.equal(picked?.atomId, 1, 'Core target must choose the nearest electron');
  assert.equal(picked?.assisted, false);
}

{
  const picked = pickElectronAtPointer(100, 100, [electron(3, 0, 147, 100), electron(4, 0, 170, 100)]);
  assert.equal(picked?.atomId, 3, 'A unique electron in the assist radius must be acquired');
  assert.equal(picked?.assisted, true);
}

{
  const picked = pickElectronAtPointer(100, 100, [electron(5, 0, 145, 100), electron(6, 0, 148, 100)]);
  assert.equal(picked, null, 'Ambiguous electrons in the assist radius must not steal the atom gesture');
}

{
  const picked = pickElectronAtPointer(100, 100, [electron(7, 0, 80, 80, 120, 120)]);
  assert.equal(picked?.atomId, 7, 'The full idle-drift segment must remain touchable');
  assert.equal(distanceToSegment(100, 100, 80, 80, 120, 120), 0);
}

{
  const picked = pickElectronAtPointer(100, 100, [electron(8, 0, 120, 100, 120, 100, 0), electron(9, 0, 120, 100, 120, 100, 1)]);
  assert.equal(picked?.atomId, 9, 'The selected atom must win an exact projected tie');
}

console.log('Electron interaction tests passed.');
