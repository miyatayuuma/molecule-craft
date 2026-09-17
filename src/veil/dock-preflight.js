import {migrateDockStorage} from './dock-migration.js';

try{migrateDockStorage(globalThis.localStorage);}catch{}
