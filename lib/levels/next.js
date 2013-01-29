module.exports = {
  name: 'Level 1',
  description: 'Just starting eh?',

  // speeds are multipliers of settings.data.unitSpeed
  cpu: {
    speed: 1,
    // what else can we control with the AI?
    // - reaction time? (z distance from the ball until movement)
    // - max speed?
    // - shakiness? (random jumps back and forth)
  },

  // speeds are multipliers of settings.data.unitSpeed
  // these are the starting speeds of the puck. then each
  // puck will have different speeds depending on the times
  // they've bounced against a paddle
  // (= max(maxspeed,unitSpeed*(speed+bounces*speedup)) )
  puck: {
    speed: 1,
    maxspeed: 4,
    speedup: 1.2
  },

  player: {
    // the number of slots in the shield array of the
    // world.players.a/b. which will generate a shield
    // "physically" and visually.
    shields: 3
  },

  theme: {
    shieldColor: 0xffffff,
    puckColor: 0xefce06,
    arenaColor: 0x892419,
    terrainColor1: 0x4d87dc,
    terrainColor2: 0x1f84d5,
    terrainColor3: 0x195475,
    treeBranchColor: 0x1564a4,
    iconColor: 0xefce06
  },

  // extras will be added every 5-10 seconds and will be placed
  // at (pseudo-)random. the list here is the available ones in
  // this level. the full list of available extras can be found
  // in lib/actions/extra.js
  extras: [
    {id: 'fog', duration: 120},
    {id: 'extra life', fuse: 300, radius: 30}
  ],

  // obstacles will be added during the game as soon as the ball
  // is not in the way. and it will stay until the end of the level.
  // the full list of available extras can be found in
  // lib/actions/obstacle.js
  obstacles: [
    {id: 'big block', x: 1, y: 1},
    {id: 'repell field', x: 1, y: 1}
  ]
}