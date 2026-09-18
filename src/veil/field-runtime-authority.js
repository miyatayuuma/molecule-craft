const freeze=value=>Object.freeze(value);

export const FIELD_RUNTIME_ALLOWLIST_VERSION=1;
export const FIELD_RUNTIME_ALLOWLIST=Object.freeze({
  environmentGeometry:freeze({
    id:'environment-geometry',
    examples:Object.freeze(['route geometry','open-field geometry','environmental background','Deep Nitrogen geometry','Core approach geometry','authored landmarks']),
  }),
  managedResources:freeze({
    id:'managed-resources',
    elements:Object.freeze(['H','C','N','O']),
  }),
  environmentalHazards:freeze({
    id:'environmental-hazards',
    types:Object.freeze(['mechanical','thermal','abrasive','electrical']),
  }),
  activeAgents:freeze({
    id:'active-agents',
    examples:Object.freeze(['Dust Eater']),
  }),
  currentProgressionObjects:freeze({
    id:'current-progression-objects',
    examples:Object.freeze(['Normal Insight','Critical Insight','Core','current chapter progression marker']),
  }),
  navigationRecoveryInfrastructure:freeze({
    id:'navigation-recovery-infrastructure',
    examples:Object.freeze(['ANCHOR RETURN','recovery point','checkpoint','launch / return lifecycle']),
  }),
});

export const RETIRED_FIELD_RUNTIME=Object.freeze(['finite-rare-survey']);
