// LOADOUT hardware uses the approved 1536 × 921 master as its source grid.
// All runtime placement is expressed in this 1000 × 600 design space.
export const LOADOUT_DESIGN = Object.freeze({width:1000,height:600,sourceWidth:1536,sourceHeight:921});

const rect=(x,y,width,height)=>Object.freeze({x,y,width,height});
const point=(x,y)=>Object.freeze({x,y});

export const LOADOUT_HARDWARE_LAYOUT=Object.freeze({
  design:LOADOUT_DESIGN,
  modules:Object.freeze({
    pulse:Object.freeze({rect:rect(8.5,228.0,304.0,189.6),asset:'loadout-pulse-unit.png',labelAnchor:point(151,214),connectors:Object.freeze({moduleSide:Object.freeze(['right']),craftSide:Object.freeze([])})}),
    craft:Object.freeze({rect:rect(285.2,246.2,253.9,176.6),asset:'loadout-craft.png',labelAnchor:point(412,468),intakeAnchor:point(410,325),connectors:Object.freeze({moduleSide:Object.freeze([]),receivingSockets:Object.freeze(['left','right','upper'])})}),
    shock:Object.freeze({rect:rect(321.6,80.2,153.0,194.8),asset:'loadout-shock-unit.png',labelAnchor:point(398,65),connectors:Object.freeze({moduleSide:Object.freeze(['lower']),craftSide:Object.freeze([])})}),
    drive:Object.freeze({rect:rect(516.3,202.0,474.8,247.7),asset:'loadout-drive-unit.png',labelAnchor:point(754,179),connectors:Object.freeze({moduleSide:Object.freeze(['left']),craftSide:Object.freeze([])})}),
  }),
  slots:Object.freeze({
    propellant:Object.freeze({
      module:'pulse',label:'PULSE',
      visualRect:rect(79,282,128,101),hitRect:rect(18,205,262,222),thumbnailRect:rect(94,301,98,63),meterRect:rect(95,370,96,6),labelAnchor:point(143,214),
    }),
    shock:Object.freeze({
      module:'shock',label:'SHOCK',
      visualRect:rect(360,113,77,82),hitRect:rect(318,59,159,181),thumbnailRect:rect(369,126,59,54),meterRect:rect(370,184,57,5),labelAnchor:point(398,65),
    }),
    fuel:Object.freeze({
      module:'drive',label:'FUEL',
      visualRect:rect(564,282,94,101),hitRect:rect(545,250,119,190),thumbnailRect:rect(578,301,66,65),meterRect:rect(580,370,62,6),labelAnchor:point(611,466),
    }),
    oxidizer:Object.freeze({
      module:'drive',label:'O₂',
      visualRect:rect(692,282,94,101),hitRect:rect(674,250,121,190),thumbnailRect:rect(706,301,66,65),meterRect:rect(708,370,62,6),labelAnchor:point(739,466),
    }),
    coolant:Object.freeze({
      module:'drive',label:'COOLANT',
      visualRect:rect(820,282,94,101),hitRect:rect(805,250,131,190),thumbnailRect:rect(834,301,66,65),meterRect:rect(836,370,62,6),labelAnchor:point(867,466),
    }),
  }),
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
