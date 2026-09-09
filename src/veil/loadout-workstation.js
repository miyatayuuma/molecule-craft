const STYLE_ID='molecule-craft-loadout-workstation-style';

export const LOADOUT_LABELS=Object.freeze({propellant:'PULSE',fuel:'FUEL',oxidizer:'O₂',coolant:'COOLANT'});

function addDriveLabel(map){if(!map||map.querySelector('.loadout-drive-label'))return;const label=document.createElement('span');label.className='loadout-drive-label';label.textContent='DRIVE';label.setAttribute('aria-hidden','true');map.append(label);}
function installLabels(){const title=document.getElementById('supply-title');if(title)title.textContent='LOADOUT';const access=document.getElementById('open-supply');if(access)access.setAttribute('aria-label','LOADOUTを開く');for(const [use,label] of Object.entries(LOADOUT_LABELS)){const button=document.getElementById(`shell-${use}`);if(!button)continue;button.querySelector('span')?.replaceChildren(label);button.setAttribute('aria-label',`${label}を選ぶ`);}const map=document.querySelector('#supply-dialog .collector-shell-map');addDriveLabel(map);const details=document.querySelector('#supply-dialog .tank-explanation');if(details)details.open=true;}
function installStyles(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#supply-dialog .collector-shell-map{height:190px!important;border-color:#294656;background:radial-gradient(circle at 39% 52%,#173c4d 0 18%,#0a1a27 38%,#071520 78%);overflow:hidden}
#supply-dialog .collector-shell-map:after{content:''!important;display:block!important;position:absolute!important;z-index:1!important;top:50%!important;right:2.5%!important;bottom:auto!important;left:auto!important;width:55%!important;height:auto!important;aspect-ratio:640/227;transform:translateY(-50%);border:0!important;border-radius:0!important;background:url('./assets/loadout-drive-unit.png') center/contain no-repeat!important;opacity:1;pointer-events:none;transition:opacity .14s ease,filter .14s ease}
#supply-dialog .collector-shell-map:before,#supply-dialog .collector-core{display:none!important}
#supply-dialog .loadout-drive-label{position:absolute;z-index:5;right:20%;top:15px;color:#a9c0cb;font-size:9px;font-weight:800;letter-spacing:.22em;line-height:1;pointer-events:none;text-shadow:0 1px 4px #000}
#supply-dialog #collector-shell-preview{position:absolute!important;inset:auto!important;left:25%!important;top:0!important;width:22%!important;height:100%!important;z-index:2!important}
#supply-dialog #collector-launch-handle{left:39%!important;top:52%!important;width:76px!important;height:76px!important}
#supply-dialog #expedition-destinations button{left:39%!important;top:52%!important}
#supply-dialog .shell-port{z-index:4!important;min-width:0!important;min-height:0!important;margin:0!important;box-sizing:border-box;border:0!important;border-radius:10px!important;background:transparent!important;box-shadow:none!important;color:#d9e8ed;overflow:visible;transition:background .12s ease,box-shadow .12s ease,opacity .14s ease,filter .12s ease}
#supply-dialog .shell-port>i{display:none!important}
#supply-dialog .shell-port>span{position:absolute;z-index:2;color:#dce8ec;font-size:7px;font-weight:850;line-height:1;letter-spacing:.08em;text-shadow:0 1px 3px #000;pointer-events:none}
#supply-dialog .shell-port>small{position:absolute;z-index:2;color:#17232b;font-size:10px;font-weight:850;line-height:1;text-shadow:0 1px 0 #ffffff80;pointer-events:none}
#supply-dialog .shell-port .tank-scale{display:none!important}
#supply-dialog .port-propellant{left:2.5%!important;right:auto!important;top:50%!important;bottom:auto!important;width:25%!important;height:74px!important;transform:translateY(-50%);padding:0!important;background:url('./assets/loadout-pulse-unit.png') center/contain no-repeat!important}
#supply-dialog .port-propellant>span{left:50%;top:13px;transform:translateX(-50%)}
#supply-dialog .port-propellant>small{left:50%;bottom:15px;transform:translateX(-50%)}
#supply-dialog .port-fuel,#supply-dialog .port-oxidizer,#supply-dialog .port-coolant{top:50%!important;right:auto!important;bottom:auto!important;width:14.6%!important;height:68px!important;transform:translateY(-50%);padding:0 2px!important}
#supply-dialog .port-fuel{left:50.8%!important}#supply-dialog .port-oxidizer{left:65.6%!important}#supply-dialog .port-coolant{left:80.4%!important}
#supply-dialog .port-fuel>span,#supply-dialog .port-oxidizer>span,#supply-dialog .port-coolant>span{left:50%;top:9px;transform:translateX(-50%)}
#supply-dialog .port-fuel>small,#supply-dialog .port-oxidizer>small,#supply-dialog .port-coolant>small{left:50%;bottom:14px;transform:translateX(-50%)}
#supply-dialog .shell-port[data-active=true]{background-color:#83dce51c!important;box-shadow:inset 0 0 0 1px #9ce5edb8,0 0 13px #6ac9d833!important}
#supply-dialog .port-propellant[data-active=true]{filter:drop-shadow(0 0 7px #81d8e866);background-color:transparent!important;box-shadow:none!important}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']):after{opacity:.34}
#supply-dialog .collector-shell-map:has(#expedition-destinations[aria-hidden='false']) .loadout-drive-label{opacity:.34}
#supply-dialog .tank-explanation{display:block!important}#supply-dialog .tank-explanation>summary{display:none!important}#supply-dialog .tank-explanation .tank-comparison{margin-top:0!important}#supply-dialog .tank-decision{justify-content:center}#supply-dialog .tank-comparison{gap:7px!important;padding:2px 0}
#supply-dialog .tank-comparison .loadout-stat{display:grid!important;grid-template-columns:62px 1fr!important;align-items:center;gap:8px!important;min-height:16px;color:#a9c0ca;font-size:9px!important}
#supply-dialog .tank-comparison .loadout-stat>span{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important}
#supply-dialog .tank-comparison .loadout-stat>i{position:relative;display:block;height:7px;overflow:visible!important;border-radius:5px;background:#233b48}
#supply-dialog .tank-comparison .loadout-stat>i>b{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;transform-origin:left;background:#a7e2eb}
#supply-dialog .tank-comparison .loadout-stat>i>em{position:absolute;z-index:2;top:-2px;width:2px;height:11px;background:#f3dc8d;box-shadow:0 0 4px #061018;transform:translateX(-1px)}
#supply-dialog .loadout-charges{display:grid;grid-template-columns:62px 1fr;align-items:center;gap:8px;padding:0;min-height:16px;color:#a9c0ca;font-size:9px}
#supply-dialog .loadout-charges>div{display:flex;align-items:center;gap:4px;min-height:11px;flex-wrap:wrap}#supply-dialog .loadout-charges i{display:block;width:8px;height:8px;border-radius:50%;background:#a7e2eb;box-shadow:0 0 5px #71ccd933}#supply-dialog .loadout-charges[data-ghost=true]{opacity:.38}
#supply-dialog #tank-detail-title{font-size:0}#supply-dialog #tank-detail-title:after{font-size:14px;font-weight:700;letter-spacing:.04em}
#supply-dialog:has(#shell-propellant[data-active='true']) #tank-detail-title:after{content:'PULSE'}#supply-dialog:has(#shell-fuel[data-active='true']) #tank-detail-title:after{content:'FUEL'}#supply-dialog:has(#shell-oxidizer[data-active='true']) #tank-detail-title:after{content:'O₂'}#supply-dialog:has(#shell-coolant[data-active='true']) #tank-detail-title:after{content:'COOLANT'}
@media(max-width:370px){#supply-dialog .collector-shell-map{height:178px!important}#supply-dialog #collector-launch-handle{width:70px!important;height:70px!important}#supply-dialog .port-propellant{width:24%!important;height:68px!important}#supply-dialog .port-fuel,#supply-dialog .port-oxidizer,#supply-dialog .port-coolant{height:62px!important}#supply-dialog .shell-port>span{font-size:6px}#supply-dialog .shell-port>small{font-size:9px}#supply-dialog .loadout-drive-label{top:13px;font-size:8px}#supply-dialog .tank-comparison .loadout-stat,#supply-dialog .loadout-charges{grid-template-columns:55px 1fr}}
@media(prefers-reduced-motion:reduce){#supply-dialog .shell-port,#supply-dialog .collector-shell-map:after{transition:none}}
`;document.head.append(style);}
export function installLoadoutWorkstation(){if(typeof document==='undefined')return false;installStyles();installLabels();return true;}
if(typeof document!=='undefined')installLoadoutWorkstation();
