// Game units, seconds, and resource units; no physical scale is implied.
export const VEIL = Object.freeze({
  speed: 165, acceleration: 4.4, turnRate: 3.6, boostTurnRate: 2.8,
  boostSpeed: 570, boostSeconds: 1.1, boostCooldown: .2,
  chainSeconds: 1.45, chainSpeedBonus: .12, chainRadiusBonus: 16,
  suctionRadius: 36, boostRadius: 18, assistRadius: 68, assistStrength: .27,
  dustSpacing: 31, denseSpacing: 21, dustValue: 1, dustPerH: 3, rareValue: 8,
  firstCraftH: 24, respawnSeconds: 62, rareChance: .28,
  fieldForce: 235, fieldRadius: 150, fieldWarning: 1.2,
  maxEffects: 120, maxDpr: 1.75, maxFrame: .05, defaultFuelBatch: 5,
  bounds: {left:-1100, right:1250, top:-4350, bottom:500},
  spawn: {x:0, y:180, angle:-Math.PI/2},
  gate: {x:530, y:-3800, width:460, height:140},
});
