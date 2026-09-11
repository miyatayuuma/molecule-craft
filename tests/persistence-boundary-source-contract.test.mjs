import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const [resources,resourcesPersistence,collectionState,collectionMigrations,collectionPersistence,workspaceSave,workspaceMigrations,workspacePersistence]=await Promise.all([
  read('src/veil/resources.js'),
  read('src/veil/resources-persistence.js'),
  read('src/collection-state.js'),
  read('src/collection-migrations.js'),
  read('src/collection-persistence.js'),
  read('src/workspace-save.js'),
  read('src/workspace-migrations.js'),
  read('src/workspace-persistence.js'),
]);

assert.doesNotMatch(resources,/\bSCHEMA_VERSION\b|validatePersistedState|migrateResourcesSave|schemaVersion\s*(?:===|<=|>=|<|>)\s*[1-6]\b/,'Resources runtime must not regain persisted schema-version branches');
assert.match(resources,/loadPersistedResources/,'Resources runtime must load through the persistence boundary');
assert.match(resourcesPersistence,/\[1,2,3,4,5,6,7\]\.includes\(s\.schemaVersion\)/,'Historical resources schema knowledge stays in resources-persistence');
assert.match(resourcesPersistence,/function migrate\(old\)/,'Resources migration stays in resources-persistence');

assert.doesNotMatch(collectionState,/discoveredMoleculeIds|isFutureCollectionSave|migrateCollectionSave|saved\.schemaVersion/,'Collection runtime must not regain legacy save-shape/schema branches');
assert.match(collectionState,/createCollectionPersistence/,'Collection runtime must load/save through collection-persistence');
assert.match(collectionMigrations,/discoveredMoleculeIds/,'Legacy collection field mapping stays in collection-migrations');
assert.match(collectionPersistence,/migrateCollectionSave/,'Collection persistence owns migration ingress');

assert.doesNotMatch(workspaceSave,/SUPPORTED_PERSISTED_SCHEMAS|isFutureWorkspaceSave|migrateWorkspaceSave|schemaVersion\s*===\s*1\b/,'Workspace runtime must accept only the current canonical workspace');
assert.match(workspaceMigrations,/SUPPORTED_PERSISTED_SCHEMAS/,'Persisted workspace schema recognition stays in workspace-migrations');
assert.match(workspaceMigrations,/migrateWorkspaceSave/,'Workspace migration stays in workspace-migrations');
assert.match(workspacePersistence,/migrateWorkspaceSave/,'Workspace persistence owns migration ingress');

console.log('Persistence boundary source contracts passed.');
