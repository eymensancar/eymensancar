// Temiz Şehir — game data (single source of truth for every number).
// Owner: design. Pure data: no logic, no imports. Design rationale: docs/TASARIM.md.
//
// CONVENTIONS
//   Distances in metres, speeds in m/s, times in seconds, angles in degrees.
//   World axes: x east, z south, origin at the district's NW corner, y up. Positions are [x, z].
//   "unit" = one trash item = 1 bag/tank capacity. A cell's "depth" = how many units it holds.
//   Per-level arrays: index 0 = what you start with (or get on purchase), index n = after upgrade level n.
//   String ids (str*) refer to keys in STR below.
//
// FIELDS
//   version, saveKey           save format version and localStorage key.
//   targets                    intended timeline for an average player (minutes) — for tests/telemetry, not gameplay.
//   district                   grid size, cell size, street/block layout, shop kiosk, visual-only surroundings.
//   trashGen                   how initial depth per cell is generated (seeded, deterministic).
//   trashTypes                 item types: value in coins, colour hint, size, strings.
//   zoneMix                    per zone ('street' | 'plaza' | 'pile') probability of each type (sum 1, excl. valuable).
//   valuableChance             per zone chance that a collected unit is a valuable instead of the rolled type.
//   player                     start position, walk speed, eye height, look defaults.
//   hands, broom, bag          tool stats per level.
//   robot                      robot vacuum stats per level, dock, AI tunables.
//   cart                       ride-on vacuum cart stats per level and handling.
//   sellPoints                 where trash is sold; unlockId = shop item that enables it (null = always).
//   selling                    sell animation and price multiplier.
//   shop                       ordered item list: id, effect (what it sets), price, requires, strings.
//   boost                      mock rewarded-ad 2x income: duration, cooldown, offer rules.
//   milestones, completion     district % thresholds, bonuses, final sweep.
//   hints                      onboarding hints (show-once, dismissed by the action they ask for).
//   feedback                   juice timings (pickup arc, pitch chain, coin fly, etc.).
//   promo                      slots for the studio's other games (placeholders, no links yet).

