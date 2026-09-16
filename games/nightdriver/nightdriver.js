/* ===== 00-tokens.js ===== */
/* NIGHT LINE — colour + size tokens. Re-theme the whole game from this file. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  NL.tokens = {
    // ground
    bg:          '#04050a',
    sky0:        '#04050a',
    sky1:        '#0a0f1c',
    horizonGlow: 'rgba(80,120,190,0.10)',

    // road
    roadFill:    '#12151c',
    roadFillFar: '#090b10',
    shoulder:    '#0c0e14',
    laneMark:    '#707892',
    edgeLine:    '#6f7890',
    edgeWarn:    '#ffb347',
    barrier:     '#4a5266',
    barrierWarn: '#ff8a3d',

    // lane signage — self-lit posts marking which lane(s) ahead are blocked
    laneClear:  '#2d6b78',
    laneWarn:   '#ffb347',
    laneHot:    '#ff5a3d',

    // pickups
    pickupPower:  '#ffd166',

    // car — concept-art palette: neon purple/pink/yellow over black, drawn as
    // flat blocky panels (no gradients, no photo asset) to match the rest of
    // the world's chunky vector vehicles
    carPurple:  '#8b2fe0',
    carPurple2: '#5c1aa8',       // shaded panel, same hue, one step darker
    carPink:    '#ff2f8f',
    carYellow:  '#ffd400',
    carGlass:   '#0a0710',
    carShadow:  '#05070c',
    headlight: '255,206,140',   // rgb triplet for the cone

    // the shield — a run-of-clean-dodges reward, not a random pickup
    shieldCharge: '#c08cff',
    shieldReady:  '#7ef2ff',

    // danger — reserved exclusively for obstacles + low power
    hazard:     '#ff4a35',
    hazardDark: '#5e1a12',
    hazardBody: '#8f2a1c',        // bulk of a large hazard — reads as mass, not as paint
    hazardTape: 'rgba(255,232,196,0.92)', // retro-reflective stripe: the part the beam finds first
    ped:        '#ffe6c4',

    // environment
    desertFar:  '#191410',
    desertNear: '#241c14',
    cityFar:    '#0d1018',
    cityNear:   '#141a26',
    cityWindow: 'rgba(255,214,150,0.55)',

    // ui
    hudDim:    'rgba(214,228,255,0.30)',
    hudMid:    'rgba(214,228,255,0.55)',
    hudBright: '#e8f1ff',
    hudWarn:   '#ff4a35'
  };
})();

/* ===== 01-config.js ===== */
/* NIGHT LINE — every tunable number lives here.
 *
 * COORDINATE NOTE
 *   x is measured in ROAD-WIDTH UNITS. The road spans centreline ±1.
 *   z is metres ahead. World z increases into the distance; `dist` is the odometer.
 *
 * CONTROL MODEL
 *   The car sits in one of three discrete lanes and steps between them on a
 *   LEFT/RIGHT press — not the old hold-a-rope-to-drift verb. That is what
 *   makes genuinely simultaneous multi-lane hazards possible: a wall can now
 *   block two of the three lanes at once and force an actual choice, and a
 *   run of walls can force a real weave (left, then right, then left).
 *   Fairness now rests on two simple, checkable rules instead of a forward-
 *   simulated verifier: a wall never blocks every lane, and every wall gives
 *   at least `reactionFloorSeconds` of warning at the speed it arrives.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  var cfg = {
    /* ---- speed (GDD 6) ---- */
    speedStart: 92,          // m/s
    speedMax: 300,           // ~3.3x cap
    speedRampSeconds: 170,   // 3:15 of continuous climb — the pull should be felt, not inferred

    /* ---- geometry, road-width units ---- */
    carHalfWidth: 0.09,
    carLengthZ: 4,           // metres, for collision
    laneHalfWidth: 0.145,     // lanes span +-0.51 of a +-1 road; the rest is shoulder
    laneCentres: [-0.29, 0, 0.29],
    get edgeSafe() { return 1 - this.carHalfWidth; },   // 0.89: where the barrier stripe sits

    /* ---- lane stepping (replaces the old rope/drift verb) ---- */
    laneChangeTau: 0.16,     // s to reach full slide toward the new lane — the car still has mass
    laneStepCooldown: 0.12,  // debounce: a held arrow key steps one lane, not one per frame
    slipNormalize: 1.8,      // realised vx at a lane change's peak speed, for the lean/skid visuals
    skidThreshold: 0.5,      // |vx| above which the tyres leave a mark

    /* ---- reaction window (GDD 3.5.4 floor, kept) ---- */
    // How far ahead (in seconds at the wall's own arrival speed) a lane-warning
    // post must stand. Starts generous, tightens toward the hard floor as the
    // run goes on — speed itself is what makes it feel tighter, not a clock.
    reactionStartSeconds: 2.6,
    reactionEndSeconds: 1.5,
    reactionFloorSeconds: 1.1,
    reactionRampSeconds: 200,   // run time over which reaction time tightens to its floor

    /* ---- pacing ---- */
    wallMinGapSeconds: 1.4,     // clear road between the back of one wall and the front of the next
    twoLaneChance: { start: 0.10, end: 0.42 },   // odds a wall demands one exact lane, not "any but one"
    weaveChance: 0.30,          // odds a second wall chains close enough to demand a further step
    warmUpSeconds: 10,          // first-run forgiveness: single-lane walls only, wide open reaction

    /* ---- hazards ---- */
    obstacleLen: { vehicle: 6, works: 7, pothole: 3, debris: 3, ped: 4,
                   truck: 13, cones: 10, wreck: 9, crate: 3.5, sign: 2 },
    obstacleHeight: { vehicle: 0.30, works: 0.26, pothole: 0.02, debris: 0.12, ped: 0.34,
                      truck: 0.52, cones: 0.13, wreck: 0.33, crate: 0.22, sign: 0.42 },

    /* ---- curves ---- */
    // Purely cosmetic now — the lane grid tracks the centreline through a
    // bend, so a curve costs nothing to survive. It exists for visual
    // variety only, on its own timer, independent of hazard placement.
    curveDelta: { slight: 0.55, medium: 0.85, sharp: 1.2 },
    curveEaseRamp: 0.26,     // transition length at each end of a corner, 0..0.5
    bendArcMetres: 230,      // distance over which a bend's displacement doubles on screen
    curveEverySeconds: 14,   // roughly one ambient bend this often
    curveLengthSeconds: 3.2, // how long (at arrival speed) a bend takes to resolve on screen

    /* ---- the shield — a streak-earned reward, not a random pickup ---- */
    shieldStreakToCharge: 6,     // consecutive clean wall-clears to fill it
    shieldChargePerClear: 1,     // discrete "pips" filled per clean clear (see streakForShield)

    /* ---- light (GDD 7) ---- */
    lightFullSeconds: 1.90,   // seconds of road visible at power 1
    lightZeroSeconds: 0.55,  // at power 0 — hard, never blind. Wider gap from
    // full than before: low power is meant to be FELT, not just read off a bar.
    lightFloorMetres: 105,
    powerDrainPerSec: 1 / 38,
    powerPickup: 0.50,
    powerEveryNWalls: 4,      // a collectible orb rides in the open lane roughly this often
    lowPowerWarn: 0.25,

    /* ---- feedback ---- */
    nearMissGap: 0.13,       // clearance under this reads as a near miss
    speedTierStep: 25,       // m/s between "you are going faster now" beats

    /* ---- render ---- */
    zRef: 24,                // perspective falloff constant: lower = the world rushes at you
    /* Field of view vs viewport size. Scaling the scene linearly with the window
     * means a larger display shows the SAME world bigger — identical framing,
     * identical texture crossings per second — so a big screen reads as a slow
     * picture. A bigger viewport should show MORE world instead. */
    fovRefHeight: 720,
    fovExponent: 0.32,
    fovMin: 0.72,
    fovMax: 1.12,
    horizonFrac: 0.27,      // less dead sky, more road: the vertical travel is the speed cue
    horizonFracTall: 0.20,
    carYFrac: 0.85,
    carYFracTall: 0.87,
    roadHalfPxFracWide: 0.38,
    roadHalfPxFracTall: 0.44,
    camFollow: 0.5,          // how much of the car's road offset the camera keeps
    // Road shape, visual only. Applied identically to every object at a given z,
    // so it pans the world with the road without touching collision or timing.
    /* Motion budget. Large lateral swings in the far field and fast strobing in
     * the periphery are the two things that make a driving view uncomfortable to
     * look at, so both are kept deliberately low. The road still curves; it just
     * does not swing the horizon around while it does. */
    // Curves now move the centreline much further in world terms, so this comes
    // down to keep the on-screen sweep where the comfort pass left it.
    bendAmplify: 0.78,       // how much harder a real curve reads than its lateral demand
    wanderAmp: 0.34,         // the road is never dead straight
    wanderSpacing: 1500,     // metres between heading control points (long, so it winds)
    wanderSpacing2: 640,
    wanderAmp2: 0.18,
    bendClamp: 1.95,         // soft saturation, not a hard cut
    sceneryBend: 0.45,       // distant scenery swings less than the road it stands beside
    camYaw: 0.45,            // camera barely turns; the horizon should stay put
    camYawTau: 0.70,
    camLookSeconds: 1.2,

    /* Spacing of repeating roadside detail, in metres. These set how fast things
     * flicker past in the periphery: at 200 m/s a 11 m spacing is 18 Hz, which is
     * genuinely unpleasant. Everything here is kept under ~10 Hz at top speed. */
    dashPeriod: 14,
    dashLen: 11,             // long dash, short gap: streams like a line, does not blink
    // Fine surface texture. This is where the sense of speed actually comes from:
    // it is dense enough to fill the mid-distance with movement, but irregularly
    // spaced and low-contrast, so it produces flow without a flicker frequency.
    grainSpacing: 7.5,
    grainCount: 150,
    grainAlpha: 0.52,
    streakSpeed: 105,        // m/s above which near-field motion streaks appear
    barrierPeriod: 28,
    reflectorPeriod: 32,
    buildingPeriod: 120,
    postSpacing: 50,         // unlit reflector posts, metres
    roadsideOffset: 1.25     // how far beyond the road edge roadside posts + lane-warning signs stand
  };

  NL.cfg = cfg;

  NL.speedAt = function (t) {
    var k = t / cfg.speedRampSeconds;
    if (k > 1) k = 1;
    return cfg.speedStart + (cfg.speedMax - cfg.speedStart) * k;
  };

  // speed fraction 0..1 between start and cap
  NL.speedK = function (speed) {
    var k = (speed - cfg.speedStart) / (cfg.speedMax - cfg.speedStart);
    return Math.max(0, Math.min(1, k));
  };

  /* How much warning a wall gives, in seconds at the speed it arrives — the
   * hard-floor reaction-window rule, carried over from the rope design but
   * now driving where the warning post stands instead of where the rope's
   * throw window opens. Never crosses the floor: a wall you cannot react to
   * is a coin flip, not difficulty. */
  NL.reactionSecondsAt = function (t, speed) {
    var k = Math.min(1, t / cfg.reactionRampSeconds);
    var bySpeed = NL.speedK(speed === undefined ? cfg.speedStart : speed);
    // both the run clock AND the current speed tighten it; whichever has
    // tightened further wins, so a slow start never hides behind late-run ease
    var target = cfg.reactionStartSeconds +
      (cfg.reactionEndSeconds - cfg.reactionStartSeconds) * Math.max(k, bySpeed);
    return Math.max(cfg.reactionFloorSeconds, target);
  };

  NL.twoLaneChanceAt = function (t) {
    var k = Math.min(1, t / cfg.reactionRampSeconds);
    return cfg.twoLaneChance.start + (cfg.twoLaneChance.end - cfg.twoLaneChance.start) * k;
  };
})();

/* ===== 02-util.js ===== */
/* NIGHT LINE — small helpers. No DOM in this file. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  NL.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  NL.lerp = function (a, b, t) { return a + (b - a) * t; };
  NL.smoothstep = function (t) { t = NL.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /* Corner profile.
   *
   * smoothstep's rate is a bell: it peaks hard in the middle and is zero at both
   * ends, so the road reads as a quick jink between two straights. A real corner
   * eases in, holds a steady arc, and eases out. arcEase is the integral of that
   * trapezoidal rate — a short transition at each end and a sustained middle.
   *
   * It is also flatter at the peak (1.33x its average against smoothstep's 1.5x),
   * which matters for more than looks: the car drifts at a CONSTANT rate, so the
   * closer the road's rate is to constant, the better a single steady hold tracks
   * it. Rounder to look at and truer to hold.
   */
  NL.arcEase = function (t, ramp) {
    t = NL.clamp(t, 0, 1);
    var r = ramp || NL.cfg.curveEaseRamp;
    var A = 1 - r;                       // area under the rate profile
    if (t < r) return (t * t / (2 * r)) / A;
    if (t < 1 - r) return (r / 2 + (t - r)) / A;
    var v = 1 - t;
    return (A - v * v / (2 * r)) / A;
  };

  // d(arcEase)/dt — the road's turn rate, normalised
  NL.arcEaseRate = function (t, ramp) {
    if (t <= 0 || t >= 1) return 0;
    var r = ramp || NL.cfg.curveEaseRamp;
    var A = 1 - r;
    if (t < r) return (t / r) / A;
    if (t < 1 - r) return 1 / A;
    return ((1 - t) / r) / A;
  };
  NL.sign = function (v) { return v < 0 ? -1 : 1; };

  // mulberry32 — small, fast, deterministic
  NL.makeRng = function (seed) {
    var a = seed >>> 0;
    var fn = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.range = function (lo, hi) { return lo + fn() * (hi - lo); };
    fn.int = function (lo, hi) { return Math.floor(lo + fn() * (hi - lo + 1)); };
    fn.pick = function (arr) { return arr[Math.floor(fn() * arr.length)]; };
    // weighted pick: entries are [value, weight]
    fn.weighted = function (entries) {
      var total = 0, i;
      for (i = 0; i < entries.length; i++) total += entries[i][1];
      var r = fn() * total;
      for (i = 0; i < entries.length; i++) {
        r -= entries[i][1];
        if (r <= 0) return entries[i][0];
      }
      return entries[entries.length - 1][0];
    };
    return fn;
  };

  /* ---------------------------------------------------------------------
   * LANE STEPPING. One integrator, used by the live sim (07) — the car's
   * lane index changes instantly on a press, but its on-screen x eases
   * toward that lane's centre over `laneChangeTau`, so a step still reads
   * as a car with mass sliding across, not a snap-cut. `vx` is the realised
   * screen velocity of that ease, reused for the lean/skid visuals exactly
   * as the old rope-drift velocity was.
   * ------------------------------------------------------------------- */
  NL.laneStep = function (st, targetX, dt) {
    var k = 1 - Math.exp(-dt / NL.cfg.laneChangeTau);
    var prevX = st.x;
    st.x += (targetX - st.x) * k;
    st.vx = (st.x - prevX) / Math.max(dt, 1e-4);
  };
})();

