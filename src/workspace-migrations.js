import { WORKSPACE_SCHEMA,validateWorkspace } from './workspace-save.js?v=31';

const SUPPORTED_PERSISTED_SCHEMAS=new Set([1,WORKSPACE_SCHEMA]);

export function isFutureWorkspaceSave(value){
  return !!value&&typeof value==='object'&&Number(value.schemaVersion)>WORKSPACE_SCHEMA;
}

function schemaFor(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!SUPPORTED_PERSISTED_SCHEMAS.has(value.schemaVersion))throw new Error('Unsupported workspace');
  return value.schemaVersion;
}

function canonicalCandidate(value){
  return {...value,schemaVersion:WORKSPACE_SCHEMA,targetMoleculeId:value.targetMoleculeId??null};
}

// Validation of persisted v1/v2 belongs here rather than in the runtime module.
// v1 had no targetMoleculeId contract; absence keeps the historical null meaning.
export function validatePersistedWorkspace(value){
  schemaFor(value);
  validateWorkspace(canonicalCandidate(value));
  return value;
}

export function migrateWorkspaceSave(value){
  validatePersistedWorkspace(value);
  return validateWorkspace(canonicalCandidate(value));
}
