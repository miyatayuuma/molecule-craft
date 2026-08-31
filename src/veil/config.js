// World units / seconds. Tune feel here; resource units are not individual atoms.
export const VEIL = Object.freeze({
  speed: 172, driftSpeed: 30, acceleration: 7, releaseDrag: 3.2,
  turnRate: 5.8, boostTurnRate: 8.5, turnResponse: 9, reverseAssist: 1.45,
  velocityGrip: 10, boostGrip: 15, cornerSpeed: .64,
  boostSpeed: 640, boostAcceleration: 17, boostSeconds: 1.08, boostCooldown: .28, boostCost: 1,
  chainSeconds: 1.5, chainSpeedBonus: .09, chainRadiusBonus: 16, feverChain: 100,
  suctionRadius: 40, boostRadius: 72, assistRadius: 78, assistStrength: .22,
  suctionSeconds: .3, feverSuctionSeconds: .18, suctionBend: 35,
  dustSpacing: 30, denseSpacing: 21, dustValue: 1, dustPerH: 3, rareValue: 8,
  denseLaneOffset: 21, shoulderOffset: 88, shoulderLanes: 2,
  bandPeriod: 24, bandLength: 12,
  firstCraftH: 24, respawnSeconds: 45, rareChance: .28,
  fieldForce: 112, fieldRadius: 200, fieldPeriod: 7, fieldPulse: .28,
  boostFieldResistance: .10, maxOpposingFlow: .22, gateDeflection: 230,
  lapMinSeconds: 40, lapRadius: 150, lapRearmDistance: 700,
  maxEffects: 160, maxDpr: 1.75, maxFrame: .05,
  cameraLead: .65, cameraMaxLead: 210, cameraEase: 6, boostZoom: .10,
  holdDelayMs: 360, holdIntervalMs: 140,
  bounds: {left:-1100, right:1250, top:-4350, bottom:500},
  spawn: {x:0, y:180, angle:-Math.PI/2},
  gate: {x:530, y:-3800, width:460, height:140},
});
export const VEIL_AUDIO = Object.freeze({
  master: .25, pickupInterval: .075, pickupSeconds: .15,
  pickupLevel: .095, pickupBase: 196, harmonyLevel: .022,
  movementLevel: .045, feverLevel: .035, boostLevel: .23,
  notes: [0, 2, 4, 7, 9, 12, 14, 16],
});
