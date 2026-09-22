// LOADOUT hardware uses the approved 1536 × 921 master as its source grid.
// All runtime placement is expressed in this 1000 × 600 design space.
export const LOADOUT_DESIGN = Object.freeze({width:1000,height:600,sourceWidth:1536,sourceHeight:921});

const rect=(x,y,width,height)=>Object.freeze({x,y,width,height});
const point=(x,y)=>Object.freeze({x,y});
const centerOf=rectangle=>point(rectangle.x+rectangle.width/2,rectangle.y+rectangle.height/2);
const expandRect=(rectangle,paddingX,paddingY=paddingX)=>rect(rectangle.x-paddingX,rectangle.y-paddingY,rectangle.width+paddingX*2,rectangle.height+paddingY*2);
const insetRect=(rectangle,insetX,insetY=insetX)=>rect(rectangle.x+insetX,rectangle.y+insetY,rectangle.width-insetX*2,rectangle.height-insetY*2);
const centeredRect=(center,width,height)=>rect(center.x-width/2,center.y-height/2,width,height);

// These are measured bounds of the visible white/grey front panels in the
// approved per-module PNGs. They are deliberately kept per asset and per
// DRIVE cell; the artwork is not a geometrically repeated three-cell grid.
const MEASURED_PANEL_SOURCE_RECTS=Object.freeze({
  propellant:Object.freeze({asset:'loadout-pulse-unit.png',width:467,height:291,rect:Object.freeze({x:161,y:78,width:139,height:123})}),
  shock:Object.freeze({asset:'loadout-shock-unit.png',width:235,height:299,rect:Object.freeze({x:77,y:61,width:87,height:95})}),
  fuel:Object.freeze({asset:'loadout-drive-unit.png',width:729,height:380,rect:Object.freeze({x:92,y:137,width:106,height:122})}),
  oxidizer:Object.freeze({asset:'loadout-drive-unit.png',width:729,height:380,rect:Object.freeze({x:300,y:137,width:107,height:123})}),
  coolant:Object.freeze({asset:'loadout-drive-unit.png',width:729,height:380,rect:Object.freeze({x:510,y:144,width:103,height:116})}),
});

const assetRectToDesign=(module,measured)=>rect(
  module.rect.x+measured.rect.x/measured.width*module.rect.width,
  module.rect.y+measured.rect.y/measured.height*module.rect.height,
  measured.rect.width/measured.width*module.rect.width,
  measured.rect.height/measured.height*module.rect.height,
);

const MODULES={
  pulse:Object.freeze({rect:rect(8.5,228.0,304.0,189.6),asset:'loadout-pulse-unit.png',labelAnchor:point(151,214),connectors:Object.freeze({moduleSide:Object.freeze(['right']),craftSide:Object.freeze([])})}),
  craft:Object.freeze({rect:rect(285.2,246.2,253.9,176.6),asset:'loadout-craft.png',labelAnchor:point(412,468),intakeAnchor:point(390,312),dragAnchor:point(412,334.5),dragHitRect:rect(322,249,180,171),connectors:Object.freeze({moduleSide:Object.freeze([]),receivingSockets:Object.freeze(['left','right','upper'])})}),
  shock:Object.freeze({rect:rect(321.6,80.2,153.0,194.8),asset:'loadout-shock-unit.png',labelAnchor:point(398,65),connectors:Object.freeze({moduleSide:Object.freeze(['lower']),craftSide:Object.freeze([])})}),
  drive:Object.freeze({rect:rect(516.3,202.0,474.8,247.7),asset:'loadout-drive-unit.png',labelAnchor:point(754,179),connectors:Object.freeze({moduleSide:Object.freeze(['left']),craftSide:Object.freeze([])})}),
};

