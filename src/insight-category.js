import {ACTIVE_TANK_ROLES,primaryRoleFor} from './veil/molecule-roles.js';
import {OXYGEN_UPGRADES} from './veil/tank-upgrades.js';

export const INSIGHT_CATEGORIES=Object.freeze(['propellant','fuel','oxidizer','coolant','utility','general']);
export const INSIGHT_CATEGORY_LABELS=Object.freeze({
  propellant:'PULSE',
  fuel:'FUEL',
  oxidizer:'OXIDIZER',
  coolant:'COOLANT',
  utility:'UTILITY',
  general:'GENERAL',
});

// Presentation-only overrides live here so a future molecule that is both a
// tank material and a special system requirement can choose one visual primary
// use explicitly without changing its gameplay roles.
export const INSIGHT_PRIMARY_USE_OVERRIDES=Object.freeze({});

const UTILITY_INSIGHT_IDS=new Set(OXYGEN_UPGRADES.flatMap(upgrade=>Array.isArray(upgrade.requires)?upgrade.requires:[]));
const VALID_CATEGORIES=new Set(INSIGHT_CATEGORIES);

export const utilityInsightIds=()=>Object.freeze([...UTILITY_INSIGHT_IDS]);
export function insightCategoryFor(id){
  const override=INSIGHT_PRIMARY_USE_OVERRIDES[id];
  if(override&&VALID_CATEGORIES.has(override))return override;
  const primary=primaryRoleFor(id);
  if(primary&&ACTIVE_TANK_ROLES.includes(primary))return primary;
  if(UTILITY_INSIGHT_IDS.has(id))return 'utility';
  return 'general';
}
export const insightCategoryLabel=category=>INSIGHT_CATEGORY_LABELS[category]??INSIGHT_CATEGORY_LABELS.general;