/* ===== 03-input.js ===== */
/* NIGHT LINE — two buttons: LEFT and RIGHT step one lane over. Driven by the
 * shared shell's InputManager (keyboard arrows + the two on-screen circles
 * both feed shell.input), rather than owning its own DOM listeners.
 *
 * Each press is a single discrete step, not a hold — shell.input.wasPressed()
 * already consumes a tap exactly once, which is exactly the shape a lane
 * change needs. sync() is polled once per real frame (see 12-game), and
 * queues the step for the sim's fixed-timestep loop to consume on its first
 * sub-step, the same queued-press pattern the old one-button input used. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  NL.input = {
    stepLeft: false,
    stepRight: false,
    _qLeft: false,
    _qRight: false
  };

  NL.input.beginFrame = function () {
    var i = NL.input;
    i.stepLeft = i._qLeft;
    i.stepRight = i._qRight;
    i._qLeft = false;
    i._qRight = false;
  };

  NL.input.sync = function (shell) {
    var i = NL.input;
    if (shell.input.wasPressed('left')) { i._qLeft = true; if (NL.audio && NL.audio.unlock) NL.audio.unlock(); }
    if (shell.input.wasPressed('right')) { i._qRight = true; if (NL.audio && NL.audio.unlock) NL.audio.unlock(); }
  };
})();

/* ===== 04-road.js ===== */
/* NIGHT LINE — the road centreline.
 *
 * The road is straight-ahead in z; what moves is its lateral centre, c(z).
 * A curve is a segment that shifts the centre by deltaX over `length` metres,
 * with a smoothstep profile so entries and exits are gentle.
 *
 * The car is never moved by a curve — a bend is applied identically to every
 * object at a given z (obstacles, lane centres, scenery) and costs nothing to
 * survive; it exists purely so the road doesn't feel like a straight ruler
 * for three minutes straight. See 06-generator for how bends are now placed
 * on their own timer, independent of hazard walls.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  NL.road = {
    // lateral centre of the road at world-z
    centreAt: function (world, z) {
      var x = world.baseX;
      var cs = world.curves;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (z <= c.zStart) continue;
        if (z >= c.zStart + c.length) { x += c.deltaX; continue; }
        x += c.deltaX * NL.arcEase((z - c.zStart) / c.length);
      }
      return x;
    },

    // d(centre)/dz — used for the "is the road turning under me" feel
    slopeAt: function (world, z) {
      var s = 0;
      var cs = world.curves;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (z <= c.zStart || z >= c.zStart + c.length) continue;
        var u = (z - c.zStart) / c.length;
        s += c.deltaX * NL.arcEaseRate(u) / c.length;
      }
      return s;
    },

    activeCurveAt: function (world, z) {
      var cs = world.curves;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (z >= c.zStart && z <= c.zStart + c.length) return c;
      }
      return null;
    },

    // Fold finished curves into baseX so the list stays short and centreAt stays cheap.
    prune: function (world) {
      var keep = [];
      for (var i = 0; i < world.curves.length; i++) {
        var c = world.curves[i];
        if (c.zStart + c.length < world.dist - 400) world.baseX += c.deltaX;
        else keep.push(c);
      }
      world.curves = keep;
    },

    /* ---------------------------------------------------------------------
     * ROAD DIRECTION — a seeded, endless, smoothly winding heading.
     *
     * Two octaves of value noise over control points, hashed from the world seed,
     * so every run gets a different road and the same seed always gets the same
     * one. Wavelengths are long on purpose (1500 m and 640 m): a real road takes
     * many seconds to swing through a bend. Short wavelengths here were what made
     * the distance shimmer instead of curve.
     *
     * This is the road's SHAPE, applied visually to everything at a given z. The
     * lateral demand the player must actually answer comes from the authored
     * curves in 06 — see the note over sx() in 09-render.
     * ------------------------------------------------------------------- */
    wanderNode: function (world, i) {
      var h = (i * 374761393 + (world.seed | 0) * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296 * 2 - 1;
    },

    wanderAt: function (world, z) {
      var cfg = NL.cfg, r = NL.road, out = 0;
      var i = Math.floor(z / cfg.wanderSpacing);
      out += NL.lerp(r.wanderNode(world, i), r.wanderNode(world, i + 1),
                     NL.smoothstep(z / cfg.wanderSpacing - i)) * cfg.wanderAmp;
      var j = Math.floor(z / cfg.wanderSpacing2);
      out += NL.lerp(r.wanderNode(world, j + 7919), r.wanderNode(world, j + 7920),
                     NL.smoothstep(z / cfg.wanderSpacing2 - j)) * cfg.wanderAmp2;
      return out;
    },

    // Which environment set is beside the road here. Blended over 100 m.
    envAt: function (world, z) {
      var period = world.envPeriod;
      var k = z / period;
      var idx = Math.floor(k);
      var frac = k - idx;
      var setA = world.envSets[((idx % world.envSets.length) + world.envSets.length) % world.envSets.length];
      var setB = world.envSets[(((idx + 1) % world.envSets.length) + world.envSets.length) % world.envSets.length];
      var blendZone = 100 / period;
      var t = frac > 1 - blendZone ? (frac - (1 - blendZone)) / blendZone : 0;
      return { a: setA, b: setB, t: t };
    }
  };
})();

/* ===== 05-entities.js ===== */
/* NIGHT LINE — entity factories. Plain data; all behaviour lives in the sim. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg;

  var nextId = 1;

  NL.makeObstacle = function (opts) {
    return {
      id: nextId++,
      kind: opts.kind,                 // vehicle | works | pothole | debris | ped
      z0: opts.z0,                     // near edge, world z
      len: opts.len !== undefined ? opts.len : cfg.obstacleLen[opts.kind],
      height: cfg.obstacleHeight[opts.kind],
      lanes: opts.lanes,               // ['L','C'] etc, for debug/readability
      lo: opts.lo,                     // blocked lateral span, centreline-relative
      hi: opts.hi,
      eventId: opts.eventId,
      phase: opts.phase || 0,          // pedestrian walk offset
      minGap: undefined,               // closest lateral clearance during the pass
      missSide: 0,
      settled: false
    };
  };

  // A lane-warning post: self-lit, standing beside one blocked lane of a wall,
  // lit through the darkness the same way the old rope anchor was — so which
  // lane(s) are closing is always the first thing you learn about a wall,
  // never something the beam has to find on its own.
  NL.makeLaneWarning = function (opts) {
    return {
      id: nextId++,
      z: opts.z,           // world z the post stands at — ahead of the wall by the reaction lead
      lane: opts.lane,     // which lane index (0/1/2) this post is warning about
      wallId: opts.wallId,
      passed: false
    };
  };

  // A collectible power orb, driven over directly (no button) in whichever
  // lane it rides in.
  NL.makePickup = function (opts) {
    return { id: nextId++, z: opts.z, lane: opts.lane, collected: false };
  };
})();

/* ===== 06-generator.js ===== */
/* NIGHT LINE — wall generator.
 *
 * Fairness now rests on two rules simple enough to check by inspection
 * instead of forward-simulating a verifier:
 *   1. a wall never blocks every lane — there is always at least one lane
 *      open at any given z.
 *   2. every wall's lane-warning post stands at least reactionFloorSeconds
 *      ahead of it, at the speed it will actually arrive.
 * A "wall" blocks either one lane (open choice: either of the other two) or
 * two lanes (forced choice: the one lane left open) — that is what makes the
 * choice sometimes trivial and sometimes exact. Two walls can also chain
 * close enough to force a second, different lane — a real weave.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg;

  var KIND_WEIGHTS = [['vehicle', 20], ['debris', 13], ['pothole', 11], ['ped', 8],
                      ['truck', 12], ['crate', 10], ['sign', 8], ['cones', 8]];
  var LANE_LETTER = ['L', 'C', 'R'];

  function laneSpan(lane) {
    var c = cfg.laneCentres[lane], h = cfg.laneHalfWidth;
    return [c - h, c + h];
  }

  /* Which lanes a wall blocks.
   *
   * A two-lane wall ALWAYS blocks the two outer lanes (0 and 2), leaving the
   * MIDDLE open — never an outer lane. That is not an aesthetic choice: the
   * car moves one lane per press, so reaching an open OUTER lane from the
   * opposite outer lane would mean physically crossing the middle lane's own
   * x-range while it is blocked — an unannounced, unavoidable hit no press
   * timing could fix. The middle is reachable from either outer lane in one
   * direct step with nothing in between, so it is the only two-blocked
   * pattern that is fair from every starting lane. `forceLane`, when given
   * to a single-lane wall, pins which lane it blocks — used to chain a
   * second wall onto the middle right after a two-lane wall forced the car
   * there, for a real two-step weave that is still provably safe. */
  function pickBlocked(rng, twoLane, forceLane) {
    if (twoLane) return [0, 2];
    if (forceLane !== undefined) return [forceLane];
    return [rng.int(0, 2)];
  }

  function spawnWall(world, z, vArr, twoLane, forceLane) {
    var blocked = pickBlocked(world.rng, twoLane, forceLane);
    var openLanes = [];
    for (var l = 0; l < 3; l++) if (blocked.indexOf(l) < 0) openLanes.push(l);

    var wallId = ++world.wallCount;
    var maxLen = 0;
    for (var i = 0; i < blocked.length; i++) {
      var lane = blocked[i];
      var kind = world.rng.weighted(KIND_WEIGHTS);
      var len = cfg.obstacleLen[kind] * (0.85 + world.rng() * 0.35);
      var span = laneSpan(lane);
      world.obstacles.push(NL.makeObstacle({
        kind: kind, z0: z, len: len, lanes: [LANE_LETTER[lane]],
        lo: span[0], hi: span[1], eventId: wallId, phase: world.rng()
      }));
      if (len > maxLen) maxLen = len;
    }

    var reactionSeconds = NL.reactionSecondsAt(world.time, vArr);
    var postZ = z - vArr * reactionSeconds;
    for (var j = 0; j < blocked.length; j++) {
      world.warnings.push(NL.makeLaneWarning({ z: postZ, lane: blocked[j], wallId: wallId }));
    }

    world.wallsSinceP++;
    if (world.wallsSinceP >= cfg.powerEveryNWalls && openLanes.length) {
      world.wallsSinceP = 0;
      var pickLane = openLanes[world.rng.int(0, openLanes.length - 1)];
      world.pickups.push(NL.makePickup({ z: z + maxLen * 0.4, lane: pickLane }));
    }

    world.walls.push({ id: wallId, z: z, len: maxLen, openLanes: openLanes, blockedCount: blocked.length, settledCount: 0, graded: false });
    return { z: z, len: maxLen, openLanes: openLanes };
  }

  // Ambient bends only — visual variety, no gameplay stake (see 04-road).
  function stepCurves(world) {
    if (world.time < world.nextCurveAt) return;
    var severity = world.rng.weighted([['slight', 50], ['medium', 35], ['sharp', 15]]);
    var mag = cfg.curveDelta[severity];
    var dir = (world.lastCurveDir && world.rng() < 0.6) ? -world.lastCurveDir : (world.rng() < 0.5 ? -1 : 1);
    var lengthM = Math.max(140, world.speed * cfg.curveLengthSeconds);
    var zStart = world.dist + world.speed * 3;
    world.curves.push({ zStart: zStart, length: lengthM, deltaX: mag * dir, severity: severity });
    world.lastCurveDir = dir;
    world.nextCurveAt = world.time + cfg.curveEverySeconds * (0.7 + world.rng() * 0.6);
  }

  NL.generator = {
    step: function (world) {
      var ahead = world.speed * 6 + 260;
      var guard = 0;
      while (world.nextZ < world.dist + ahead && guard++ < 20) {
        var z = world.nextZ;
        var tt = (z - world.dist) / Math.max(world.speed, 1);
        var vArr = NL.speedAt(world.time + tt);
        var warmUp = world.time < cfg.warmUpSeconds;
        var twoLane = !warmUp && world.rng() < NL.twoLaneChanceAt(world.time);

        var wall = spawnWall(world, z, vArr, twoLane, undefined);

        // A weave: right after a two-lane wall forces the car onto the
        // middle, chain a single-lane wall that blocks exactly the middle —
        // forcing a second, real step back off it. Both halves stay within
        // the always-safe patterns above; only their timing gets tighter.
        var chain = !warmUp && twoLane && world.rng() < cfg.weaveChance;
        if (chain) {
          var gapM = vArr * (1.0 + world.rng() * 0.5);
          var z2 = z + wall.len + gapM;
          var tt2 = (z2 - world.dist) / Math.max(world.speed, 1);
          var vArr2 = NL.speedAt(world.time + tt2);
          var wall2 = spawnWall(world, z2, vArr2, false, 1);
          world.nextZ = z2 + wall2.len + vArr2 * cfg.wallMinGapSeconds;
        } else {
          world.nextZ = z + wall.len + vArr * cfg.wallMinGapSeconds;
        }
      }
      stepCurves(world);
    }
  };
})();