const PANEL_RECTS=Object.freeze(Object.fromEntries(Object.entries(MEASURED_PANEL_SOURCE_RECTS).map(([use,source])=>[
  use,assetRectToDesign(MODULES[source.asset==='loadout-pulse-unit.png'?'pulse':source.asset==='loadout-shock-unit.png'?'shock':'drive'],source),
])));
const panel=use=>PANEL_RECTS[use];
const VISUAL_PADDING=Object.freeze({propellant:Object.freeze({x:7,y:7}),shock:Object.freeze({x:7,y:7}),fuel:Object.freeze({x:12.48,y:10.74}),oxidizer:Object.freeze({x:12.16,y:10.41}),coolant:Object.freeze({x:13.46,y:12.69})});
const THUMBNAIL_INSETS=Object.freeze({propellant:Object.freeze({x:.05,y:.09}),shock:Object.freeze({x:.08,y:.09}),fuel:Object.freeze({x:.025,y:.09}),oxidizer:Object.freeze({x:.025,y:.09}),coolant:Object.freeze({x:.025,y:.09})});
const visual=use=>{const padding=VISUAL_PADDING[use];return expandRect(panel(use),padding.x,padding.y);};
const thumbnail=use=>{const p=panel(use),inset=THUMBNAIL_INSETS[use];return insetRect(p,p.width*inset.x,p.height*inset.y);};
const meter=use=>{const p=panel(use);return rect(p.x+p.width*.06,p.y+p.height-1,p.width*.88,7);};
const hit=(use,width,height)=>centeredRect(centerOf(panel(use)),width,height);
const labelBelow=use=>point(centerOf(panel(use)).x,466);

export const LOADOUT_HARDWARE_LAYOUT=Object.freeze({
  design:LOADOUT_DESIGN,
  modules:Object.freeze(MODULES),
  slots:Object.freeze({
    propellant:Object.freeze({
      module:'pulse',label:'PULSE',panelRect:panel('propellant'),
      visualRect:visual('propellant'),hitRect:hit('propellant',262,222),thumbnailRect:thumbnail('propellant'),meterRect:meter('propellant'),labelAnchor:point(centerOf(panel('propellant')).x,214),
    }),
    shock:Object.freeze({
      module:'shock',label:'SHOCK',panelRect:panel('shock'),
      visualRect:visual('shock'),hitRect:hit('shock',159,181),thumbnailRect:thumbnail('shock'),meterRect:meter('shock'),labelAnchor:point(centerOf(panel('shock')).x,65),
    }),
    fuel:Object.freeze({
      module:'drive',label:'FUEL',panelRect:panel('fuel'),
      visualRect:visual('fuel'),hitRect:hit('fuel',119,190),thumbnailRect:thumbnail('fuel'),meterRect:meter('fuel'),labelAnchor:labelBelow('fuel'),
    }),
    oxidizer:Object.freeze({
      module:'drive',label:'O₂',panelRect:panel('oxidizer'),
      visualRect:visual('oxidizer'),hitRect:hit('oxidizer',121,190),thumbnailRect:thumbnail('oxidizer'),meterRect:meter('oxidizer'),labelAnchor:labelBelow('oxidizer'),
    }),
    coolant:Object.freeze({
      module:'drive',label:'COOLANT',panelRect:panel('coolant'),
      visualRect:visual('coolant'),hitRect:hit('coolant',131,190),thumbnailRect:thumbnail('coolant'),meterRect:meter('coolant'),labelAnchor:labelBelow('coolant'),
    }),
  }),
  measuredPanelSourceRects:MEASURED_PANEL_SOURCE_RECTS,
});

// Kept only for source compatibility with older tests/importers. Production
// placement, hit testing, highlighting, thumbnails, meters and labels use the
// metadata above exclusively.
export const LOADOUT_SLOT_GEOMETRY=Object.freeze({
  propellant:Object.freeze({centerX:16.05,left:10.6,width:10.9,top:38.5,height:27,labelX:16.05}),
  shock:Object.freeze({centerX:39,left:31.5,width:15,top:11,height:18,labelX:39}),
  fuel:Object.freeze({centerX:65.1,left:60.1,width:10,top:38,height:27,labelX:65.1}),
  oxidizer:Object.freeze({centerX:77.2,left:72.2,width:10,top:38,height:27,labelX:77.2}),
  coolant:Object.freeze({centerX:88.8,left:83.8,width:10,top:38,height:27,labelX:88.8}),
});

export const LOADOUT_LABELS=Object.freeze(Object.fromEntries(Object.entries(LOADOUT_HARDWARE_LAYOUT.slots).map(([use,slot])=>[use,slot.label])));
export const LOADOUT_SLOT_USES=Object.freeze(Object.keys(LOADOUT_HARDWARE_LAYOUT.slots));

export function designRectToMap(rectangle,scale,offsetX=0,offsetY=0){
  return {left:offsetX+rectangle.x*scale,top:offsetY+rectangle.y*scale,width:rectangle.width*scale,height:rectangle.height*scale};
}

export function designPointToMap(pointValue,scale,offsetX=0,offsetY=0){
  return {x:offsetX+pointValue.x*scale,y:offsetY+pointValue.y*scale};
}
