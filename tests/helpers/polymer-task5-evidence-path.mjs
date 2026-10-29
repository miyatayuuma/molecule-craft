// Relocate retained host paths without changing their recorded content hashes.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export function frozenSourcePath(value){
  let relative=value;
  if(path.isAbsolute(relative)){
    const marker='/molecule-craft/',index=relative.lastIndexOf(marker);
    assert.ok(index>=0,'unrecognized frozen repository path');
    relative=relative.slice(index+marker.length);
  }
  assert.ok(relative&&!path.isAbsolute(relative)&&!relative.split('/').includes('..'),'invalid frozen relative path');
  return path.join(repository,relative);
}
