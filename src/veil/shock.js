import {performanceFor} from './molecule-roles.js';

export const SHOCK_MATERIAL_IDS=Object.freeze(['nitromethane','2-4-6-trinitrotoluene']);
export const SHOCK_BASE_IMPULSE=Object.freeze({radius:260,knockback:270,interruptSeconds:.75});

export function shockProfileFor(id){
  const performance=performanceFor(id,'shock');if(!performance)return null;
  return Object.freeze({
    material:id,capacity:performance.capacity,
    radiusScale:performance.radiusScale,knockbackScale:performance.knockbackScale,interruptScale:performance.interruptScale,
    radius:SHOCK_BASE_IMPULSE.radius*performance.radiusScale,
    knockback:SHOCK_BASE_IMPULSE.knockback*performance.knockbackScale,
    interruptSeconds:SHOCK_BASE_IMPULSE.interruptSeconds*performance.interruptScale,
  });
}
export const shockMaterial=run=>run?.fuel?.shock?.molecule??null;
export const shockCharges=run=>Math.max(0,Number(run?.fuel?.shock?.amount)||0);
export const shockStrength=run=>shockProfileFor(shockMaterial(run));
export const canShock=run=>!!run&&!run.captured&&!!shockStrength(run)&&shockCharges(run)>=1;
export function consumeShockCharge(run,consume=()=>true){
  if(!canShock(run))return false;const slot=run.fuel.shock,material=slot.molecule,strength=shockProfileFor(material);
  if(typeof consume==='function'&&consume(material,1)===false)return false;
  slot.amount-=1;return Object.freeze({material,remaining:slot.amount,capacity:strength.capacity,strength});
}
