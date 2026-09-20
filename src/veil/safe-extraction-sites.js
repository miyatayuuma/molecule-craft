import {SAFE_EXTRACTION_SITE} from './map.js';
import {OXYGEN_THERMAL,oxygenMergeRecoveryAt} from './oxygen-routes.js';
import {NITROGEN_RECOVERY_AREA,nitrogenRecoveryAt} from './nitrogen-routes.js';

const pointAt=(x,y)=>Object.freeze({x,y});
const circleContains=(center,radius,point)=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.hypot(point.x-center.x,point.y-center.y)<=radius;

const SITE_AUTHORITY=Object.freeze([
  Object.freeze({
    id:SAFE_EXTRACTION_SITE.id,
    center:pointAt(SAFE_EXTRACTION_SITE.x,SAFE_EXTRACTION_SITE.y),
    radius:SAFE_EXTRACTION_SITE.radius,
    route:SAFE_EXTRACTION_SITE.route,
    sourceLandmark:'hydrogen-safe-route',
    geometry:Object.freeze({kind:'circle',center:pointAt(SAFE_EXTRACTION_SITE.x,SAFE_EXTRACTION_SITE.y),radius:SAFE_EXTRACTION_SITE.radius}),
    activeOn:map=>map.routes?.some(route=>route.id==='safe')===true,
    contains:point=>circleContains(SITE_AUTHORITY[0].center,SITE_AUTHORITY[0].radius,point),
  }),
  Object.freeze({
    id:'oxygen-network-merge-extraction',
    center:pointAt(OXYGEN_THERMAL.mergeRecovery.x,OXYGEN_THERMAL.mergeRecovery.y),
    radius:OXYGEN_THERMAL.mergeRecovery.radius,
    route:'oxygen-main',
    sourceLandmark:'oxygen-network-merge-recovery',
    geometry:OXYGEN_THERMAL.mergeRecovery,
    activeOn:map=>map.universe===true&&map.routes?.some(route=>route.id==='oxygen-main')===true,
    contains:oxygenMergeRecoveryAt,
  }),
  Object.freeze({
    id:'nitrogen-recovery-shelf-extraction',
    center:pointAt(NITROGEN_RECOVERY_AREA.x,NITROGEN_RECOVERY_AREA.y),
    radius:NITROGEN_RECOVERY_AREA.radius,
    route:'nitrogen-main',
    sourceLandmark:NITROGEN_RECOVERY_AREA.id,
    geometry:NITROGEN_RECOVERY_AREA,
    activeOn:map=>map.nitrogenRecoveryAreas?.some(area=>area===NITROGEN_RECOVERY_AREA)===true,
    contains:point=>nitrogenRecoveryAt(point)?.id===NITROGEN_RECOVERY_AREA.id,
  }),
]);

export const SAFE_EXTRACTION_SITES=SITE_AUTHORITY;

export function resolveSafeExtractionSites(map){
  if(!map)return [];
  return SITE_AUTHORITY.filter(site=>site.activeOn(map)).map(site=>Object.freeze({...site,x:site.center.x,y:site.center.y}));
}

export function isInsideSafeExtractionSite(point,sites){
  const available=Array.isArray(sites)?sites:sites?[sites]:[];
  return available.some(site=>typeof site.contains==='function'?site.contains(point):circleContains(site.center??site,site.radius,point));
}
