import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

test('clear is reversible as one snapshot step',()=>{let s={atoms:2,stock:0};const h=createCraftHistory({capture:()=>({...s}),restore:x=>{s={...x};return true;}});h.record(()=>{s={atoms:0,stock:2};return true;});h.undo();assert.deepEqual(s,{atoms:2,stock:0});});