export const CONFIG = {
  version: 1,
  saveKey: 'temizsehir.v1',

  // ---- Intended timeline, average player (70% efficiency), minutes. Simulated, not playtested.
  targets: {
    firstSale: 0.15, bag1: 0.3, broom: 1.9, bag2: 3.0, bag3: 5.0, dropoff: 5.9,
    robot1: 7.5, robot2: 9.8, cart: 11.8, percent50: 13.5, percent75: 15.5,
    complete: 17.1, completeSlowPlayer: 21.2, completeFastPlayer: 14.7,
    sessionMinMax: [10, 20],
  },

  // ---- District geometry. 54 x 54 m, 0.5 m cells => 108 x 108 grid.
  // Streets (6 m wide) at offsets 0, 24, 48 on both axes; 4 blocks of 18 x 18 m between them.
  // Trash lives on every street cell and every plaza cell except the kiosk footprint.
  district: {
    id: 'mahalle',
    strName: 'district_name',
    sizeM: [54, 54],
    cellM: 0.5,
    grid: [108, 108],
    streetWidthM: 6,
    streetOffsetsM: [0, 24, 48],          // same on x and z
    blocks: [                              // [x0, z0, x1, z1] in metres
      { id: 'nw', rect: [6, 6, 24, 24],   kind: 'building', heightM: [12, 21] },
      { id: 'ne', rect: [30, 6, 48, 24],  kind: 'plaza' },
      { id: 'sw', rect: [6, 30, 24, 48],  kind: 'building', heightM: [9, 18] },
      { id: 'se', rect: [30, 30, 48, 48], kind: 'building', heightM: [15, 24], promoBillboard: true },
    ],
    shopKiosk: { rect: [37, 8, 41, 11], heightM: 3.2 },   // blocks trash cells (48 cells)
    trashCellsExpected: 7728,             // 6480 street + 1296 plaza - 48 kiosk; generator may assert this
    totalUnitsTarget: 13500,              // ~ trashCellsExpected * targetMeanDepth
    totalValueApprox: 28000,              // ~ totalUnits * 2.08 average coins/unit
    surroundings: {                        // visual only, never cleanable, never counted
      neighbourRingDistricts: 2,           // rings of buried districts drawn around, to the horizon
      roofTrash: true,
      barrierStrId: 'barrier_soon',
    },
  },

  // ---- Initial trash depth per cell (deterministic from seed).
  // depth = clamp(round(zoneBase[zone] + noiseAmp * n(x/noiseScaleM, z/noiseScaleM) + pileBonus), min, max)
  // n in [-1, 1]. pileBonus = pileAdd * (1 - d/r) inside a pile of radius r. Then shift base offset so the
  // mean over trash cells == targetMeanDepth (+-0.03), never letting any cell drop below depthMin.
  trashGen: {
    seed: 20261113,
    depthMin: 1,                           // >= 1 everywhere: no gaps
    depthMax: 4,
    targetMeanDepth: 1.74,
    zoneBase: { street: 1.6, plaza: 1.8 },
    noiseAmp: 0.7,
    noiseScaleM: 5,
    piles: { count: 14, radiusM: [1.5, 3.0], add: 1.5, placement: 'buildingCorners' }, // cells in a pile use zoneMix.pile
  },

  // ---- Trash types. value = coins per unit when sold.
  trashTypes: [
    { id: 'paper',    value: 1,  sizeM: 0.18, color: '#e8e2d0', strId: 'trash_paper' },
    { id: 'plastic',  value: 2,  sizeM: 0.22, color: '#4fa3d9', strId: 'trash_plastic' },
    { id: 'can',      value: 3,  sizeM: 0.12, color: '#c9483b', strId: 'trash_can' },
    { id: 'glass',    value: 4,  sizeM: 0.25, color: '#3f9a5a', strId: 'trash_glass' },
    { id: 'bag',      value: 5,  sizeM: 0.40, color: '#2b2b2f', strId: 'trash_bag' },
    { id: 'valuable', value: 50, sizeM: 0.12, color: '#f2c230', strId: 'trash_valuable', sparkle: true },
  ],
  zoneMix: {                               // probabilities of non-valuable types; each row sums to 1
    street: { paper: 0.50, plastic: 0.28, can: 0.14, glass: 0.05, bag: 0.03 },
    plaza:  { paper: 0.30, plastic: 0.30, can: 0.15, glass: 0.12, bag: 0.13 },
    pile:   { paper: 0.20, plastic: 0.25, can: 0.20, glass: 0.10, bag: 0.25 },
  },
  valuableChance: { street: 0.001, plaza: 0.002, pile: 0.006 },
  averageValuePerUnit: 2.08,               // informational (derived from the above)

  // ---- Player (on foot).
  player: {
    startPos: [39, 17],                    // plaza, 4 m in front of the shop sell zone
    startYawDeg: 180,                      // facing south, away from the kiosk, into the trash
    walkSpeed: 5.0,
    eyeHeightM: 1.65,
    radiusM: 0.35,
    fovVerticalDegLandscape: 60,
    fovVerticalDegPortrait: 75,
    lookSensitivityTouchDegPerPx: 0.25,
    lookSensitivityMouseDegPerPx: 0.15,
    pitchLimitDeg: [-70, 60],
    startCoins: 0,
  },

  // ---- Hands (start tool). Hold action = auto-grab; tap an item = grab it.
  hands: {
    reachM: 2.2,
    coneDeg: 70,
    holdIntervalS: 0.4,                    // 2.5 units/s while held
    tapCooldownS: 0.12,                    // max ~8/s, real ~6/s
    unitsPerGrab: 1,
  },

  // ---- Broom + dustpan. Equipped tool sweeps while moving; move speed capped at sweepSpeed.
  broom: {
    widthM: [1.0, 1.3],                    // level 0 on purchase, level 1 = shop 'broom_w1'
    sweepSpeed: [2.0, 2.4],                // level 0, level 1 = shop 'broom_s1'
    reachAheadM: 0.6,                      // strip centre distance in front of the player
    unitsPerCellPass: 4,                   // a pass empties the cell (max depth 4)
    minMoveSpeedToSweep: 0.3,
  },

  // ---- Bag (shared by hands and broom).
  bag: {
    capacity: [15, 40, 90, 180],           // shop: bag_1, bag_2, bag_3
    strNames: ['bag_name_0', 'bag_name_1', 'bag_name_2', 'bag_name_3'],
  },

  // ---- Robot vacuum. Auto-cleans nearest dirty cell (lawnmower rows), returns to nearest sell point when full.
  robot: {
    maxCount: 4,                           // shop: robot_1..robot_4
    dockPos: [35, 13],                     // spawn/park, next to the shop
    radiusM: 0.35,
    swathM: 0.5,                           // one cell wide
    cleanSpeed: [1.5, 1.8, 2.1],           // m/s while cleaning; shop robot_speed_1, robot_speed_2
    moveSpeed:  [2.5, 3.2, 4.0],           // m/s in transit
    capacity: [60, 100],                   // shop robot_cap_1
    unloadS: 2.0,
    retargetRadiusM: 12,                   // look for dirty cells within this of itself first
    avoidPlayerM: 1.2,
    priorityStragglersAt: 0.90,            // from district 90%: target remaining clusters globally
  },

  // ---- Ride-on vacuum cart.
  cart: {
    parkPos: [39, 20],                     // appears here on purchase
    parkYawDeg: 180,
    enterRadiusM: 2.0,
    sizeM: [1.6, 2.4],                     // width, length
    nozzleWidthM: [1.8, 2.2],              // shop cart_width_1
    tank: [600, 1000],                     // shop cart_tank_1
    topSpeed: 8.0,                         // nozzle up
    cleanSpeedMax: 5.0,                    // nozzle down caps speed to this
    accel: 6.0,                            // m/s^2
    brake: 10.0,
    turnRateDeg: 140,                      // deg/s at full stick
    controlMode: 'camera',                 // 'camera' = stick direction relative to camera; 'tank' = A/B alternative
    nozzleStartsDown: true,
    eyeHeightM: 2.0,
    bumpSlowdown: 0.5,                     // speed multiplier on wall hit
  },

  // ---- Sell points. Walk (or drive) into radius -> auto-dump.
  sellPoints: [
    { id: 'shop',    pos: [39, 13], radiusM: 2.5, cartRadiusM: 3.5, unlockId: null,      strId: 'sell_shop' },
    { id: 'dropoff', pos: [3, 51],  radiusM: 2.5, cartRadiusM: 3.5, unlockId: 'dropoff', strId: 'sell_dropoff' },
  ],
  selling: {
    dumpAnimS: 0.6,
    priceMultiplier: 1.0,                  // same price at every sell point
    fullArrowShowS: 0.0,                   // arrow to nearest sell point appears immediately when bag full
  },

  // ---- Shop. Shown: all items whose requires are bought, sorted by price; cheapest flagged "next".
  // effect: { set: <path>, value } — the field/level the purchase sets.
  shop: {
    items: [
      { id: 'bag_1',          price: 40,   requires: [],              effect: { set: 'bag.level', value: 1 },       strName: 'shop_bag_1',      strDesc: 'shop_bag_1_d' },
      { id: 'broom',          price: 300,  requires: [],              effect: { set: 'broom.owned', value: true },  strName: 'shop_broom',      strDesc: 'shop_broom_d' },
      { id: 'bag_2',          price: 400,  requires: ['bag_1'],       effect: { set: 'bag.level', value: 2 },       strName: 'shop_bag_2',      strDesc: 'shop_bag_2_d' },
      { id: 'broom_w1',       price: 450,  requires: ['broom'],       effect: { set: 'broom.widthLevel', value: 1 },strName: 'shop_broom_w1',   strDesc: 'shop_broom_w1_d' },
      { id: 'dropoff',        price: 600,  requires: ['broom'],       effect: { set: 'sell.dropoff', value: true }, strName: 'shop_dropoff',    strDesc: 'shop_dropoff_d' },
      { id: 'bag_3',          price: 700,  requires: ['bag_2'],       effect: { set: 'bag.level', value: 3 },       strName: 'shop_bag_3',      strDesc: 'shop_bag_3_d' },
      { id: 'broom_s1',       price: 900,  requires: ['broom_w1'],    effect: { set: 'broom.speedLevel', value: 1 },strName: 'shop_broom_s1',   strDesc: 'shop_broom_s1_d' },
      { id: 'robot_1',        price: 1200, requires: ['broom'],       effect: { set: 'robot.count', value: 1 },     strName: 'shop_robot_1',    strDesc: 'shop_robot_d' },
      { id: 'robot_speed_1',  price: 1400, requires: ['robot_1'],     effect: { set: 'robot.speedLevel', value: 1 },strName: 'shop_robot_speed_1', strDesc: 'shop_robot_speed_d' },
      { id: 'robot_2',        price: 1600, requires: ['robot_1'],     effect: { set: 'robot.count', value: 2 },     strName: 'shop_robot_2',    strDesc: 'shop_robot_d' },
      { id: 'cart',           price: 2800, requires: ['robot_1'],     effect: { set: 'cart.owned', value: true },   strName: 'shop_cart',       strDesc: 'shop_cart_d' },
      { id: 'cart_tank_1',    price: 2500, requires: ['cart'],        effect: { set: 'cart.tankLevel', value: 1 },  strName: 'shop_cart_tank_1',strDesc: 'shop_cart_tank_1_d' },
      { id: 'robot_cap_1',    price: 2500, requires: ['robot_1'],     effect: { set: 'robot.capLevel', value: 1 },  strName: 'shop_robot_cap_1',strDesc: 'shop_robot_cap_1_d' },
      { id: 'robot_3',        price: 3000, requires: ['robot_2'],     effect: { set: 'robot.count', value: 3 },     strName: 'shop_robot_3',    strDesc: 'shop_robot_d' },
      { id: 'cart_width_1',   price: 3000, requires: ['cart'],        effect: { set: 'cart.widthLevel', value: 1 }, strName: 'shop_cart_width_1', strDesc: 'shop_cart_width_1_d' },
      { id: 'robot_speed_2',  price: 3500, requires: ['robot_speed_1'], effect: { set: 'robot.speedLevel', value: 2 }, strName: 'shop_robot_speed_2', strDesc: 'shop_robot_speed_d' },
      { id: 'robot_4',        price: 4000, requires: ['robot_3'],     effect: { set: 'robot.count', value: 4 },     strName: 'shop_robot_4',    strDesc: 'shop_robot_d' },
    ],
    totalPrice: 28890,                     // informational
    openRadiusM: 3.0,                      // shop panel button appears within this of the kiosk sell point
  },

  // ---- Mock rewarded ad: 2x all sale income (player and robots). Never auto-pops.
  boost: {
    multiplier: 2,
    durationS: 120,
    cooldownS: 300,
    offerMinPurchases: 3,                  // shop-panel button only after 3 purchases...
    offerWhenNextItemAwayS: 60,            // ...and when the cheapest next item is >= 60 s of income away
    offerOnMilestone: 0.5,                 // one offer on the 50% milestone card
    mockAdS: 3,                            // fake "ad" overlay length
  },

  // ---- District % = clean cells / initial trash cells.
  milestones: [
    { at: 0.25, bonus: 100, strId: 'ms_25', cityEvent: 'birds' },
    { at: 0.50, bonus: 250, strId: 'ms_50', cityEvent: 'streetlights' },
    { at: 0.75, bonus: 500, strId: 'ms_75', cityEvent: 'pedestrians' },
    { at: 1.00, bonus: 0,   strId: 'ms_100', cityEvent: 'finale' },
  ],
  completion: {
    stragglerHintAt: 0.90,                 // compass shows remaining dirty clusters
    finalSweepAt: 0.985,                   // auto-clear + pay out the rest, then show 100%
    finalSweepS: 4,
    stragglerClusterMinCells: 4,
  },

  // ---- Onboarding hints (each once; removed by the action it asks for). Max 4 before broom.
  hints: [
    { id: 'pick',   strId: 'hint_pick',   showAtS: 0,  doneOn: 'pickup' },
    { id: 'sell',   strId: 'hint_sell',   showOn: 'bagFull', doneOn: 'sale' },
    { id: 'shop',   strId: 'hint_shop',   showOn: 'canAffordFirst', doneOn: 'purchase' },
    { id: 'walk',   strId: 'hint_walk',   showAtS: 45, onlyIfNotMovedS: 20, doneOn: 'move' },
    { id: 'broom',  strId: 'hint_broom',  showOn: 'buy:broom', doneOn: 'sweep' },
    { id: 'robot',  strId: 'hint_robot',  showOn: 'buy:robot_1', durationS: 4 },
    { id: 'cart',   strId: 'hint_cart',   showOn: 'buy:cart', doneOn: 'enterCart' },
    { id: 'nozzle', strId: 'hint_nozzle', showOn: 'enterCart', doneOn: 'nozzleToggle' },
  ],

  // ---- Juice timings (seconds unless noted).
  feedback: {
    pickupArcS: 0.25,
    pickupPitchStepSemis: 1,
    pickupPitchMaxSemis: 12,
    pickupChainWindowS: 0.6,
    coinPopupBatchS: 0.25,
    dustPuffEveryS: 0.3,
    coinFlyS: 0.7,
    coinCounterRollS: 0.8,
    purchaseToast: 1.5,
    milestoneConfettiS: 2.5,
    bagFullPulseS: 0.6,
    cellCleanFadeS: 0.2,                   // ground tint lerp when a cell hits 0
    robotHumMaxDistM: 15,
    cartShakeOnBump: 0.15,
  },

  // ---- Promo slots for the studio's other games (placeholders, no links yet).
  promo: {
    billboard: { blockId: 'se', facing: 'north', sizeM: [6, 3] },
    onCompleteCards: true,
    games: [
      { id: 'yikim-ustasi', strName: 'promo_yikim', url: null },
      { id: 'sayi-yolu',    strName: 'promo_sayiyolu', url: null },
    ],
  },
};