/* ===== 07-sim.js ===== */
/* NIGHT LINE — the simulation. No DOM, no rendering, fully deterministic. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg;

  NL.createWorld = function (seed) {
    var world = {
      seed: seed >>> 0,
      rng: NL.makeRng(seed >>> 0),
      time: 0,
      dist: 0,
      speed: cfg.speedStart,

      car: { lane: 1, x: cfg.laneCentres[1], vx: 0, lean: 0, slip: 0 },

      baseX: 0,
      curves: [],
      lastCurveDir: 0,
      nextCurveAt: 6,

      obstacles: [],
      warnings: [],
      pickups: [],
      walls: [],
      wallCount: 0,
      wallsSinceP: 0,
      nextZ: 240,
      pruneAt: 0,

      power: 1,

      score: 0,
      alive: true,
      deathCause: null,
      deathAt: null,
      shake: 0,
      flash: 0,

      envSets: ['desert', 'city'],
      envPeriod: 900,

      cleared: 0,
      streak: 0,
      streakBest: 0,
      streakPulse: 0,

      // The shield: a run of clean, exact-lane clears fills it; once ready it
      // silently absorbs the next hit instead of ending the run.
      shield: 0,
      shieldReady: false,
      shieldFlash: 0,

      speedTier: 0,
      beatBest: 0,
      skid: [],
      skidAt: 0,
      fx: []
    };
    world.envSets = world.rng() < 0.5 ? ['desert', 'city'] : ['city', 'desert'];
    return world;
  };

  function emit(world, type, data) { world.fx.push({ type: type, data: data || null }); }

  function die(world, cause) {
    if (!world.alive) return;
    world.alive = false;
    world.deathCause = cause;
    world.deathAt = world.time;
    world.shake = 1;
    emit(world, 'crash', cause);
  }

  function chargeShield(world) {
    if (world.shieldReady) return;
    world.shield += cfg.shieldChargePerClear;
    if (world.shield >= cfg.shieldStreakToCharge) {
      world.shield = cfg.shieldStreakToCharge;
      world.shieldReady = true;
      emit(world, 'shield-ready');
    }
  }

  function gradeWall(world, wall) {
    wall.graded = true;
    world.cleared++;
    world.streak++;
    world.streakPulse = 1;
    if (world.streak > world.streakBest) world.streakBest = world.streak;
    if (world.streak === 5 || world.streak === 10 || world.streak % 20 === 0) emit(world, 'streak-mark');
    if (wall.openLanes.length === 1) {   // the hard, exact-lane pattern — the skill signal
      chargeShield(world);
      emit(world, 'wall-clear-hard');
    }
  }

  NL.stepWorld = function (world, dt, input) {
    if (!world.alive) {
      world.shake = Math.max(0, world.shake - dt * 2.2);
      return;
    }

    world.time += dt;
    world.speed = NL.speedAt(world.time);
    world.dist += world.speed * dt;
    world.score = world.time;
    world.shake = Math.max(0, world.shake - dt * 3);
    world.flash = Math.max(0, world.flash - dt * 4);
    world.streakPulse = Math.max(0, world.streakPulse - dt * 2.4);
    world.beatBest = Math.max(0, world.beatBest - dt * 0.7);
    world.shieldFlash = Math.max(0, world.shieldFlash - dt * 2.2);

    var tier = Math.floor((world.speed - cfg.speedStart) / cfg.speedTierStep);
    if (tier > world.speedTier) { world.speedTier = tier; emit(world, 'speed-up'); }

    world.power = Math.max(0, world.power - cfg.powerDrainPerSec * dt);

    NL.generator.step(world);

    /* ---- lane stepping (replaces the rope) ---- */
    var car = world.car;
    if (input.stepLeft) { car.lane = Math.max(0, car.lane - 1); emit(world, 'lane-step'); }
    if (input.stepRight) { car.lane = Math.min(2, car.lane + 1); emit(world, 'lane-step'); }

    var centre = NL.road.centreAt(world, world.dist);
    var targetX = centre + cfg.laneCentres[car.lane];
    NL.laneStep(car, targetX, dt);
    car.slip = NL.clamp(car.vx / cfg.slipNormalize, -1.6, 1.6);
    car.lean = NL.lerp(car.lean, car.slip, Math.min(1, dt * 9));

    if (Math.abs(car.vx) > cfg.skidThreshold && world.dist - world.skidAt > 1.6) {
      world.skidAt = world.dist;
      world.skid.push({ z: world.dist, x: car.x, a: NL.clamp((Math.abs(car.vx) - cfg.skidThreshold) / cfg.slipNormalize, 0, 1) });
      if (world.skid.length > 140) world.skid.shift();
    }

    /* ---- obstacles: collision + clearing ---- */
    var wallById = {};
    for (var wi = 0; wi < world.walls.length; wi++) wallById[world.walls[wi].id] = world.walls[wi];

    for (var i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i];
      if (o.settled) continue;
      if (world.dist >= o.z0 + o.len) {
        o.settled = true;
        var wall = wallById[o.eventId];
        if (wall) {
          wall.settledCount++;
          if (!wall.graded && wall.settledCount >= wall.blockedCount) gradeWall(world, wall);
        }
        continue;
      }
      if (world.dist + cfg.carLengthZ <= o.z0) continue;   // hasn't reached it yet
      var oc = NL.road.centreAt(world, o.z0);
      var lo = oc + o.lo, hi = oc + o.hi;
      if (car.x + cfg.carHalfWidth > lo && car.x - cfg.carHalfWidth < hi) {
        if (world.shieldReady) {
          world.shieldReady = false;
          world.shield = 0;
          world.shieldFlash = 1;
          world.flash = 0.6;
          emit(world, 'shield-save');
          o.settled = true;   // absorbed — passed straight through, never asks twice
        } else {
          die(world, 'obstacle');
          return;
        }
      }
    }

    /* ---- pickups: driven over directly, no button ---- */
    for (var p = 0; p < world.pickups.length; p++) {
      var pk = world.pickups[p];
      if (pk.collected) continue;
      var relZ = pk.z - world.dist;
      if (relZ > -cfg.carLengthZ && relZ < 3) {
        var pc = NL.road.centreAt(world, pk.z) + cfg.laneCentres[pk.lane];
        if (Math.abs(car.x - pc) < cfg.laneHalfWidth) {
          pk.collected = true;
          world.power = Math.min(1, world.power + cfg.powerPickup);
          emit(world, 'pickup-power');
        }
      }
    }

    /* ---- pruning ---- */
    if (world.dist - world.pruneAt > 200) {
      world.pruneAt = world.dist;
      world.obstacles = world.obstacles.filter(function (o2) { return o2.z0 + o2.len > world.dist - 80; });
      world.warnings = world.warnings.filter(function (w) { return w.z > world.dist - 140; });
      world.pickups = world.pickups.filter(function (p2) { return p2.z > world.dist - 80 && !p2.collected; });
      world.walls = world.walls.filter(function (w2) { return w2.z > world.dist - 200; });
      NL.road.prune(world);
    }
  };
})();

