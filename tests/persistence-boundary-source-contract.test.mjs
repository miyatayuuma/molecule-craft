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

assert.doesNotMatch(resources,/\bSCHEMA_VERSION\b|validatePersistedState|migrateResourcesSave|schemaVersion\s*(?:===|<=|>=|<|>)\s*[1-8]\b/,'Resources runtime must not regain persisted schema-version branches');
assert.match(resources,/loadPersistedResources/,'Resources runtime must load through the persistence boundary');
assert.match(resourcesPersistence,/schemaVersion!==SCHEMA_VERSION/,'Resource persistence owns the hard incompatibility reset boundary');
assert.match(resourcesPersistence,/createInitialResourcesState\(\)/,'Incompatible resources reset to the canonical initial state');
assert.doesNotMatch(resourcesPersistence,/function migrate\(old\)/,'Molecule DB v2 must not retain a legacy resource migration registry');

assert.doesNotMatch(collectionState,/discoveredMoleculeIds|isFutureCollectionSave|migrateCollectionSave|saved\.schemaVersion/,'Collection runtime must not regain legacy save-shape/schema branches');
assert.match(collectionState,/createCollectionPersistence/,'Collection runtime must load/save through collection-persistence');
assert.match(collectionMigrations,/saved\.schemaVersion!==CURRENT_COLLECTION_SCHEMA_VERSION/,'Collection migration boundary rejects incompatible schemas instead of translating discoveries');
assert.doesNotMatch(collectionMigrations,/discoveredMoleculeIds/,'Molecule DB v2 must not retain legacy collection field mappings');
assert.match(collectionPersistence,/migrateCollectionSave/,'Collection persistence owns canonical ingress/reset detection');

assert.doesNotMatch(workspaceSave,/SUPPORTED_PERSISTED_SCHEMAS|isFutureWorkspaceSave|migrateWorkspaceSave|schemaVersion\s*===\s*1\b/,'Workspace runtime must accept only the current canonical workspace');
assert.match(workspaceMigrations,/SUPPORTED_PERSISTED_SCHEMAS/,'Persisted workspace schema recognition stays in workspace-migrations');
assert.match(workspaceMigrations,/migrateWorkspaceSave/,'Workspace migration stays in workspace-migrations');
assert.match(workspacePersistence,/migrateWorkspaceSave/,'Workspace persistence owns migration ingress');

console.log('Persistence boundary source contracts passed.');