// ---- Player-facing strings. Turkish first, English second. Placeholders: {n}, {m} numbers, {name} a string. No emoji.
export const STR = {
  // HUD
  coins:            { tr: 'Altın', en: 'Coins' },
  district_name:    { tr: 'Mahalle', en: 'Neighbourhood' },
  district_percent: { tr: 'Temiz: %{n}', en: 'Clean: {n}%' },
  bag_full:         { tr: 'Çanta dolu', en: 'Bag full' },
  tank_full:        { tr: 'Depo dolu', en: 'Tank full' },
  bag_count:        { tr: '{n}/{m}', en: '{n}/{m}' },
  next_goal:        { tr: 'Sıradaki: {name}', en: 'Next: {name}' },

  // Action button
  act_pick:         { tr: 'Topla', en: 'Pick up' },
  act_sweep:        { tr: 'Süpür', en: 'Sweep' },
  act_enter:        { tr: 'Bin', en: 'Get in' },
  act_exit:         { tr: 'İn', en: 'Get out' },
  act_nozzle_down:  { tr: 'Emiciyi indir', en: 'Nozzle down' },
  act_nozzle_up:    { tr: 'Emiciyi kaldır', en: 'Nozzle up' },
  act_shop:         { tr: 'Dükkan', en: 'Shop' },
  act_tool_hands:   { tr: 'Eller', en: 'Hands' },
  act_tool_broom:   { tr: 'Süpürge', en: 'Broom' },

  // Selling
  sell_shop:        { tr: 'Dükkan', en: 'Shop' },
  sell_dropoff:     { tr: 'Konteyner', en: 'Container' },
  sell_here:        { tr: 'Sat', en: 'Sell' },
  sold:             { tr: '+{n} altın', en: '+{n} coins' },
  valuable_found:   { tr: 'Değerli bir şey buldun!', en: 'You found something valuable!' },

  // Trash
  trash_paper:      { tr: 'Kâğıt', en: 'Paper' },
  trash_plastic:    { tr: 'Plastik şişe', en: 'Plastic bottle' },
  trash_can:        { tr: 'Kutu', en: 'Can' },
  trash_glass:      { tr: 'Cam şişe', en: 'Glass bottle' },
  trash_bag:        { tr: 'Çöp torbası', en: 'Trash bag' },
  trash_valuable:   { tr: 'Değerli eşya', en: 'Valuable' },

  // Bags
  bag_name_0:       { tr: 'Poşet', en: 'Plastic bag' },
  bag_name_1:       { tr: 'Çuval', en: 'Sack' },
  bag_name_2:       { tr: 'Büyük çuval', en: 'Big sack' },
  bag_name_3:       { tr: 'Sırt çantası', en: 'Backpack' },

  // Shop
  shop_title:       { tr: 'Dükkan', en: 'Shop' },
  shop_buy:         { tr: 'Satın al', en: 'Buy' },
  shop_next:        { tr: 'Sıradaki', en: 'Next' },
  shop_owned:       { tr: 'Alındı', en: 'Owned' },
  shop_no_money:    { tr: '{n} altın daha', en: '{n} more coins' },
  shop_close:       { tr: 'Kapat', en: 'Close' },
  shop_bag_1:       { tr: 'Çuval', en: 'Sack' },
  shop_bag_1_d:     { tr: '40 parça taşır', en: 'Carries 40 items' },
  shop_bag_2:       { tr: 'Büyük çuval', en: 'Big sack' },
  shop_bag_2_d:     { tr: '90 parça taşır', en: 'Carries 90 items' },
  shop_bag_3:       { tr: 'Sırt çantası', en: 'Backpack' },
  shop_bag_3_d:     { tr: '180 parça taşır', en: 'Carries 180 items' },
  shop_broom:       { tr: 'Süpürge', en: 'Broom' },
  shop_broom_d:     { tr: 'Yürürken bir şerit süpürür', en: 'Sweeps a strip as you walk' },
  shop_broom_w1:    { tr: 'Geniş süpürge', en: 'Wide broom' },
  shop_broom_w1_d:  { tr: 'Daha geniş şerit', en: 'Wider strip' },
  shop_broom_s1:    { tr: 'Sert kıl', en: 'Stiff bristles' },
  shop_broom_s1_d:  { tr: 'Daha hızlı süpürürsün', en: 'Sweep faster' },
  shop_dropoff:     { tr: 'Yakın konteyner', en: 'Nearby container' },
  shop_dropoff_d:   { tr: 'Uzak köşeye ikinci satış noktası', en: 'A second sell point in the far corner' },
  shop_robot_1:     { tr: 'Robot süpürge', en: 'Robot vacuum' },
  shop_robot_2:     { tr: '2. robot', en: 'Robot #2' },
  shop_robot_3:     { tr: '3. robot', en: 'Robot #3' },
  shop_robot_4:     { tr: '4. robot', en: 'Robot #4' },
  shop_robot_d:     { tr: 'Kendi kendine temizler ve satar', en: 'Cleans and sells by itself' },
  shop_robot_speed_1: { tr: 'Hızlı robotlar', en: 'Faster robots' },
  shop_robot_speed_2: { tr: 'Turbo robotlar', en: 'Turbo robots' },
  shop_robot_speed_d: { tr: 'Robotlar daha hızlı çalışır', en: 'Robots work faster' },
  shop_robot_cap_1: { tr: 'Büyük hazne', en: 'Bigger bin' },
  shop_robot_cap_1_d: { tr: 'Robotlar 100 parça taşır', en: 'Robots carry 100 items' },
  shop_cart:        { tr: 'Süpürge arabası', en: 'Vacuum cart' },
  shop_cart_d:      { tr: 'Bin, sür, sokakları emsin', en: 'Ride it and vacuum whole streets' },
  shop_cart_tank_1: { tr: 'Büyük depo', en: 'Bigger tank' },
  shop_cart_tank_1_d: { tr: '1000 parça taşır', en: 'Carries 1000 items' },
  shop_cart_width_1: { tr: 'Geniş emici', en: 'Wide nozzle' },
  shop_cart_width_1_d: { tr: 'Daha geniş temizler', en: 'Cleans a wider path' },

  // Purchase toasts
  got_broom:        { tr: 'Süpürge!', en: 'Broom!' },
  got_robot:        { tr: 'Robot iş başında!', en: 'Robot at work!' },
  got_cart:         { tr: 'Araban hazır!', en: 'Your cart is ready!' },
  got_dropoff:      { tr: 'Konteyner yerleşti', en: 'Container placed' },
  got_upgrade:      { tr: 'Yükseltildi', en: 'Upgraded' },

  // Hints (one line each)
  hint_pick:        { tr: 'Topla', en: 'Pick up' },
  hint_sell:        { tr: 'Dükkana götür', en: 'Take it to the shop' },
  hint_shop:        { tr: 'Dükkan', en: 'Shop' },
  hint_walk:        { tr: 'Yürü ve topla', en: 'Walk and pick up' },
  hint_broom:       { tr: 'Yürü, süpürsün', en: 'Walk to sweep' },
  hint_robot:       { tr: 'Robot kendi temizliyor', en: 'The robot cleans on its own' },
  hint_cart:        { tr: 'Arabaya bin', en: 'Get in the cart' },
  hint_nozzle:      { tr: 'Emici inikken temizler', en: 'Cleans with the nozzle down' },

  // Milestones and completion
  ms_25:            { tr: 'Mahallenin dörtte biri temiz!', en: 'A quarter of the neighbourhood is clean!' },
  ms_50:            { tr: 'Yarısı temiz!', en: 'Halfway clean!' },
  ms_75:            { tr: 'Az kaldı!', en: 'Almost there!' },
  ms_100:           { tr: 'Mahalle tertemiz!', en: 'Neighbourhood spotless!' },
  ms_bonus:         { tr: 'Ödül: +{n} altın', en: 'Bonus: +{n} coins' },
  stragglers:       { tr: 'Son kirli yerler pusulada', en: 'Last dirty spots are on the compass' },
  final_sweep:      { tr: 'Son süpürme!', en: 'Final sweep!' },
  stat_time:        { tr: 'Süre', en: 'Time' },
  stat_items:       { tr: 'Toplanan', en: 'Collected' },
  stat_coins:       { tr: 'Kazanılan', en: 'Earned' },
  next_district:    { tr: 'Sıradaki mahalle: yakında', en: 'Next neighbourhood: coming soon' },
  barrier_soon:     { tr: 'Yakında', en: 'Coming soon' },
  continue:         { tr: 'Devam', en: 'Continue' },

  // Boost (mock rewarded ad)
  boost_offer:      { tr: 'Reklam izle: 2 dakika 2 kat altın', en: 'Watch an ad: 2x coins for 2 minutes' },
  boost_active:     { tr: '2 kat: {n} sn', en: '2x: {n}s' },
  boost_cooldown:   { tr: 'Yeniden: {n} sn', en: 'Again in: {n}s' },
  boost_mock_ad:    { tr: 'Reklam (deneme)', en: 'Ad (test)' },
  no_thanks:        { tr: 'Hayır, teşekkürler', en: 'No thanks' },

  // Promo
  promo_title:      { tr: 'Sancar Games oyunları', en: 'Games by Sancar Games' },
  promo_yikim:      { tr: 'Yıkım Ustası', en: 'Demolition Master' },
  promo_sayiyolu:   { tr: 'Sayı Yolu', en: 'Number Path' },

  // Misc
  paused:           { tr: 'Duraklatıldı', en: 'Paused' },
  resume:           { tr: 'Devam et', en: 'Resume' },
  sound:            { tr: 'Ses', en: 'Sound' },
  reset_save:       { tr: 'Kaydı sıfırla', en: 'Reset save' },
};