/* ===== 08-light.js ===== */
/* NIGHT LINE — visibility.
 *
 * GDD 7.4: the power meter is simultaneously the atmosphere system and the
 * difficulty system. It is protected by keeping VISIBILITY and REACTION TIME
 * completely separate concepts: isResolved() below depends only on light;
 * how far ahead a lane-warning post stands depends only on distance-in-
 * seconds (see NL.reactionSecondsAt, 01-config). Warning posts are self-lit
 * and drawn straight through the darkness, so which lane is closing is
 * always the first thing you learn about a wall.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg;

  NL.light = {
    // Sight is a duration, not a distance. Holding it in seconds means the amount
    // of road you get to read stays constant as speed climbs — the speed itself is
    // felt through how fast that road arrives, not by shrinking your reaction time
    // below the floor that hard authoring rule 3.5.4 protects.
    visibleDistance: function (world) {
      var secs = NL.lerp(cfg.lightZeroSeconds, cfg.lightFullSeconds, world.power);
      return Math.max(cfg.lightFloorMetres, world.speed * secs);
    },

    // how strongly a thing at relative z is lit, 1 near -> 0 at the edge of the cone
    litAmount: function (world, relZ) {
      var v = NL.light.visibleDistance(world);
      if (relZ <= 0) return 1;
      var k = 1 - relZ / v;
      return k > 0 ? k * k : 0;
    },

    isResolved: function (world, relZ) {
      return relZ <= NL.light.visibleDistance(world);
    },

    // cone opening in road units at the far end
    coneHalfWidth: function () { return 1.95; },

    // 0 at dead centre, 1 in an outer lane — purely a cosmetic "which lane
    // are you biased toward" value now (there is no barrier to run out of).
    edgeProximity: function (world) {
      var off = Math.abs(world.car.x - NL.road.centreAt(world, world.dist));
      return NL.clamp(off / cfg.laneCentres[2], 0, 1);
    },

    lowPower: function (world) {
      return world.power < cfg.lowPowerWarn;
    }
  };
})();

/* ===== 09-render.js ===== */
/* NIGHT LINE — rendering.
 *
 * Draw order matters and encodes the design:
 *   sky -> far silhouettes -> road+world -> DARKNESS -> self-lit things -> car -> vignette
 * Anchors, pickups and the car are drawn AFTER the darkness, which is why the
 * anchor stays the brightest object in the frame even at zero headlight power.
 *
 * Everything here is placeholder procedural art. Every drawable is behind a
 * draw*() function so SVG/spritesheet assets can be swapped in locally later.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg, T = NL.tokens;

  var view = {
    W: 0, H: 0, dpr: 1, px: 1, horizonY: 0, carY: 0, roadHalfPx: 0, tall: false
  };
  var canvas, ctx, dark, dctx;
  var NL_roadRelsProbe;
  var lastT = 0, lastDist = 0, frameDt = 0;
  /* Motion scale. 1 = as designed, lower = calmer. Large lateral movement in the
     far field is what makes a view like this hard to look at for long, so it is
     the first thing that comes down — not the driving. */
  var motion = 1;
  var dust = [];

  // The car's own footprint, as a fraction of view.roadHalfPx — shared by
  // beams() (headlight origin), drawCar() (the sprite itself) and drawRope-
  // era code that used to read it off the licensed asset's aspect ratio.
  var CAR_W_FRAC = 0.32;
  var CAR_ASPECT = 1.05;   // height / width, for the new blocky pixel car

  // repeating roadside detail gets denser as the view widens, so the count of
  // things crossing the frame stays roughly constant instead of thinning out
  function spacing(base) { return base * Math.pow(view.fov, 0.6); }

  function hash(i) { var s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); }

  NL.render = {
    // screen position of a road-space point, for the HUD's death frame. `h` is the
    // on-screen height of a post at that distance, so a ring can be sized to it.
    project: function (world, z, x) {
      if (!view.W) return null;
      var rel = z - world.dist;
      if (rel < -12) return null;
      return { x: sx(rel, x), y: sy(rel), h: 0.62 * view.roadHalfPx * sc(rel) };
    },
    view: view,

    setMotion: function (m) { motion = m; },
    getMotion: function () { return motion; },

    init: function (cv) {
      canvas = cv;
      ctx = cv.getContext('2d');
      dark = document.createElement('canvas');
      dctx = dark.getContext('2d');
      NL.render.resize();
    },

    resize: function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      view.W = w; view.H = h; view.dpr = dpr;
      // Smallest feature that still lands on a real device pixel. Everything that
      // has a minimum size clamps to this; it was never assigned, which silently
      // turned those clamps into NaN and dropped the marks entirely.
      view.px = 1 / dpr;
      view.tall = h / w > 1.15;
      // Wider field of view on a bigger viewport, not a bigger picture of the
      // same view. Sub-linear in screen height, so a laptop shows meaningfully
      // more road than a small window and the world moves through it faster.
      view.fov = NL.clamp(Math.pow(cfg.fovRefHeight / h, cfg.fovExponent), cfg.fovMin, cfg.fovMax);
      view.carY = h * (view.tall ? cfg.carYFracTall : cfg.carYFrac);
      view.horizonY = h * (view.tall ? cfg.horizonFracTall : cfg.horizonFrac);
      view.roadHalfPx = w * (view.tall ? cfg.roadHalfPxFracTall : cfg.roadHalfPxFracWide) * view.fov;
      // The light layer carries every soft edge in the game — beam falloff, lamp
      // bloom, ground bounce. It was drawn at half scale and stretched, which is
      // what made those edges mushy. It now runs at device resolution, capped by
      // total pixel count so a retina panel at 1440p does not blow the budget.
      var ds = dpr;
      var maxPx = 3.4e6;
      if (w * h * ds * ds > maxPx) ds = Math.sqrt(maxPx / (w * h));
      view.darkScale = NL.clamp(ds, 0.7, dpr);
      dark.width = Math.max(2, Math.round(w * view.darkScale));
      dark.height = Math.max(2, Math.round(h * view.darkScale));
      dctx.setTransform(view.darkScale, 0, 0, view.darkScale, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    // dev probe: where the road centre this far ahead is actually drawn
    probe: function (rel) { return sx(rel, NL.road.centreAt(NL.game.world, NL.game.world.dist + rel)); },
    probeY: function (rel) { return sy(rel); },
    probeRels: function () { return NL_roadRelsProbe(); },

    frame: function (world, tNow) {
      var dt = NL.clamp(tNow - lastT, 0, 0.1); lastT = tNow;
      var reset = world.dist < lastDist - 1;
      if (reset) { dust.length = 0; yaw = 0; }
      lastDist = world.dist;
      frameDt = reset ? 0 : dt;
      updateDust(world, dt);
      draw(world, tNow);
    }
  };

  /* ---- tyre smoke: only exists while the car is actually sliding ------ */
  function updateDust(world, dt) {
    var slip = Math.abs(world.car.slip || 0);
    if (world.alive && slip > 0.40 && dust.length < 110 * motion) {
      var n = (slip > 0.85 ? 4 : 2) * (motion < 0.6 ? 0.5 : 1);
      for (var i = 0; i < n; i++) {
        dust.push({
          z: world.dist - 1.5 + Math.random() * 2.5,
          x: world.car.x - NL.sign(world.car.vx) * (0.05 + Math.random() * 0.04),
          vx: -world.car.vx * 0.30 + (Math.random() - 0.5) * 0.12,
          r: 0.016 + Math.random() * 0.026,
          life: 1
        });
      }
    }
    for (var j = dust.length - 1; j >= 0; j--) {
      var d = dust[j];
      d.life -= dt * 2.1;
      d.x += d.vx * dt;
      d.r += dt * 0.055;
      if (d.life <= 0 || d.z < world.dist - 70) dust.splice(j, 1);
    }
  }

  /* ---- projection --------------------------------------------------- */
  var camX = 0;
  var zr = cfg.zRef;          // shrinks slightly with speed: the camera pushes in

  /* THE ROAD SHAPE.
   * Perspective alone flattens a bend to nothing: multiplying a lateral offset by
   * the vanishing scale means the far end of a curve converges on the centre of
   * the screen, which reads as a lane change rather than a corner. So the road's
   * own displacement is carried in SCREEN space instead, growing with distance
   * the way a real road swings away from you.
   *
   * It is applied identically to every object at a given z — road, obstacles,
   * anchors, scenery — so it is a camera move, not a gameplay change. Collision,
   * lateral demand and every window in 06 are untouched. It is zero at the car,
   * so what is under your wheels is always drawn truthfully.
   */
  /* The road's screen displacement, computed DIRECTLY — no lookup table.
   *
   * This used to be sampled into 56 buckets spanning 0..relMax, and relMax moves
   * every frame because sight distance now depends on speed and power. So the
   * sample points slid continuously, and reading a curve back out of them through
   * linear interpolation gave a value that wobbled for a stationary object. On a
   * straight the function is near-linear and the error vanished; through a bend it
   * swung — which is exactly where the jitter was reported. Sampling a moving grid
   * is the bug, so there is no grid. */
  var bendC0 = 0, bendW0 = 0, bendWorld = null;

  function beginBend(world) {
    bendWorld = world;
    bendC0 = NL.road.centreAt(world, world.dist);
    bendW0 = NL.road.wanderAt(world, world.dist);
  }

  function bendRaw(rel) {
    if (!bendWorld) return 0;
    var z = bendWorld.dist + rel;
    // A corner's displacement is amplified with distance, so the far end of a bend
    // arcs away from you instead of converging on the centre of the frame. Without
    // this the road reads as a lane shift no matter how round its profile is.
    var arc = 1 + Math.max(0, rel) / cfg.bendArcMetres;
    var u = (cfg.bendAmplify * arc * (NL.road.centreAt(bendWorld, z) - bendC0)
             + (NL.road.wanderAt(bendWorld, z) - bendW0)) * motion;
    // tanh instead of a clamp: bends ease off smoothly instead of hitting a wall
    return cfg.bendClamp * Math.tanh(u / cfg.bendClamp) * view.roadHalfPx;
  }

  // The camera turns into the corner. Without this a hard bend walks the road —
  // and the anchor you need to see — off the side of the screen.
  var yaw = 0;
  function computeYaw(world, dt) {
    var look = Math.max(70, world.speed * cfg.camLookSeconds);
    var lim = view.W * 0.34;
    var target = NL.clamp(-bendRaw(look) * cfg.camYaw, -lim, lim);
    if (dt <= 0 || Math.abs(target - yaw) > lim * 1.6) yaw = target;   // first frame / reset
    else yaw += (target - yaw) * (1 - Math.exp(-dt / cfg.camYawTau));
  }

  function bendAt(rel) { return bendRaw(rel) + yaw; }

  function pOf(rel) {
    if (rel < -zr * 0.6) rel = -zr * 0.6;
    return rel / (rel + zr);
  }
  function sy(rel) { var p = pOf(rel); return view.carY + (view.horizonY - view.carY) * p; }
  function sc(rel) { return 1 - pOf(rel); }
  function sx(rel, x, bendMul) {
    var b = bendAt(rel);
    if (bendMul !== undefined) b *= bendMul;
    return view.W / 2 + (x - camX) * view.roadHalfPx * sc(rel) + b;
  }

  /* ---- main --------------------------------------------------------- */
  function draw(world, tNow) {
    var W = view.W, H = view.H;
    var centre = NL.road.centreAt(world, world.dist);
    camX = centre + cfg.camFollow * (world.car.x - centre);
    zr = cfg.zRef * Math.pow(view.fov, 0.5);

    var vis = NL.light.visibleDistance(world);
    var relMax = vis * 1.12 + 60;
    beginBend(world);
    computeYaw(world, frameDt);

    ctx.save();
    if (world.shake > 0.001) {
      var s = world.shake * 12 * motion;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    ctx.clearRect(-20, -20, W + 40, H + 40);
    drawSky(world, tNow);
    drawFarSilhouettes(world, relMax);
    drawRoad(world, relMax);
    drawRoadside(world, relMax);
    drawSkid(world);
    drawObstacles(world, relMax, tNow);
    drawDust(world);
    drawDarkness(world, vis);
    drawHorizonGlow(world);
    // Reflectors and edge lines are self-lit: the amount of road left must be
    // legible at a glance even at zero headlight power (GDD 4, 3.4).
    drawEdgesLit(world, relMax);
    drawLaneWarnings(world, relMax, tNow);
    drawPickups(world, relMax, tNow);
    drawCar(world, tNow);
    drawShieldBurst(world, tNow);
    drawVignette();
    ctx.restore();
  }

  /* ---- sky ---------------------------------------------------------- */
  function drawSky(world) {
    var g = ctx.createLinearGradient(0, 0, 0, view.horizonY + 40);
    g.addColorStop(0, T.sky0);
    g.addColorStop(1, T.sky1);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, view.W + 40, view.horizonY + 60);
    var g2 = ctx.createLinearGradient(0, view.horizonY - 24, 0, view.horizonY + 90);
    g2.addColorStop(0, T.sky1);
    g2.addColorStop(1, T.bg);
    ctx.fillStyle = g2;
    ctx.fillRect(-20, view.horizonY - 24, view.W + 40, view.H - view.horizonY + 64);
  }

  function drawHorizonGlow(world) {
    var env = NL.road.envAt(world, world.dist);
    var cityness = (env.a === 'city' ? 1 - env.t : env.t) * (env.b === 'city' ? 1 : 1);
    if (env.a === 'city' && env.b === 'city') cityness = 1;
    else if (env.a === 'city') cityness = 1 - env.t;
    else if (env.b === 'city') cityness = env.t;
    else cityness = 0;
    if (cityness <= 0.01) return;
    var g = ctx.createLinearGradient(0, view.horizonY - 70, 0, view.horizonY + 6);
    g.addColorStop(0, 'rgba(120,150,220,0)');
    g.addColorStop(1, 'rgba(150,170,230,' + (0.14 * cityness).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, view.horizonY - 70, view.W, 76);
  }

  /* ---- distant parallax --------------------------------------------- */
  function drawFarSilhouettes(world, relMax) {
    var per = spacing(cfg.buildingPeriod);
    var base = Math.floor(world.dist / per) * per;
    for (var k = 26; k >= 0; k--) {
      var z = base + k * per;
      var rel = z - world.dist;
      if (rel < 220 || rel > relMax + 700) continue;
      if (motion < 0.6 && (Math.round(z / per) & 1)) continue;   // half the skyline
      var env = NL.road.envAt(world, z);
      var set = env.t > 0.5 ? env.b : env.a;
      var s = sc(rel), y = sy(rel);
      // Identity comes from the world slot ONLY. Anything derived from the loop
      // index changes as you drive, which makes the scenery morph underfoot.
      var zi = Math.round(z / per);
      for (var side = -1; side <= 1; side += 2) {
        var h1 = hash(zi * 7.7 + side * 17.3);
        var h2 = hash(zi * 3.3 + side * 31.7);
        var xo = side * (3.0 + h1 * 4.5);
        var px = sx(rel, NL.road.centreAt(world, z) + xo, cfg.sceneryBend);
        if (px < -200 || px > view.W + 200) continue;
        if (set === 'city') {
          var bh = (0.5 + h2 * 1.7) * view.roadHalfPx * s;
          var bw = (0.35 + h1 * 0.5) * view.roadHalfPx * s;
          ctx.fillStyle = T.cityNear;
          ctx.fillRect(px - bw / 2, y - bh, bw, bh);

          /* Windows must be part of the building, not a pattern painted on the
             screen behind it. Row COUNT is hashed per building and never changes;
             row PITCH is a fraction of the building's own height. Sizing either of
             those in screen pixels — as this did — means rows multiply and the grid
             slides upward as the building approaches, which is read as the scenery
             morphing rather than as anything getting closer. */
          var rows = 3 + Math.floor(hash(zi * 2.9 + side * 4.1) * 4);   // 3..6, fixed per building
          if (NL.render._trace) NL.render._trace({ key: zi + ':' + side, bw: bw, bh: bh, rows: rows, px: px });
          var pitch = bh / (rows + 1.4);
          var wh = Math.max(view.px || 1, pitch * 0.34);
          var ww = Math.max(view.px || 1, bw * 0.15);
          var fade = NL.clamp((bw - 2.5) / 6, 0, 1);                    // fade in, never pop
          if (fade > 0.01) {
            ctx.fillStyle = T.cityWindow;
            for (var r = 0; r < rows; r++) {
              if (hash(zi * 11 + r * 13 + side * 5) < 0.42) continue;
              ctx.globalAlpha = (0.25 + 0.3 * hash(zi * 5 + r * 2)) * fade;
              var wy = y - bh + pitch * (r + 0.7) - wh / 2;
              ctx.fillRect(px - bw * 0.26, wy, ww, wh);
              ctx.fillRect(px + bw * 0.11, wy, ww, wh);
            }
            ctx.globalAlpha = 1;
          }
        } else {
          var dh = (0.20 + h2 * 0.55) * view.roadHalfPx * s;
          var dw = (1.1 + h1 * 1.4) * view.roadHalfPx * s;
          ctx.fillStyle = T.desertFar;
          ctx.beginPath();
          ctx.moveTo(px - dw / 2, y);
          ctx.quadraticCurveTo(px, y - dh * 2.0, px + dw / 2, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  /* ---- road --------------------------------------------------------- */
  /* The road mesh is sampled at FIXED distances.
   *
   * It used to spread N samples between the car and the lit distance — and the lit
   * distance moves every frame, because it depends on speed and power. So the
   * vertices slid along the road continuously, and since the polygon joins them
   * with straight lines, the error of that approximation changed every frame. On a
   * straight road it is invisible; through a bend the edges ripple. Same class of
   * bug as the old bend lookup table, still living in the mesh.
   *
   * The schedule below is geometric — dense near, sparse far — and depends only on
   * the viewport. A given vertex sits at the same distance ahead on every frame,
   * so the drawn shape can only change because the road itself changed. */
  var roadRels = null, roadRelsZr = -1;

  function buildRoadRels() {
    roadRels = [-zr * 0.45];
    for (var rel = 3; rel < 2600; rel *= 1.105) roadRels.push(rel);
    roadRelsZr = zr;
  }

  function roadSamples(world, relMax) {
    if (roadRels === null || roadRelsZr !== zr) buildRoadRels();
    var pts = [];
    for (var i = 0; i < roadRels.length; i++) {
      var rel = roadRels[i];
      if (rel > relMax) break;
      pts.push({ rel: rel, c: NL.road.centreAt(world, world.dist + rel), y: sy(rel), s: sc(rel) });
    }
    return pts;
  }

  NL_roadRelsProbe = function () { return roadRels ? roadRels.slice(0, 12) : null; };

  function drawRoad(world, relMax) {
    var pts = roadSamples(world, relMax);
    var i;

    // surface
    ctx.beginPath();
    ctx.moveTo(sx(pts[0].rel, pts[0].c - 1), pts[0].y);
    for (i = 1; i < pts.length; i++) ctx.lineTo(sx(pts[i].rel, pts[i].c - 1), pts[i].y);
    for (i = pts.length - 1; i >= 0; i--) ctx.lineTo(sx(pts[i].rel, pts[i].c + 1), pts[i].y);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, view.carY, 0, view.horizonY);
    g.addColorStop(0, T.roadFill);
    g.addColorStop(1, T.roadFillFar);
    ctx.fillStyle = g;
    ctx.fill();

    // shoulder bands, so the amount of road left is legible at a glance
    ctx.fillStyle = T.shoulder;
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      ctx.beginPath();
      for (i = 0; i < pts.length; i++) ctx.lineTo(sx(pts[i].rel, pts[i].c + sgn * 0.62), pts[i].y);
      for (i = pts.length - 1; i >= 0; i--) ctx.lineTo(sx(pts[i].rel, pts[i].c + sgn * 1.0), pts[i].y);
      ctx.closePath();
      ctx.fill();
    }

    drawGrain(world, relMax);
    drawDashes(world, relMax);
    drawStreaks(world, relMax);
  }

  /* Surface grain — the main reason the road reads as moving.
   * Discrete roadside furniture had to be thinned out for comfort, and that took
   * most of the sense of speed with it. This puts the movement back as texture
   * rather than as more blinking objects: irregular spacing means no strobe
   * frequency, and low contrast means it never fights the hazards for attention. */
  function drawGrain(world, relMax) {
    var step = spacing(cfg.grainSpacing);
    var base = Math.floor(world.dist / step) * step;
    var far = Math.min(relMax, NL.light.visibleDistance(world) * 1.05);
    ctx.fillStyle = '#ffffff';
    for (var k = 0; k < cfg.grainCount; k++) {
      var zi = Math.round(base / step) + k;
      var jitter = (hash(zi * 1.7) - 0.5) * step * 0.9;      // no regular period
      var z = zi * step + jitter;
      var rel = z - world.dist;
      if (rel < 0.5 || rel > far) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel);
      var lx = (hash(zi * 5.3) * 2 - 1) * 0.94;
      var px = sx(rel, c + lx);
      if (px < -20 || px > view.W + 20) continue;
      var lit = Math.sqrt(NL.light.litAmount(world, rel));
      var a = cfg.grainAlpha * lit * (0.45 + 0.55 * hash(zi * 9.1));
      if (a < 0.012) continue;
      ctx.globalAlpha = a;
      var h = Math.max(view.px, 0.028 * view.roadHalfPx * s);
      ctx.fillRect(px, sy(rel) - h, Math.max(view.px, 0.016 * view.roadHalfPx * s), h);
    }
    ctx.globalAlpha = 1;
  }

  /* Near-field motion streaks: only above a speed, only where flow is fastest. */
  function drawStreaks(world, relMax) {
    if (world.speed < cfg.streakSpeed) return;
    var k = NL.clamp((world.speed - cfg.streakSpeed) / (cfg.speedMax - cfg.streakSpeed), 0, 1);
    var step = spacing(11);
    var base = Math.floor(world.dist / step) * step;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'butt';
    for (var i = 0; i < 26; i++) {
      var zi = Math.round(base / step) + i;
      var z = zi * step + (hash(zi * 2.3) - 0.5) * step;
      var rel0 = z - world.dist;
      if (rel0 < 0.5 || rel0 > 46) continue;
      var rel1 = rel0 + world.speed * 0.035;
      var c0 = NL.road.centreAt(world, z);
      var lx = (hash(zi * 7.9) * 2 - 1) * 0.92;
      ctx.globalAlpha = 0.16 * k * NL.light.litAmount(world, rel0);
      ctx.lineWidth = Math.max(view.px, 0.010 * view.roadHalfPx * sc(rel0));
      ctx.beginPath();
      ctx.moveTo(sx(rel0, c0 + lx), sy(rel0));
      ctx.lineTo(sx(rel1, NL.road.centreAt(world, z + world.speed * 0.035) + lx), sy(rel1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* Self-lit road boundary: edge lines, cat's-eye reflectors and the barrier.
     Always faintly readable, at a constant brightness — there is no longer a
     way to run out of road by steering, so this is atmosphere, not warning. */
  function drawEdgesLit(world, relMax) {
    var pts = roadSamples(world, Math.min(relMax, NL.light.visibleDistance(world) * 1.2 + 90));
    drawEdgeLines(pts);
    drawBarrier(world, relMax);
    drawReflectors(world, relMax);
  }

  function drawReflectors(world, relMax) {
    var period = spacing(cfg.reflectorPeriod);
    var base = Math.floor(world.dist / period) * period;
    for (var k = 0; k < 40; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < -10 || rel > relMax) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var r = Math.max(1, 0.016 * view.roadHalfPx * s);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = sx(rel, c + sgn * 0.985);
        if (px < -30 || px > view.W + 30) continue;
        ctx.globalAlpha = NL.clamp(0.30 - rel / (relMax * 1.6), 0.05, 0.95);
        ctx.fillStyle = 'rgba(255,236,200,0.9)';
        ctx.beginPath(); ctx.arc(px, y - r, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDashes(world, relMax) {
    var period = spacing(cfg.dashPeriod), len = spacing(cfg.dashLen);
    var base = Math.floor(world.dist / period) * period;
    ctx.fillStyle = T.laneMark;
    for (var k = 0; k < 46; k++) {
      var z0 = base + k * period, rel0 = z0 - world.dist, rel1 = rel0 + len;
      if (rel1 < 0 || rel0 > relMax) continue;
      var c0 = NL.road.centreAt(world, z0), c1 = NL.road.centreAt(world, z0 + len);
      var a = NL.clamp(1 - rel0 / (relMax * 0.9), 0.08, 0.75);
      ctx.globalAlpha = a;
      for (var m = 0; m < 2; m++) {
        var lx = m === 0 ? -0.20 : 0.20;
        var w0 = 0.018 * view.roadHalfPx * sc(rel0), w1 = 0.018 * view.roadHalfPx * sc(rel1);
        ctx.beginPath();
        ctx.moveTo(sx(rel0, c0 + lx) - w0, sy(rel0));
        ctx.lineTo(sx(rel0, c0 + lx) + w0, sy(rel0));
        ctx.lineTo(sx(rel1, c1 + lx) + w1, sy(rel1));
        ctx.lineTo(sx(rel1, c1 + lx) - w1, sy(rel1));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawEdgeLines(pts) {
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var x = sx(pts[i].rel, pts[i].c + sgn * 0.985);
        if (i === 0) ctx.moveTo(x, pts[i].y); else ctx.lineTo(x, pts[i].y);
      }
      ctx.strokeStyle = T.edgeLine;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.30;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawBarrier(world, relMax) {
    var period = spacing(cfg.barrierPeriod);
    var base = Math.floor(world.dist / period) * period;
    for (var k = 0; k < 44; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < 0 || rel > relMax) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var h = 0.20 * view.roadHalfPx * s;
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = sx(rel, c + sgn * 1.06);
        if (px < -60 || px > view.W + 60) continue;
        ctx.fillStyle = T.barrier;
        ctx.globalAlpha = NL.clamp(1 - rel / (relMax * 0.95), 0.1, 0.9);
        ctx.fillRect(px - Math.max(1, 0.02 * view.roadHalfPx * s), y - h, Math.max(2, 0.04 * view.roadHalfPx * s), h);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- roadside scenery (unlit posts: a lane-warning sign reads as "one of these, lit") -- */
  function drawRoadside(world, relMax) {
    var period = spacing(cfg.postSpacing);
    var base = Math.floor(world.dist / period) * period;
    for (var k = 0; k < 30; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < 1 || rel > relMax) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var h = 0.34 * view.roadHalfPx * s;
      var w = Math.max(1.2, 0.022 * view.roadHalfPx * s);
      ctx.globalAlpha = NL.clamp(1 - rel / (relMax * 0.9), 0.05, 0.30);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = sx(rel, c + sgn * cfg.roadsideOffset);
        if (px < -40 || px > view.W + 40) continue;
        ctx.fillStyle = T.barrier;
        ctx.fillRect(px - w / 2, y - h, w, h);
        ctx.fillStyle = 'rgba(255,190,120,0.5)';
        ctx.fillRect(px - w / 2, y - h, w, Math.max(1.5, h * 0.14));
      }
    }
    ctx.globalAlpha = 1;
    drawShoulderClutter(world, relMax);
  }

  /* Things beyond the barrier that mean nothing: a dead car on the verge, a
     drum, a stack of tyres. They are in the ENVIRONMENT palette, never the hazard
     one (GDD 4 reserves that), and they never touch the road. Their only job is
     to keep the beam from ever finding an empty world. Identity is hashed on the
     world slot alone so nothing morphs as it approaches. */
  function drawShoulderClutter(world, relMax) {
    var period = spacing(41);
    var base = Math.floor(world.dist / period) * period;
    for (var k = 0; k < 34; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < 2 || rel > relMax) continue;
      var zi = Math.round(z / period);
      var h1 = hash(zi * 5.13 + 0.7);
      if (h1 < 0.62) continue;                                  // most slots are empty
      var side = hash(zi * 2.71 + 1.3) < 0.5 ? -1 : 1;
      var h2 = hash(zi * 9.17 + side);
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var px = sx(rel, c + side * (cfg.roadsideOffset + 0.22 + h2 * 0.5));
      if (px < -60 || px > view.W + 60) continue;
      var lit = NL.clamp(NL.light.litAmount(world, rel) * 1.3, 0, 1);
      ctx.globalAlpha = 0.18 + 0.55 * lit;
      var kind = h2 < 0.45 ? 0 : (h2 < 0.75 ? 1 : 2);
      var u = view.roadHalfPx * s;
      ctx.fillStyle = T.cityNear;
      if (kind === 0) {                                          // a car left on the verge
        ctx.fillRect(px - u * 0.13, y - u * 0.11, u * 0.26, u * 0.11);
        ctx.fillRect(px - u * 0.08, y - u * 0.18, u * 0.16, u * 0.08);
        ctx.fillStyle = 'rgba(255,190,120,' + (0.35 * lit).toFixed(3) + ')';   // one reflector catches the beam
        ctx.fillRect(px + side * u * 0.09, y - u * 0.08, Math.max(1, u * 0.02), Math.max(1, u * 0.02));
      } else if (kind === 1) {                                   // a drum
        ctx.fillRect(px - u * 0.045, y - u * 0.14, u * 0.09, u * 0.14);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.10 * lit).toFixed(3) + ')';
        ctx.fillRect(px - u * 0.045, y - u * 0.09, u * 0.09, Math.max(1, u * 0.015));
      } else {                                                   // a stack of tyres
        for (var t = 0; t < 3; t++) ctx.fillRect(px - u * (0.07 - t * 0.008), y - u * 0.05 * (t + 1), u * (0.14 - t * 0.016), u * 0.045);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- tyre marks left by the drift ---------------------------------- */
  function drawSkid(world) {
    var k = world.skid;
    if (k.length < 2) return;
    var wOff = cfg.carHalfWidth * 0.66;
    ctx.save();
    for (var lane = -1; lane <= 1; lane += 2) {
      for (var i = 1; i < k.length; i++) {
        var a = k[i - 1], b = k[i];
        var ra = a.z - world.dist, rb = b.z - world.dist;
        if (rb < -70 || ra > 90) continue;
        var wa = Math.max(1.1, 0.040 * view.roadHalfPx * sc(ra));
        var wb = Math.max(1.1, 0.040 * view.roadHalfPx * sc(rb));
        ctx.globalAlpha = 0.62 * Math.min(a.a, b.a) * NL.clamp(1 + ra / 60, 0, 1);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(sx(ra, a.x + lane * wOff) - wa, sy(ra));
        ctx.lineTo(sx(ra, a.x + lane * wOff) + wa, sy(ra));
        ctx.lineTo(sx(rb, b.x + lane * wOff) + wb, sy(rb));
        ctx.lineTo(sx(rb, b.x + lane * wOff) - wb, sy(rb));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawDust(world) {
    ctx.save();
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var rel = d.z - world.dist;
      if (rel < -70 || rel > 40) continue;
      var r = d.r * view.roadHalfPx * sc(rel);
      if (r < 0.6) continue;
      ctx.globalAlpha = 0.13 * d.life * d.life;
      ctx.fillStyle = 'rgba(226,214,196,1)';
      ctx.beginPath();
      ctx.arc(sx(rel, d.x), sy(rel) - r * 0.35, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- obstacles ----------------------------------------------------- */
  function drawObstacles(world, relMax, tNow) {
    var list = world.obstacles.slice().sort(function (a, b) { return b.z0 - a.z0; });
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var rel0 = o.z0 - world.dist, rel1 = rel0 + o.len;
      if (rel1 < -4 || rel0 > relMax) continue;
      var c = NL.road.centreAt(world, o.z0);
      var lo = c + o.lo, hi = c + o.hi;
      var y0 = sy(rel0), y1 = sy(rel1), s0 = sc(rel0);
      var h = o.height * view.roadHalfPx * s0;
      // Linear falloff (litAmount itself is quadratic) so the silhouette starts
      // reading a beat earlier than the quadratic curve gave it — the anchor
      // was reliably the first thing you noticed, the obstacle itself a beat
      // later; this narrows that gap without touching the anchor's own,
      // deliberately distance-independent self-light.
      var fade = NL.clamp(Math.sqrt(NL.light.litAmount(world, rel0)) * 1.15, 0, 1);

      var xl = sx(rel0, lo), xr = sx(rel0, hi);

      // ground footprint — the shadow the thing lays on the tarmac
      ctx.fillStyle = T.hazardDark;
      ctx.globalAlpha = 0.55 * fade + 0.1;
      ctx.beginPath();
      ctx.moveTo(xl, y0); ctx.lineTo(xr, y0);
      ctx.lineTo(sx(rel1, hi), y1); ctx.lineTo(sx(rel1, lo), y1);
      ctx.closePath(); ctx.fill();

      var A = {
        o: o, rel0: rel0, rel1: rel1, lo: lo, hi: hi,
        y0: y0, y1: y1, s0: s0, h: h, fade: fade,
        xl: xl, xr: xr, w: xr - xl, t: tNow
      };
      (SHAPES[o.kind] || drawSlab)(A);
      ctx.globalAlpha = 1;
    }
  }

  /* Every hazard is a silhouette first. At night you see an outline against the
     beam a fraction of a second before you see anything else, so the shapes are
     built to be told apart by outline alone — tall/short, one mass/many pieces,
     square/tapered — and the colour only confirms what the shape already said. */

  function slabPath(A, x0, x1, top) {
    ctx.beginPath();
    ctx.moveTo(x0, A.y0); ctx.lineTo(x1, A.y0);
    ctx.lineTo(x1, top); ctx.lineTo(x0, top);
    ctx.closePath();
  }

  function drawSlab(A) {
    ctx.globalAlpha = 0.85 * A.fade + 0.12;
    ctx.fillStyle = T.hazard;
    slabPath(A, A.xl, A.xr, A.y0 - A.h); ctx.fill();
  }

  // A body with real length: the top face recedes to the far end, which is what
  // separates a truck from a sign at a glance.
  function drawLongBox(A, style, hFrac) {
    var f = hFrac || 1;
    var h0 = A.h * f;
    var h1 = A.o.height * f * view.roadHalfPx * sc(A.rel1);
    var fl = sx(A.rel1, A.lo), fr = sx(A.rel1, A.hi);
    ctx.globalAlpha = 0.5 * A.fade + 0.08;
    ctx.fillStyle = T.hazardDark;
    ctx.beginPath();
    ctx.moveTo(A.xl, A.y0 - h0); ctx.lineTo(A.xr, A.y0 - h0);
    ctx.lineTo(fr, A.y1 - h1); ctx.lineTo(fl, A.y1 - h1);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.85 * A.fade + 0.12;
    ctx.fillStyle = style;
    slabPath(A, A.xl, A.xr, A.y0 - h0); ctx.fill();
  }

  function drawVehicle(A) {
    // body to 72% of the height, cabin above it — the stepped outline is the
    // whole reason a stalled car doesn't read as the same slab as everything else
    drawLongBox(A, T.hazard, 0.72);
    var bodyTop = A.y0 - A.h * 0.72;
    var inset = A.w * 0.17;
    ctx.globalAlpha = 0.8 * A.fade + 0.1;
    ctx.fillStyle = T.hazardBody;
    ctx.fillRect(A.xl + inset, A.y0 - A.h, A.w - inset * 2, A.h * 0.30);
    ctx.globalAlpha = 0.55 * A.fade + 0.08;
    ctx.fillStyle = '#0a0e16';                                // rear glass
    ctx.fillRect(A.xl + inset * 1.5, A.y0 - A.h * 0.96, A.w - inset * 3, A.h * 0.17);
    ctx.globalAlpha = A.fade;
    ctx.fillStyle = T.rearLight;
    var lw = Math.max(2, A.h * 0.18), lh = Math.max(2, A.h * 0.13);
    ctx.fillRect(A.xl + 2, bodyTop + A.h * 0.10, lw, lh);
    ctx.fillRect(A.xr - 2 - lw, bodyTop + A.h * 0.10, lw, lh);
  }

  function drawTruck(A) {
    drawLongBox(A, T.hazardBody, 1);
    var top = A.y0 - A.h;
    ctx.globalAlpha = 0.9 * A.fade + 0.1;
    ctx.fillStyle = T.hazardTape;
    var bh = Math.max(1.2, A.h * 0.07);
    ctx.fillRect(A.xl, A.y0 - A.h * 0.22, A.w, bh);          // underrun bar
    for (var k = 0; k <= 4; k++) {                            // roof markers
      ctx.fillRect(A.xl + A.w * k / 4 - bh, top, bh * 2, bh * 1.4);
    }
    ctx.globalAlpha = A.fade;
    ctx.fillStyle = T.rearLight;
    var lw = Math.max(2, A.h * 0.10);
    ctx.fillRect(A.xl + A.w * 0.07, A.y0 - A.h * 0.44, lw, lw * 0.8);
    ctx.fillRect(A.xr - A.w * 0.07 - lw, A.y0 - A.h * 0.44, lw, lw * 0.8);
  }

  function drawWorks(A) {
    var top = A.y0 - A.h;
    ctx.globalAlpha = 0.85 * A.fade + 0.12;
    ctx.fillStyle = T.hazard;
    slabPath(A, A.xl, A.xr, top); ctx.fill();
    ctx.save();
    slabPath(A, A.xl, A.xr, top); ctx.clip();
    ctx.fillStyle = T.hazardTape;
    ctx.globalAlpha = 0.7 * A.fade + 0.08;
    var step = Math.max(3, A.h * 0.55);
    for (var x = A.xl - A.h; x < A.xr + A.h; x += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x, A.y0); ctx.lineTo(x + step, A.y0);
      ctx.lineTo(x + step + A.h, top); ctx.lineTo(x + A.h, top);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (((A.t * 1.7 + A.o.phase) % 1) < 0.5) {                // lamp, out of phase per barrier
      ctx.globalAlpha = 0.9 * A.fade + 0.15;
      ctx.fillStyle = '#ffb64a';
      var r = Math.max(1.2, A.h * 0.13);
      ctx.beginPath(); ctx.arc(A.xl + A.w * 0.5, top - r, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawCones(A) {
    for (var r = 2; r >= 0; r--) {
      var rel = A.rel0 + (A.rel1 - A.rel0) * (r / 2);
      var y = sy(rel), ch = A.o.height * view.roadHalfPx * sc(rel);
      var per = 2 + (r & 1);
      for (var k = 0; k < per; k++) {
        var u = (k + 0.5) / per;
        var px = sx(rel, A.lo + (A.hi - A.lo) * u);
        var cw = Math.max(1.5, ch * 0.66);
        ctx.globalAlpha = 0.9 * A.fade + 0.12;
        ctx.fillStyle = T.hazard;
        ctx.beginPath();
        ctx.moveTo(px, y - ch); ctx.lineTo(px + cw / 2, y); ctx.lineTo(px - cw / 2, y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = T.hazardTape;
        ctx.globalAlpha = 0.8 * A.fade;
        ctx.fillRect(px - cw * 0.26, y - ch * 0.62, cw * 0.52, Math.max(1, ch * 0.16));
      }
    }
  }

  function drawWreck(A) {
    var top = A.y0 - A.h;
    var flip = A.o.phase < 0.5 ? 1 : -1;
    var xA = flip > 0 ? A.xl : A.xr, d = (flip > 0 ? A.xr : A.xl) - xA;
    ctx.globalAlpha = 0.85 * A.fade + 0.12;
    ctx.fillStyle = T.hazardBody;
    ctx.beginPath();                                          // crumpled: high one end, collapsed the other
    ctx.moveTo(xA, A.y0);
    ctx.lineTo(xA + d * 0.08, top);
    ctx.lineTo(xA + d * 0.42, top + A.h * 0.24);
    ctx.lineTo(xA + d * 0.62, top + A.h * 0.06);
    ctx.lineTo(xA + d, A.y0 - A.h * 0.42);
    ctx.lineTo(xA + d, A.y0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = T.hazardTape;
    for (var k = 0; k < 7; k++) {                             // glass on the road ahead of it
      var ha = hash(A.o.z0 * 0.37 + k * 3.1), hb = hash(A.o.z0 * 0.71 + k * 5.7);
      var rel = A.rel0 - hb * 6;
      ctx.globalAlpha = (0.2 + 0.35 * ha) * A.fade;
      var sz = Math.max(1, A.h * 0.06);
      ctx.fillRect(sx(rel, A.lo + (A.hi - A.lo) * ha), sy(rel), sz, sz);
    }
  }

  function drawCrate(A) {
    for (var k = 0; k < 2; k++) {
      var hh = A.h * (0.7 + 0.5 * hash(A.o.z0 + k * 9.1));
      var bw = Math.max(2, A.w * 0.36);
      var px = sx(A.rel0, A.lo + (A.hi - A.lo) * ((k + 0.5) / 2)) - bw / 2;
      ctx.globalAlpha = 0.85 * A.fade + 0.12;
      ctx.fillStyle = T.hazardBody;
      ctx.fillRect(px, A.y0 - hh, bw, hh);
      ctx.globalAlpha = 0.5 * A.fade;
      ctx.fillStyle = T.hazardTape;
      ctx.fillRect(px, A.y0 - hh * 0.55, bw, Math.max(1, hh * 0.08));
    }
  }

  function drawSign(A) {
    var mid = (A.xl + A.xr) / 2, top = A.y0 - A.h;
    var pw = Math.max(1.2, A.w * 0.05);
    ctx.globalAlpha = 0.8 * A.fade + 0.1;
    ctx.fillStyle = T.hazardDark;
    ctx.fillRect(mid - pw / 2, top, pw, A.h);
    var bw = Math.max(3, A.w * 0.62), bh = bw * 0.66;
    ctx.globalAlpha = 0.9 * A.fade + 0.12;
    ctx.fillStyle = T.hazard;
    ctx.fillRect(mid - bw / 2, top, bw, bh);
    ctx.globalAlpha = 0.85 * A.fade;
    ctx.fillStyle = T.hazardTape;
    ctx.fillRect(mid - bw * 0.10, top + bh * 0.18, bw * 0.20, bh * 0.44);
    ctx.fillRect(mid - bw * 0.10, top + bh * 0.70, bw * 0.20, Math.max(1, bh * 0.12));
  }

  function drawDebris(A) {
    for (var k = 0; k < 6; k++) {
      var ha = hash(A.o.z0 * 0.53 + k * 2.7), hb = hash(A.o.z0 * 0.29 + k * 6.1);
      var rel = A.rel0 + (A.rel1 - A.rel0) * hb;
      var y = sy(rel);
      var ch = A.o.height * view.roadHalfPx * sc(rel) * (0.5 + ha);
      var px = sx(rel, A.lo + (A.hi - A.lo) * ha);
      ctx.globalAlpha = 0.85 * A.fade + 0.1;
      ctx.fillStyle = (k & 1) ? T.hazard : T.hazardBody;
      ctx.beginPath();
      ctx.moveTo(px - ch * 0.7, y); ctx.lineTo(px + ch * 0.6, y);
      ctx.lineTo(px + ch * 0.15, y - ch);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawPothole(A) {
    var mid = (A.xl + A.xr) / 2;
    var ry = Math.max(1.2, (A.y0 - A.y1) * 0.5);
    ctx.globalAlpha = 0.8 * A.fade + 0.15;
    ctx.fillStyle = '#04060a';
    ctx.beginPath();
    ctx.ellipse(mid, A.y0 - ry * 0.4, A.w * 0.42, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 * A.fade;
    ctx.strokeStyle = T.hazard;
    ctx.lineWidth = Math.max(1, view.px || 1);
    ctx.stroke();
  }

  function drawPedGroup(A) {
    for (var i = 0; i < 2; i++) {
      var t = (A.o.phase + i * 0.5 + A.t * 0.12) % 1;
      var px = sx(A.rel0, A.lo + (A.hi - A.lo) * (0.2 + 0.6 * t));
      var hh = 0.34 * view.roadHalfPx * A.s0;
      var ww = Math.max(1.5, hh * 0.22);
      ctx.globalAlpha = 0.9 * A.fade + 0.1;
      ctx.fillStyle = T.ped;
      ctx.fillRect(px - ww / 2, A.y0 - hh, ww, hh * 0.72);
      ctx.beginPath();
      ctx.arc(px, A.y0 - hh - hh * 0.13, Math.max(1.2, hh * 0.15), 0, Math.PI * 2);
      ctx.fill();
      var swing = Math.sin(A.t * 7 + i) * hh * 0.14;
      ctx.fillRect(px - ww * 0.4, A.y0 - hh * 0.3, ww * 0.35, hh * 0.3 + swing);
      ctx.fillRect(px + ww * 0.05, A.y0 - hh * 0.3, ww * 0.35, hh * 0.3 - swing);
    }
  }

  var SHAPES = {
    vehicle: drawVehicle, truck: drawTruck, works: drawWorks, cones: drawCones,
    wreck: drawWreck, crate: drawCrate, sign: drawSign, debris: drawDebris,
    pothole: drawPothole, ped: drawPedGroup
  };

  /* ---- darkness + headlights ----------------------------------------- */

  /* Two beams, thrown from the lamps on the car's nose. They are anchored to the
     body, so when the car yaws in a drift the light sweeps across the road with
     it — which is the whole reason you can lose sight of a hazard mid-swing. */
  function beams(world, vis) {
    var cx = sx(0, world.car.x), cy = view.carY;
    var w = CAR_W_FRAC * view.roadHalfPx;
    var h = w * CAR_ASPECT;
    var ang = (world.car.lean || 0) * 0.42;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var centre = NL.road.centreAt(world, world.dist);
    var slip = world.car.slip || 0;
    var cw = NL.light.coneHalfWidth(world);
    var swing = slip * 0.40;                 // the beams lead the slide
    var fy = sy(vis);
    var out = [];
    for (var s = -1; s <= 1; s += 2) {
      var lx = s * w * 0.30, ly = -h * 0.62;
      out.push({
        ox: cx + lx * ca - ly * sa,
        oy: cy + lx * sa + ly * ca,
        n: w * 0.30,
        fL: sx(vis, centre + swing + s * 0.26 - cw),
        fR: sx(vis, centre + swing + s * 0.26 + cw),
        fy: fy
      });
    }
    return out;
  }

  function beamPath(c, b, k) {
    k = k || 1;
    c.beginPath();
    c.moveTo((b.ox - b.n) * k, (b.oy + b.n * 0.6) * k);
    c.lineTo((b.ox + b.n) * k, (b.oy + b.n * 0.6) * k);
    c.lineTo(b.fR * k, b.fy * k);
    c.lineTo(b.fL * k, b.fy * k);
    c.closePath();
  }

  function drawDarkness(world, vis) {
    var w = view.W, h = view.H, k = 1;
    dctx.setTransform(view.darkScale, 0, 0, view.darkScale, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = '#000';
    dctx.fillRect(0, 0, w, h);

    var bs = beams(world, vis);
    var yFar = sy(vis) * k;
    var yLamp = bs[0].oy * k;

    dctx.globalCompositeOperation = 'destination-out';

    // spill: the wide, weak wash that keeps the beam edge from being a hard line
    var spill = dctx.createLinearGradient(0, yLamp, 0, yFar);
    spill.addColorStop(0, 'rgba(0,0,0,0.34)');
    spill.addColorStop(0.7, 'rgba(0,0,0,0.13)');
    spill.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = spill;
    for (var i = 0; i < bs.length; i++) {
      var wide = { ox: bs[i].ox, oy: bs[i].oy, n: bs[i].n * 3.2, fy: bs[i].fy,
                   fL: bs[i].fL - view.roadHalfPx * 0.5, fR: bs[i].fR + view.roadHalfPx * 0.5 };
      beamPath(dctx, wide, k);
      dctx.fill();
    }

    // the beams themselves
    var g = dctx.createLinearGradient(0, yLamp, 0, yFar);
    g.addColorStop(0, 'rgba(0,0,0,0.93)');
    g.addColorStop(0.58, 'rgba(0,0,0,0.88)');
    g.addColorStop(0.88, 'rgba(0,0,0,0.52)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    for (var j = 0; j < bs.length; j++) { beamPath(dctx, bs[j], k); dctx.fill(); }

    // lamp bloom + a little ground bounce, so the car is never a silhouette
    var lr = view.roadHalfPx * 0.42;
    for (var m = 0; m < bs.length; m++) {
      var lg = dctx.createRadialGradient(bs[m].ox, bs[m].oy, 0, bs[m].ox, bs[m].oy, lr);
      lg.addColorStop(0, 'rgba(0,0,0,0.95)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = lg;
      dctx.fillRect(bs[m].ox - lr, bs[m].oy - lr, lr * 2, lr * 2);
    }
    var bx = sx(0, world.car.x), br = view.roadHalfPx * 0.7;
    var rg = dctx.createRadialGradient(bx, view.carY, 0, bx, view.carY, br);
    rg.addColorStop(0, 'rgba(0,0,0,0.55)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = rg;
    dctx.fillRect(bx - br, view.carY - br, br * 2, br * 2);

    dctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.97;
    ctx.drawImage(dark, 0, 0, view.W, view.H);
    ctx.globalAlpha = 1;

    // warm colour of the light itself
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var warmth = 0.11 + 0.08 * world.power;
    var wg = ctx.createLinearGradient(0, bs[0].oy, 0, sy(vis));
    wg.addColorStop(0, 'rgba(' + T.headlight + ',' + warmth + ')');
    wg.addColorStop(1, 'rgba(' + T.headlight + ',0)');
    ctx.fillStyle = wg;
    for (var q = 0; q < bs.length; q++) { beamPath(ctx, bs[q], 1); ctx.fill(); }
    // the lamps themselves
    for (var r = 0; r < bs.length; r++) {
      var hg = ctx.createRadialGradient(bs[r].ox, bs[r].oy, 0, bs[r].ox, bs[r].oy, view.roadHalfPx * 0.16);
      hg.addColorStop(0, 'rgba(' + T.headlight + ',0.55)');
      hg.addColorStop(1, 'rgba(' + T.headlight + ',0)');
      ctx.fillStyle = hg;
      var hr = view.roadHalfPx * 0.16;
      ctx.fillRect(bs[r].ox - hr, bs[r].oy - hr, hr * 2, hr * 2);
    }
    ctx.restore();
  }

  /* ---- lane-warning posts (self-lit, drawn through the dark) ---------
   * One post per blocked lane, standing directly over that lane like a
   * gantry "lane closed" sign — the earlier rope anchors' whole job (be the
   * first thing you learn about a hazard, regardless of light power) but
   * now telling you WHICH lane, not just THAT something is coming, so a
   * two-lane wall reads as a real choice from as far back as it is lit. */
  function drawLaneWarnings(world, relMax, tNow) {
    var list = world.warnings;
    for (var i = 0; i < list.length; i++) {
      var wn = list[i];
      var rel = wn.z - world.dist;
      if (rel < -20 || rel > relMax + 160) continue;
      var c = NL.road.centreAt(world, wn.z), s = sc(rel), y = sy(rel);
      var laneX = c + cfg.laneCentres[wn.lane];
      var px = sx(rel, laneX);
      if (px < -80 || px > view.W + 80) continue;

      var postH = 0.95 * view.roadHalfPx * s;
      var pw = Math.max(2, 0.03 * view.roadHalfPx * s);
      var pulse = 0.7 + 0.3 * Math.sin(tNow * 8 + wn.id);
      var alpha = rel < -4 ? NL.clamp(1 + rel / 20, 0, 1) : 1;   // fades once passed

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = T.laneClear;
      ctx.fillRect(px - pw / 2, y - postH, pw, postH);

      var signW = pw * 5.4, signH = pw * 3.6, signY = y - postH - signH * 0.3;
      ctx.shadowColor = T.laneWarn;
      ctx.shadowBlur = 10 + 10 * pulse;
      ctx.fillStyle = T.laneWarn;
      ctx.fillRect(px - signW / 2, signY - signH / 2, signW, signH);

      // an X reads "closed" at a glance, no matter the lighting
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1a0d08';
      ctx.lineWidth = Math.max(1, pw * 0.5);
      ctx.beginPath();
      ctx.moveTo(px - signW * 0.28, signY - signH * 0.28);
      ctx.lineTo(px + signW * 0.28, signY + signH * 0.28);
      ctx.moveTo(px + signW * 0.28, signY - signH * 0.28);
      ctx.lineTo(px - signW * 0.28, signY + signH * 0.28);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---- power pickups — driven over, not thrown for ------------------- */
  function drawPickups(world, relMax, tNow) {
    var list = world.pickups;
    for (var i = 0; i < list.length; i++) {
      var pk = list[i];
      if (pk.collected) continue;
      var rel = pk.z - world.dist;
      if (rel < -4 || rel > relMax) continue;
      var c = NL.road.centreAt(world, pk.z), s = sc(rel), y = sy(rel);
      var px = sx(rel, c + cfg.laneCentres[pk.lane]);
      if (px < -60 || px > view.W + 60) continue;
      var r = Math.max(2, 0.045 * view.roadHalfPx * s);
      var bob = Math.sin(tNow * 3 + pk.id) * r * 0.3;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = T.pickupPower;
      ctx.shadowColor = T.pickupPower;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(px, y - r * 1.2 + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---- car -------------------------------------------------------------
   * A flat, blocky pixel-style car in the concept art's purple/pink/yellow —
   * plain fillRects and a couple of polygons, no gradients on the body
   * itself, drawn after the darkness pass so it is always visible. Rotation
   * is about the car's middle, so the yaw during a lane change reads as the
   * whole car stepping out, the way the rest of the world's chunky vector
   * vehicles (09's SHAPES) already draw.
   */
  function drawCar(world, tNow) {
    var cx = sx(0, world.car.x), cy = view.carY;
    var lean = world.car.lean;
    var slip = world.car.slip || 0;

    var w = CAR_W_FRAC * view.roadHalfPx;
    var h = w * CAR_ASPECT;

    ctx.save();
    ctx.translate(cx, cy - h * 0.40);
    ctx.rotate(lean * 0.42);

    ctx.fillStyle = T.carShadow;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.40, w * 0.44, h * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    var top = -h * 0.58, bottom = h * 0.42;

    // rear bumper — widest, darkest panel: reads as mass
    var bumperH = h * 0.17;
    ctx.fillStyle = T.carPurple2;
    ctx.fillRect(-w * 0.48, bottom - bumperH, w * 0.96, bumperH);

    // diffuser accent
    ctx.fillStyle = T.carYellow;
    ctx.fillRect(-w * 0.14, bottom - Math.max(1, h * 0.02), w * 0.28, Math.max(1, h * 0.02));

    // body / shoulders
    var bodyTop = -h * 0.02, bodyBottom = bottom - bumperH;
    ctx.fillStyle = T.carPurple;
    ctx.fillRect(-w * 0.44, bodyTop, w * 0.88, bodyBottom - bodyTop);

    // side accent stripe
    var stripeW = Math.max(1.5, w * 0.05);
    ctx.fillStyle = T.carPink;
    ctx.fillRect(-w * 0.44, bodyTop, stripeW, bodyBottom - bodyTop);
    ctx.fillRect(w * 0.44 - stripeW, bodyTop, stripeW, bodyBottom - bodyTop);

    // greenhouse (roof + rear window), tapering toward the top
    var roofW = w * 0.56;
    ctx.fillStyle = T.carPurple2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, bodyTop);
    ctx.lineTo(-roofW / 2, top + (bodyTop - top) * 0.22);
    ctx.lineTo(-roofW / 2, top);
    ctx.lineTo(roofW / 2, top);
    ctx.lineTo(roofW / 2, top + (bodyTop - top) * 0.22);
    ctx.lineTo(w * 0.34, bodyTop);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = T.carGlass;
    var winW = roofW * 0.66, winTop = top + (bodyTop - top) * 0.30, winBottom = bodyTop - h * 0.03;
    ctx.fillRect(-winW / 2, winTop, winW, winBottom - winTop);

    // spoiler, yellow endplates
    var spoilerY = top - h * 0.02, spoilerH = Math.max(1.5, h * 0.045);
    ctx.fillStyle = T.carPurple2;
    ctx.fillRect(-roofW * 0.62, spoilerY - spoilerH, roofW * 1.24, spoilerH);
    ctx.fillStyle = T.carYellow;
    var epW = Math.max(2, w * 0.06);
    ctx.fillRect(-roofW * 0.62 - epW * 0.3, spoilerY - spoilerH - h * 0.03, epW, spoilerH + h * 0.03);
    ctx.fillRect(roofW * 0.62 - epW * 0.7, spoilerY - spoilerH - h * 0.03, epW, spoilerH + h * 0.03);

    // tail lights — pink, at the bumper's outer corners
    var lw = Math.max(2, w * 0.13), lh = Math.max(2, bumperH * 0.6);
    var lightY = bottom - bumperH * 0.8;
    ctx.fillStyle = T.carPink;
    ctx.fillRect(-w * 0.44, lightY, lw, lh);
    ctx.fillRect(w * 0.44 - lw, lightY, lw, lh);

    // the lamps respond to the drift, same idea as the old asset's glow
    var glow = 0.25 + 0.55 * Math.abs(slip);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var lx = sgn * (w * 0.44 - lw / 2), ly = lightY + lh / 2;
      var rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.2);
      rg.addColorStop(0, 'rgba(255,47,143,' + glow.toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,47,143,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(lx - w * 0.22, ly - w * 0.22, w * 0.44, w * 0.44);
    }
    ctx.restore();

    ctx.restore();
  }

  /* ---- the shield: a ready pulse, and a burst when it absorbs a hit --- */
  function drawShieldBurst(world, tNow) {
    var cx = sx(0, world.car.x), cy = view.carY;
    var r0 = CAR_W_FRAC * view.roadHalfPx;
    if (world.shieldReady) {
      var pulse = 0.6 + 0.4 * Math.sin(tNow * 4.2);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = T.shieldReady;
      ctx.shadowColor = T.shieldReady;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - r0 * 0.3, r0 * (0.85 + 0.06 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (world.shieldFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = world.shieldFlash;
      var r = r0 * (1.2 + (1 - world.shieldFlash) * 2.2);
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(126,242,255,0.9)');
      g.addColorStop(1, 'rgba(126,242,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---- ambient vignette — atmosphere only, no "danger" tint now that
     there's no barrier left to run out of ------------------------------- */
  function drawVignette() {
    var v = ctx.createRadialGradient(view.W / 2, view.H * 0.6, view.W * 0.22,
                                     view.W / 2, view.H * 0.6, view.W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, view.W, view.H);
  }
})();

/* ===== 10-hud.js ===== */
/* NIGHT LINE — the readouts the shared shell doesn't already draw.
 *
 * Score, lives and the boot/home/game-over/leaderboard flow are the shell's
 * job now (shared/game-shell.js) — see 14-main. What is left here is the
 * stuff that is genuinely this game's own: the speedometer, the light meter
 * (GDD 7.1 — the warning must read even at zero), the shield — a row of
 * pips that fills from clean exact-lane clears and, once full, silently
 * saves the next hit — the clean-clear chain, the "you just passed your own
 * best" beat, and a one-time first-run reminder of the two controls.
 * Positioned bottom-centre, clear of the shell's own top-centre score/lives
 * readout and its bottom-corner controls.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var T = NL.tokens, cfg = NL.cfg;

  var popup = null;   // { label, colour, age } — sim-driven, see onFx()
  var POPUP_STYLE = {
    'wall-clear-hard': { label: 'CLEAR', colour: T.shieldCharge },
    'shield-ready':    { label: 'SHIELD READY', colour: T.shieldReady },
    'shield-save':     { label: 'SHIELD SAVE', colour: T.shieldReady }
  };

  function font(ctx, size, weight) {
    ctx.font = (weight || 500) + ' ' + size + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  }

  function meter(ctx, x, y, w, h, frac, colour, warn) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = warn ? colour : 'rgba(255,255,255,0.13)';
    ctx.lineWidth = warn ? 1.6 : 1;
    if (warn) { ctx.shadowColor = colour; ctx.shadowBlur = 12; }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    if (frac > 0) {
      ctx.fillStyle = colour;
      if (warn) { ctx.shadowColor = colour; ctx.shadowBlur = 10; }
      ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * frac), h - 2);
      ctx.shadowBlur = 0;
    }
  }

  NL.hud = {
    // Clears transient HUD state between runs so a stale popup from the
    // previous attempt can't flash up at the start of a new one.
    reset: function () { popup = null; },

    // Called once per drained sim event (see 12-game's fx loop) — picks out
    // the ones that need a floating readout rather than just a sound.
    onFx: function (fx) {
      var style = POPUP_STYLE[fx.type];
      if (style) popup = { label: style.label, colour: style.colour, age: 0 };
    },

    draw: function (ctx, world, view, tNow, dt, best) {
      var pad = view.tall ? 14 : 20;
      var mw = view.tall ? 100 : 140, mh = 8, gap = 7;
      var mx = view.W / 2 - mw / 2, my = view.H - pad - mh * 2 - gap;

      var low = NL.light.lowPower(world);
      var pulse = low ? 0.55 + 0.45 * Math.abs(Math.sin(tNow * 4.2)) : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // speed: the one number the death screen already gave you, now live —
      // and the thing that makes the automatic ramp-up (GDD 6) actually visible
      font(ctx, view.tall ? 13 : 15, 600);
      ctx.fillStyle = T.hudMid;
      ctx.fillText(Math.round(world.speed * 3.6) + ' KM/H', view.W / 2, my - 54);

      // the chain: consecutive clean clears
      if (world.streak >= 3) {
        var sp = world.streakPulse;
        var sSize = view.tall ? 13 : 15;
        font(ctx, Math.round(sSize * (1 + 0.12 * sp)), 600);
        var hot = Math.min(1, world.streak / 20);
        ctx.globalAlpha = 0.55 + 0.45 * hot;
        ctx.fillStyle = world.streak >= 10 ? T.shieldReady : T.hudMid;
        if (sp > 0.5) { ctx.shadowColor = T.shieldReady; ctx.shadowBlur = 14 * sp; }
        ctx.fillText('CHAIN ×' + world.streak, view.W / 2, my - 34);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // ---- light meter, bottom-centre
      ctx.globalAlpha = low ? pulse : 0.92;
      meter(ctx, mx, my, mw, mh, world.power, low ? T.hudWarn : 'rgba(255,206,140,0.9)', low);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      font(ctx, 9, 500);
      ctx.globalAlpha = low ? pulse : 1;
      ctx.fillStyle = low ? T.hudWarn : T.hudDim;
      ctx.fillText(low ? 'LIGHT LOW' : 'LIGHT', mx + mw + 8, my - 1);
      ctx.globalAlpha = 1;

      // ---- the shield: a row of pips, right under the light meter
      var py = my + mh + gap;
      var pips = cfg.shieldStreakToCharge;
      var pipGap = 3, pipW = Math.max(6, (mw - pipGap * (pips - 1)) / pips);
      var readyPulse = world.shieldReady ? 0.65 + 0.35 * Math.abs(Math.sin(tNow * 5)) : 1;
      for (var i = 0; i < pips; i++) {
        var filled = i < world.shield;
        var x = mx + i * (pipW + pipGap);
        ctx.globalAlpha = world.shieldReady ? readyPulse : (filled ? 0.95 : 0.30);
        ctx.fillStyle = world.shieldReady ? T.shieldReady : (filled ? T.shieldCharge : 'rgba(255,255,255,0.10)');
        if (world.shieldReady || filled) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; }
        ctx.fillRect(x, py, pipW, mh);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      font(ctx, 9, 500);
      ctx.fillStyle = world.shieldReady ? T.shieldReady : T.hudDim;
      ctx.fillText(world.shieldReady ? 'SHIELD READY' : 'SHIELD', mx + mw + 8, py - 1);
      ctx.textAlign = 'center';

      // sim-driven popups: CLEAR / SHIELD READY / SHIELD SAVE, above the car
      if (popup) {
        popup.age += dt;
        var life = 0.85;
        if (popup.age >= life) { popup = null; }
        else {
          var t = popup.age / life;
          var rise = t * 22;
          ctx.save();
          ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
          font(ctx, view.tall ? 16 : 20, 700);
          ctx.fillStyle = popup.colour;
          ctx.shadowColor = popup.colour; ctx.shadowBlur = 10;
          ctx.fillText(popup.label, view.W / 2, view.H * 0.58 - rise);
          ctx.restore();
        }
      }

      // the moment you pass your own best, mid-run
      if (world.beatBest > 0.01) {
        var bb = NL.clamp(world.beatBest * 1.6, 0, 1);
        ctx.save();
        font(ctx, view.tall ? 14 : 18, 700);
        ctx.fillStyle = T.shieldReady;
        ctx.globalAlpha = bb;
        ctx.shadowColor = T.shieldReady; ctx.shadowBlur = 18 * bb;
        ctx.fillText('NEW BEST', view.W / 2, view.H * 0.24);
        ctx.restore();
      }

      // first-ever run only: a few seconds of plain reminder of the two controls
      if (world._showIntro) {
        var INTRO_HOLD = 5.4, INTRO_FADE = 0.8;
        if (world.time > INTRO_HOLD + INTRO_FADE) world._showIntro = false;
        else {
          var ia = world.time < INTRO_FADE ? world.time / INTRO_FADE
                 : world.time > INTRO_HOLD ? 1 - (world.time - INTRO_HOLD) / INTRO_FADE
                 : 1;
          ctx.save();
          ctx.globalAlpha = ia;
          font(ctx, view.tall ? 12 : 14, 600);
          ctx.fillStyle = T.hudBright;
          ctx.fillText('LEFT / RIGHT STEP A LANE OVER', view.W / 2, view.H * 0.30);
          ctx.fillStyle = T.hudDim;
          ctx.fillText('WATCH THE LIT SIGNS — THEY SHOW WHICH LANE CLOSES', view.W / 2, view.H * 0.30 + 20);
          ctx.restore();
        }
      }

      ctx.textAlign = 'left';
    }
  };
})();

/* ===== 11-audio.js ===== */
/* NIGHT LINE — synthesised audio. No files, no loading.
 * Engine tone rises with speed and is the only speed cue (GDD 14). */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var actx = null, master = null;
  var engine = null, engineGain = null, engineFilter = null;
  var rumble = null, rumbleGain = null, rf = null;
  var warnAt = 0;
  var muted = false;

  function noiseBuffer(seconds) {
    var n = Math.floor(actx.sampleRate * seconds);
    var buf = actx.createBuffer(1, n, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  NL.audio = {
    ready: false,

    unlock: function () {
      if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(actx.destination);

      engineFilter = actx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = actx.createGain();
      engineGain.gain.value = 0;
      engine = actx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 60;
      engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engine.start();

      var src = actx.createBufferSource();
      src.buffer = noiseBuffer(2); src.loop = true;
      rf = actx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 300; rf.Q.value = 0.7;
      rumbleGain = actx.createGain(); rumbleGain.gain.value = 0;
      src.connect(rf); rf.connect(rumbleGain); rumbleGain.connect(master);
      src.start();
      rumble = src;

      NL.audio.ready = true;
    },

    setMuted: function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted: function () { return muted; },

    update: function (world, running) {
      if (!actx) return;
      var t = actx.currentTime;
      var k = (world.speed - NL.cfg.speedStart) / (NL.cfg.speedMax - NL.cfg.speedStart);
      if (running && world.alive) {
        engine.frequency.setTargetAtTime(52 + 78 * k, t, 0.15);
        engineFilter.frequency.setTargetAtTime(380 + 700 * k, t, 0.2);
        engineGain.gain.setTargetAtTime(0.075 + 0.05 * k, t, 0.2);
        var prox = NL.light.edgeProximity(world);
        var slip = Math.min(1, Math.abs(world.car.slip || 0));
        rumbleGain.gain.setTargetAtTime(prox * 0.20 + Math.max(0, slip - 0.35) * 0.22, t, 0.06);
        rf.frequency.setTargetAtTime(300 + slip * 900, t, 0.08);
        if (NL.light.lowPower(world) && t > warnAt) {
          warnAt = t + 1.6;
          NL.audio.blip(320, 0.16, 0.05, 'sine');
        }
      } else {
        engineGain.gain.setTargetAtTime(0, t, 0.15);
        rumbleGain.gain.setTargetAtTime(0, t, 0.1);
      }
    },

    blip: function (freq, dur, vol, type, sweepTo) {
      if (!actx) return;
      var t = actx.currentTime;
      var o = actx.createOscillator(); o.type = type || 'sine';
      var g = actx.createGain();
      o.frequency.setValueAtTime(freq, t);
      if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    noise: function (dur, vol, freq, q, sweepTo) {
      if (!actx) return;
      var t = actx.currentTime;
      var s = actx.createBufferSource(); s.buffer = noiseBuffer(dur + 0.05);
      var f = actx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
      f.Q.value = q || 1;
      var g = actx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    },

    fx: function (type) {
      if (!actx) return;
      switch (type) {
        case 'lane-step':   NL.audio.blip(620, 0.05, 0.05, 'square', 780); break;
        case 'pickup-power':NL.audio.blip(680, 0.16, 0.12, 'sine'); setTimeout(function(){NL.audio.blip(1020,0.18,0.10,'sine');},70); break;
        case 'wall-clear-hard': NL.audio.blip(760, 0.06, 0.06, 'triangle'); break;
        case 'shield-ready': NL.audio.blip(700, 0.12, 0.10, 'triangle'); setTimeout(function(){NL.audio.blip(1050,0.14,0.10,'triangle');},80); break;
        case 'shield-save': NL.audio.noise(0.14, 0.22, 2200, 1.4, 700); NL.audio.blip(1200, 0.14, 0.12, 'triangle'); break;
        case 'streak-mark': NL.audio.blip(1180, 0.09, 0.07, 'sine'); setTimeout(function(){NL.audio.blip(1570,0.12,0.06,'sine');},60); break;
        case 'speed-up':    NL.audio.blip(440, 0.10, 0.07, 'square'); setTimeout(function(){NL.audio.blip(660,0.14,0.07,'square');},80); break;
        case 'beat-best':   NL.audio.blip(700, 0.12, 0.10, 'triangle'); setTimeout(function(){NL.audio.blip(1050,0.12,0.10,'triangle');},90); setTimeout(function(){NL.audio.blip(1400,0.22,0.10,'triangle');},180); break;
        case 'crash':       NL.audio.noise(0.55, 0.55, 900, 0.5, 60); NL.audio.blip(90, 0.4, 0.30, 'square', 35); break;
      }
    }
  };
})();

/* ===== 12-game.js ===== */
/* NIGHT LINE — the run itself.
 *
 * The TITLE -> RUNNING -> CRASHED state machine, the "best" readout and the
 * restart key that used to live here are gone: the shared shell (14-main,
 * shared/game-shell.js) now owns boot/home/game-over/leaderboard and calls
 * back into onStart/onUpdate/onRender. This module keeps exactly what is
 * left that is genuinely this game's own — creating a world, stepping it at
 * a fixed timestep, and feeding the shell's score + the audio mute bridge —
 * same "no lives, no checkpoints, restart from zero" run it always was
 * (GDD 9), just entered via shell.startRun() instead of a title-screen tap. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var DT = 1 / 120;

  var world = null;
  var acc = 0;
  var simTime = 0;      // drives animation phase; frozen whenever the shell isn't calling onUpdate (paused, off-run)
  var lastHudT = 0;     // for the HUD's own transient animations (popup fade)

  NL.game = {
    get world() { return world; },

    init: function (shell) {
      NL.render.init(shell.dom.canvas);
      var onResize = function () { NL.render.resize(); };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', function () { setTimeout(onResize, 120); });
      var reduceMotion = false;
      try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) {}
      NL.render.setMotion(reduceMotion ? 0.35 : 1);
    },

    start: function () {
      world = NL.createWorld((Math.random() * 1e9) | 0);
      acc = 0;
      simTime = 0;
      lastHudT = 0;
      NL.hud.reset();
      // First-ever run only: a brief on-canvas reminder of the one control,
      // since the shared shell's help panel is opt-in (an icon tap away) and
      // a first-time player never has to find it to get the how-to-play.
      var introSeen = true;
      try { introSeen = localStorage.getItem('nightline:introSeen') === '1'; } catch (e) {}
      world._showIntro = !introSeen;
      if (!introSeen) { try { localStorage.setItem('nightline:introSeen', '1'); } catch (e) {} }
    },

    update: function (dt, shell) {
      if (!world) return;
      simTime += dt;
      NL.input.sync(shell);
      NL.input.beginFrame();

      acc += Math.min(dt, 0.25);
      while (acc >= DT) {
        var stepInput = { stepLeft: NL.input.stepLeft, stepRight: NL.input.stepRight };
        NL.input.stepLeft = false;    // one step per press, consumed by the first sub-step
        NL.input.stepRight = false;
        NL.stepWorld(world, DT, stepInput);
        acc -= DT;
        if (!world.alive) break;
      }

      // drain sim events to audio + the HUD's own floating popup text
      for (var i = 0; i < world.fx.length; i++) {
        NL.audio.fx(world.fx[i].type);
        NL.hud.onFx(world.fx[i]);
      }
      world.fx.length = 0;

      // Passing your own best mid-run is the hook that makes "one more go" work,
      // so it is called out the moment it happens, sourced from the shell's own
      // leaderboard rather than a separate high-score key.
      var best = (shell.leaderboard.all()[0] || {}).score || 0;
      if (best > 0 && !world._beat && world.score > best) {
        world._beat = true;
        world.beatBest = 1;
        NL.audio.fx('beat-best');
      }

      shell.setScore(Math.floor(world.time));
      if (NL.debug.enabled) NL.debug.tick(dt);

      // No lives pool: the one life the shell was given ends the run and — via
      // shell.loseLife()'s own check — takes it straight to GAME OVER.
      if (!world.alive) shell.loseLife();
    },

    render: function (ctx, shell) {
      if (!world) return;
      NL.audio.update(world, shell.state === 'playing');
      NL.render.frame(world, simTime);
      var hudDt = Math.max(0, simTime - lastHudT);   // 0 while paused, so transients freeze too
      lastHudT = simTime;
      var best = (shell.leaderboard.all()[0] || {}).score || 0;
      NL.hud.draw(ctx, world, NL.render.view, simTime, hudDt, best);
      if (NL.debug.enabled) NL.debug.draw(ctx, world, NL.render.view);
    }
  };
})();

/* ===== 13-debug.js ===== */
/* NIGHT LINE — dev overlay. ?debug=1 ?seed=N ?bot=1 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

  NL.debug = {
    enabled: params.get('debug') === '1',
    fps: 0,
    _last: 0,

    tick: function (dt) {
      this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1;
    },

    draw: function (ctx, w, view) {
      var cfg = NL.cfg;
      var nearest = null;
      for (var i = 0; i < w.warnings.length; i++) {
        var wn = w.warnings[i];
        var rz = wn.z - w.dist;
        if (rz > 0 && (!nearest || rz < nearest.rz)) nearest = { rz: rz, lane: wn.lane };
      }
      var lines = [
        'fps      ' + this.fps.toFixed(0),
        'seed     ' + w.seed,
        't        ' + w.time.toFixed(1) + '  speed ' + w.speed.toFixed(1) + ' m/s',
        'dist     ' + w.dist.toFixed(0) + ' m',
        'lane     ' + w.car.lane + '   x ' + w.car.x.toFixed(3) + '   vx ' + w.car.vx.toFixed(2),
        'walls    ' + w.walls.length + ' tracked' +
          (nearest ? '  next warn ' + nearest.rz.toFixed(0) + 'm (lane ' + nearest.lane + ')' : ''),
        'streak   ' + w.streak + '  best ' + w.streakBest,
        'shield   ' + w.shield + '/' + cfg.shieldStreakToCharge + (w.shieldReady ? '  READY' : ''),
        'light    ' + NL.light.visibleDistance(w).toFixed(0) + ' m   power ' + w.power.toFixed(2),
        'cleared  ' + w.cleared,
        'reaction ' + NL.reactionSecondsAt(w.time, w.speed).toFixed(2) + ' s' +
          '  (floor ' + cfg.reactionFloorSeconds + ')'
      ];
      ctx.save();
      ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, 8, 330, lines.length * 14 + 12);
      ctx.fillStyle = '#8ff';
      for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], 16, 16 + j * 14);
      ctx.restore();
    }
  };
})();

/* ===== 14-main.js ===== */
/* NIGHT LINE — wired into the shared Atari shell (shared/game-shell.js),
 * the same way Asteroids and Pong are: the shell owns the boot logo, the
 * home screen, the persistent HUD chrome (mute/home/help/pause), the paired
 * LEFT/RIGHT control buttons, the game-over screen and the leaderboard.
 * This file only hooks NL.game's lifecycle to those callbacks.
 *
 * NL.audio keeps its own richer WebAudio engine (continuous engine tone,
 * tyre rumble) rather than the shell's simple blip presets, so it never
 * calls shell.audio.play — it just mirrors shell.audio.muted every frame so
 * the shared mute button (top-left, and in the pause menu) still controls it. */
(function () {
  'use strict';
  var NL = (globalThis.NL = globalThis.NL || {});

  AtariShell.init({
    gameId: 'nightdriver',
    title: 'NIGHT LINE',
    instructions: 'LEFT / RIGHT STEP THE CAR ONE LANE OVER.<br>' +
      'A LIT SIGN OVER A LANE MEANS IT CLOSES AHEAD — WATCH FOR TWO AT ONCE.<br>' +
      'CLEAR AN EXACT-LANE WALL CLEANLY TO CHARGE THE SHIELD, WHICH SAVES ONE HIT.',
    accent: '--purple',
    accent2: '--blue',
    accent3: '--atari-red',
    titleFont: '--font-namco',
    livesStart: 1,
    controlsDefaultSide: 'right',
    buttons: [
      { id: 'left', label: 'LEFT', key: 'ArrowLeft', pair: 'steer', dir: 'left' },
      { id: 'right', label: 'RIGHT', key: 'ArrowRight', pair: 'steer', dir: 'right' }
    ],
    onInit: function (shell) { NL.game.init(shell); },
    onStart: function (shell) { NL.game.start(); },
    onUpdate: function (dt, shell) {
      NL.audio.setMuted(shell.audio.muted);
      NL.game.update(dt, shell);
    },
    onRender: function (ctx, shell) {
      NL.audio.setMuted(shell.audio.muted);
      NL.game.render(ctx, shell);
    }
  });
})();

