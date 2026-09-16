
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

    // the verb
    anchorDim:    '#2d6b78',
    anchorActive: '#7ef2ff',
    anchorHot:    '#ffffff',
    rope:         '#a8ecff',
    ropeStrain:   '#ff8a5c',

    // pickups
    pickupPower:  '#ffd166',
    pickupBeam:   '#c08cff',

    // car
    carBody:   '#ffcc33',
    carRoof:   '#141c2c',
    carTrim:   '#2a2f3c',        // GT wing, mirrors — neutral metal, not the glass
    carShadow: '#05070c',
    rearLight: '#ff2f3a',
    headlight: '255,206,140',   // rgb triplet for the cone

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
 * TIMING NOTE (deviation from GDD 3.3, deliberate — see progress doc)
 *   Drift rate is CONSTANT in road-units per second, i.e. it does NOT scale with
 *   speed. If it scaled, every reaction time would shrink by 3x at the speed cap
 *   and hard authoring rule 3.5.4 (reaction window floor) could not hold.
 *   Constant lateral rate is also what actually makes "a one-second hold feels the
 *   same at any speed" true: one second always moves you the same way across the
 *   road. Speed instead pushes anchors FURTHER OUT in metres (rope range is
 *   defined in seconds), which is exactly what rule 3.5.4 asks for.
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
    clearMargin: 0.04,       // extra room demanded when authoring
    // A "do nothing" hazard has to be survivable by a car that is NEARLY centred,
    // not exactly centred — otherwise the residual offset left by the previous
    // event makes it an unannounced execution.
    breatherMargin: 0.17,
    // Single-side hazards keep clear of the middle by this much. At 0.15 their
    // padded edge sat 5 mm inside the breather margin, so every one of them was
    // rejected as neither a breather nor a fair swing — they had never shipped.
    sideInnerShrink: 0.22,
    get edgeSafe() { return 1 - this.carHalfWidth; },   // 0.89: barrier contact

    /* ---- the verb (GDD 3) ---- */
    driftPerSec: 0.54,       // road units / s. THE most important number.
    /* A corner is a SWING, not a lean. Its post — a pivot — pulls harder than an
     * obstacle's post, so a sharp bend is ~1.5 s of rope instead of 3.3. This is
     * not drift scaling with speed: the rate is fixed per post type and known
     * when the event is authored, so reaction windows are untouched. */
    pivotPull: 1.25,         // at the cap (see pullRamp)
    pivotApex: 0.45,         // the post passes the car this far through the ideal hold
    /* THE DIFFICULTY RAMP, and why it lives in the rope.
     * The throw window on an obstacle is geometry: (room to the barrier - room to
     * clear) / pull rate, minus the pass time. On this road at 0.54 units/s that is
     * ~1.1 s, at every speed — the "2.2 s of decision time at the start" the ramp
     * promised was never physically available, so a first run was as hard as the
     * hundredth. The only honest way to widen the window is to pull more gently:
     * a rope that gets stronger with speed. Obstacle posts pull at 0.38 at the
     * start (window ~1.6 s) rising to 0.54 at the cap (~1.0 s); pivots from 0.95
     * to 1.25; the corner window closes from 1.4 s to 0.95 s. Every value is
     * authored per event from the arrival speed and verified, and none of it can
     * go below the floor. */
    pullRamp: {
      obstacle: { start: 0.36, end: 0.54 },
      pivot:    { start: 0.95, end: 1.25 },
      curveEarly: { start: 0.80, end: 0.50 },
      curveLate:  { start: 0.85, end: 0.45 }
    },
    // Throw just before the bend so the slide is at full rate as the road starts
    // to turn. Sized to the pull: at 1.2 units/s a 0.35 s lead already put the car
    // half a road ahead of the centreline before the corner had begun.
    curvePressLead: 0.10,
    curveTail: 0.20,         // s the road keeps turning after the ideal release; momentum covers it
    // A corner's throw window is authored (pullRamp.curveEarly/Late), not derived,
    // and verified out to both edges: early presses on a pivot are expensive.
    returnPerSec: 0.80,
    driftTau: 0.17,          // s to reach full slide — the car has mass
    returnTau: 0.20,         // s to swing the slide back the other way
    idleTau: 0.14,           // residual slide bleeds off
    skidThreshold: 0.16,     // |lateral speed| above which the tyres let go
    missCooldown: 0.42,
    anchorLeadSeconds: 0.60, // anchor post stands this far (in time) before its hazard
    windowFloorSeconds: 0.90,// hard floor, rule 3.5.4
    /* Difficulty ramp. The throw window starts generous and tightens toward the
     * floor as the run goes on — the anchor simply becomes ropeable later, so you
     * get less time to decide. It never goes below the floor: a hazard that
     * arrives faster than a person can react is not difficulty, it is a coin flip,
     * and the run stops being worth replaying. */
    windowStartSeconds: 2.20,
    windowEndSeconds: 0.95,
    ropeSideOffset: 1.25,    // anchors stand this far out, beyond the road edge

    /* ---- pacing ---- */
    // Rule 3.5.5 spacing is COMPUTED per event (see 06-generator); these only
    // control the discretionary slack on top of what the rule demands.
    gapSlackSeconds: 0.10,
    // seconds between the car being centred again and the NEXT press. Pure
    // breathing room on top of rule 3.5.5, so it is the one spacing number that
    // is allowed to tighten with speed.
    pressAllowance: { start: 0.55, end: 0.30 },
    minGapSeconds: 1.2,
    clusterChance: 0.75,     // an event may hold 2-3 hazards cleared by one swing
    densityFloor: 0.40,      // squeezes the slack only; never the settle time      // post-cap gap multiplier floor
    densityRampStart: 200,
    densityRampEnd: 480,

    /* ---- hazards ---- */
    obstacleLen: { vehicle: 6, works: 7, pothole: 3, debris: 3, ped: 4,
                   truck: 13, cones: 10, wreck: 9, crate: 3.5, sign: 2 },
    obstacleHeight: { vehicle: 0.30, works: 0.26, pothole: 0.02, debris: 0.12, ped: 0.34,
                      truck: 0.52, cones: 0.13, wreck: 0.33, crate: 0.22, sign: 0.42 },
    // Every curve now exceeds edgeSafe, so NO turn can be taken without roping a
    // post: not steering is leaving the road. That is the premise, and a gentle
    // curve you could ride out undercut it.
    curveDelta: { slight: 1.08, medium: 1.34, sharp: 1.66 },
    curveSlack: 1.00,        // road turns slightly slower than the car can drift
    curveEaseRamp: 0.26,     // transition length at each end of a corner, 0..0.5
    bendArcMetres: 230,      // distance over which a bend's displacement doubles on screen
    // The opening turns are shallow enough to survive un-roped, so the verb can be
    // learned once before the road starts insisting on it.
    curveGraceSeconds: 18,
    warmUpSeconds: 18,       // first-run forgiveness: hazards verified at a wider press error
    warmUpPressError: 0.55,
    comboOutsideStart: 0.58, // a combo's exit wreck starts this far out on the outside
    curveGraceScale: 0.72,

    /* ---- light (GDD 7) ---- */
    lightFullSeconds: 1.90,   // seconds of road visible at power 1
    lightZeroSeconds: 0.55,  // at power 0 — hard, never blind. Wider gap from
    // full than before: low power is meant to be FELT, not just read off a bar.
    lightBeamSeconds: 2.60,
    lightFloorMetres: 150,   // raised: even at zero power there's real reaction room
    powerDrainPerSec: 1 / 38,
    powerPickup: 0.50,
    beamDuration: 8,
    beamPickup: 1,
    powerEveryNEvents: 6,
    beamEveryNEvents: 7,
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
    postSpacing: 50          // unlit reflector posts, metres
  };

  /* ---- derived timings (all speed-independent, which is the point) ---- */
  cfg.tBarrier = cfg.edgeSafe / cfg.driftPerSec;              // 2.225 s centre -> barrier
  cfg.curveHold = {};                                          // seconds of rope per severity
  for (var sev in cfg.curveDelta) cfg.curveHold[sev] = cfg.curveDelta[sev] / cfg.pivotPull;

  NL.cfg = cfg;

  NL.speedAt = function (t) {
    var k = t / cfg.speedRampSeconds;
    if (k > 1) k = 1;
    return cfg.speedStart + (cfg.speedMax - cfg.speedStart) * k;
  };

  /* How much decision time a hazard gives you — a function of SPEED, not of a
   * clock. It used to tighten on a timer, which meant going faster cost you
   * nothing: the same warning at 1000 km/h as at 300. Now the reaction budget
   * shrinks as the car accelerates, so speed is the difficulty rather than a
   * number on the HUD. It still never crosses the floor — a hazard you cannot
   * react to is a coin flip, not a challenge. */
  NL.windowTargetAt = function (t, speed) {
    var v = speed === undefined ? cfg.speedStart : speed;
    var k = (v - cfg.speedStart) / (cfg.speedMax - cfg.speedStart);
    k = Math.max(0, Math.min(1, k));
    return Math.max(cfg.windowFloorSeconds,
                    cfg.windowStartSeconds + (cfg.windowEndSeconds - cfg.windowStartSeconds) * k);
  };

  // speed fraction 0..1 between start and cap
  NL.speedK = function (speed) {
    var k = (speed - cfg.speedStart) / (cfg.speedMax - cfg.speedStart);
    return Math.max(0, Math.min(1, k));
  };
  function rampAt(r, speed) { return r.start + (r.end - r.start) * NL.speedK(speed); }
  NL.obstaclePullAt = function (speed) { return rampAt(cfg.pullRamp.obstacle, speed); };
  NL.pivotPullAt = function (speed) { return rampAt(cfg.pullRamp.pivot, speed); };
  NL.curveWindowAt = function (speed) {
    return { early: rampAt(cfg.pullRamp.curveEarly, speed), late: rampAt(cfg.pullRamp.curveLate, speed) };
  };

  NL.pressAllowanceAt = function (speed) { return rampAt(cfg.pressAllowance, speed); };

  NL.densityMultAt = function (t) {
    if (t <= cfg.densityRampStart) return 1;
    var k = (t - cfg.densityRampStart) / (cfg.densityRampEnd - cfg.densityRampStart);
    if (k > 1) k = 1;
    return 1 + (cfg.densityFloor - 1) * k;
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
   * THE DRIFT. One integrator, used by both the live sim (07) and the
   * generator's fairness verifier (06) — if these ever diverge, the authoring
   * guarantees become fiction, so there is exactly one copy.
   *
   * The car has mass. Lateral velocity chases a target rather than snapping to
   * it, so the car slides INTO the drift when the rope bites and keeps sliding
   * for a beat after you let go. That overshoot is the point: a late release
   * costs you more road than the button was held for.
   * ------------------------------------------------------------------- */
  // `pull` is the attached post's own rate; 0 / undefined means an ordinary post.
  NL.carStep = function (st, mode, side, centre, dt, pull) {
    var cfg = NL.cfg, target, tau;
    if (mode === 'attached') {
      target = side * (pull || cfg.driftPerSec);
      tau = cfg.driftTau;
    } else if (mode === 'returning') {
      var d = centre - st.x;
      var mag = Math.min(cfg.returnPerSec, Math.abs(d) / Math.max(dt, 1e-4));
      target = (d > 0 ? 1 : -1) * mag;
      tau = cfg.returnTau;
    } else {
      target = 0;
      tau = cfg.idleTau;
    }
    st.vx += (target - st.vx) * (1 - Math.exp(-dt / tau));
    st.x += st.vx * dt;
  };

  NL.settled = function (st, centre) {
    return Math.abs(centre - st.x) < 0.012 && Math.abs(st.vx) < 0.05;
  };

  /* Interval helpers, used by the generator to find where the car may legally be. */
  // Subtract a set of [lo,hi] blocked intervals from [lo,hi] bounds.
  NL.freeIntervals = function (bounds, blocked) {
    var free = [bounds.slice()];
    for (var b = 0; b < blocked.length; b++) {
      var next = [];
      for (var i = 0; i < free.length; i++) {
        var f = free[i], k = blocked[b];
        if (k[1] <= f[0] || k[0] >= f[1]) { next.push(f); continue; }
        if (k[0] > f[0]) next.push([f[0], k[0]]);
        if (k[1] < f[1]) next.push([k[1], f[1]]);
      }
      free = next;
    }
    return free;
  };
})();

/* ===== 03-input.js ===== */
/* NIGHT LINE — two buttons: LEFT throws (and holds) the rope at the left
 * post, RIGHT does the same for the right post — so which of the two lit
 * poles you rope is a real, expressed choice instead of an auto-attach to
 * whichever is nearest. Driven by the shared shell's InputManager (keyboard
 * arrows + the two on-screen buttons both feed shell.input) rather than
 * owning its own DOM listeners. sync() is polled once per shell onUpdate()
 * and turns shell's isDown into the held/justPressed shape the sim (07) and
 * the fixed-step loop (12) expect, one copy per side. */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});

  NL.input = {
    leftHeld: false, leftJustPressed: false,
    rightHeld: false, rightJustPressed: false,
    _qLeftPress: false, _qRightPress: false
  };

  NL.input.beginFrame = function () {
    var i = NL.input;
    i.leftJustPressed = i._qLeftPress;
    i.rightJustPressed = i._qRightPress;
    i._qLeftPress = false;
    i._qRightPress = false;
  };

  NL.input.sync = function (shell) {
    var i = NL.input;
    var lHeld = shell.input.isDown('left');
    if (lHeld && !i.leftHeld) {
      i.leftHeld = true;
      i._qLeftPress = true;
      if (NL.audio && NL.audio.unlock) NL.audio.unlock();
    } else if (!lHeld && i.leftHeld) {
      i.leftHeld = false;
    }
    var rHeld = shell.input.isDown('right');
    if (rHeld && !i.rightHeld) {
      i.rightHeld = true;
      i._qRightPress = true;
      if (NL.audio && NL.audio.unlock) NL.audio.unlock();
    } else if (!rHeld && i.rightHeld) {
      i.rightHeld = false;
    }
  };
})();

/* ===== 04-road.js ===== */
/* NIGHT LINE — the road centreline.
 *
 * The road is straight-ahead in z; what moves is its lateral centre, c(z).
 * A curve is a segment that shifts the centre by deltaX over `length` metres,
 * with a smoothstep profile so entries and exits are gentle.
 *
 * The car is never moved by a curve. If it is not roped, the road simply moves
 * out from under it — GDD 9, "leaving the road on a curve".
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

  NL.makeAnchor = function (opts) {
    return {
      id: nextId++,
      z: opts.z,                       // world z of the post
      side: opts.side,                 // -1 left, +1 right
      pull: opts.pull || 0,            // lateral rate while attached; 0 = cfg.driftPerSec
      pickup: opts.pickup || null,     // 'power' | 'beam' | null
      eventId: opts.eventId,
      // window bounds, expressed as the *hazard's* remaining distance in metres
      openHazardZ: opts.openHazardZ,
      closeHazardZ: opts.closeHazardZ,
      hazardZ: opts.hazardZ,           // world z the window is measured against
      used: false,
      collected: false,
      state: 'dormant',                // dormant | active | attached | passed
      // Both the safe-side and hazard-side posts of an event are ropeable —
      // LEFT/RIGHT name which one by side (see findAnchorSide, 07-sim), not
      // by nearest, so which post you rope is an expressed choice. This
      // flag is kept as an escape hatch for a future decorative-only post;
      // nothing currently sets it false.
      attachable: opts.attachable === undefined ? true : opts.attachable,
      // True only for the safe-side post of a curve/combo bend, so the render
      // layer can draw the "this one throws you hard" chevron board on those
      // alone — not on every anchor with nonzero pull, which obstacle anchors
      // also carry.
      pivot: opts.pivot || false
    };
  };

  // An event is one demand on the player: a hazard plus the anchors that answer it.
  NL.makeEvent = function (opts) {
    return {
      id: opts.id,
      kind: opts.kind,                 // obstacle | curve | combo | gate
      z: opts.z,
      // perfect-information hints, used only by the test bot (see 07-sim botInput)
      idealPressDist: opts.idealPressDist,
      idealHold: opts.idealHold,
      idealSide: opts.idealSide,
      windowSeconds: opts.windowSeconds,
      botDone: false
    };
  };
})();

/* ===== 06-generator.js ===== */
/* NIGHT LINE — hazard generator.
 *
 * The five hard authoring rules (GDD 3.5) are implemented as ASSERTIONS, not as
 * hopes. Every candidate event is verified by forward-simulating an ideal line
 * through it, plus perturbations, before it is allowed into the world. A
 * candidate that fails is rejected and re-rolled; the rejection rate is exposed
 * in the debug overlay because a high rate means the constants are wrong.
 *
 *   1. every hazard has a survivable anchor   -> verifyPlan must pass
 *   2. anchors only on the safe side          -> anchor side comes from a free interval
 *   3. anchor visible before hazard resolves  -> structural: anchors are self-lit and
 *                                                drawn through the darkness (08/09)
 *   4. reaction window floor                  -> windowSeconds >= cfg.windowFloorSeconds
 *   5. one full rope cycle between hazards    -> gap = speed * ropeCycleSeconds
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var cfg = NL.cfg;

  // What a hazard actually varies by: how many lanes it blocks, and how long it
  // takes to pass. Everything else is presentation.
  var SINGLE_KINDS = [['vehicle', 20], ['debris', 13], ['pothole', 11], ['ped', 8],
                      ['truck', 12], ['crate', 10], ['sign', 8], ['cones', 8]];
  var WIDE_KINDS   = [['works', 24], ['wreck', 20], ['vehicle', 13], ['cones', 14], ['ped', 8]];

  var LANES = {
    L: [cfg.laneCentres[0] - cfg.laneHalfWidth, cfg.laneCentres[0] + cfg.laneHalfWidth],
    C: [cfg.laneCentres[1] - cfg.laneHalfWidth, cfg.laneCentres[1] + cfg.laneHalfWidth],
    R: [cfg.laneCentres[2] - cfg.laneHalfWidth, cfg.laneCentres[2] + cfg.laneHalfWidth]
  };

  function lanesSpan(lanes) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < lanes.length; i++) {
      lo = Math.min(lo, LANES[lanes[i]][0]);
      hi = Math.max(hi, LANES[lanes[i]][1]);
    }
    return [lo, hi];
  }

  /* ---------------------------------------------------------------------
   * verifyPlan — forward-simulate one event with a given press plan.
   * Pure, allocation-light, no world state. Returns {ok, maxOff, cause}.
   * ------------------------------------------------------------------- */
  function verifyPlan(p) {
    var dt = 1 / 90;
    var drift = cfg.driftPerSec, ret = cfg.returnPerSec;
    var hw = cfg.carHalfWidth, edge = cfg.edgeSafe;
    var lead = 3.0;                                  // sim starts 3 s before zRef
    var zCar = p.zRef - p.vArr * lead;
    var tEnd = lead + p.eventSeconds + 3.0;
    var pressT = lead - p.pressLead;                 // press this long before zRef
    var relT = pressT + p.hold;                      // release
    var st = { x: 0, vx: 0 }, maxOff = 0, settleOff = 0;
    var mode = 'idle';

    for (var t = 0; t <= tEnd; t += dt) {
      zCar += p.vArr * dt;

      // centreline here
      var cc = 0;
      if (p.curve) {
        var u = (zCar - p.curve.zStart) / p.curve.length;
        cc = p.curve.deltaX * NL.arcEase(u);
      }

      /* Mode is STATE, exactly as in 07-sim: attached while held, returning once
         released, and idle for good once settled. It used to be recomputed every
         step from settled(), which quietly let the verifier re-enter 'returning'
         whenever the road moved away again — a rescue the live game never gives.
         The two must agree or the fairness proofs are about a different game. */
      if (t >= pressT && t < relT) mode = 'attached';
      else if (mode === 'attached') mode = 'returning';
      else if (mode === 'returning' && NL.settled(st, cc)) mode = 'idle';
      NL.carStep(st, mode, p.side, cc, dt, p.pull || 0);

      var carX = st.x;
      var off = carX - cc;
      if (Math.abs(off) > maxOff) maxOff = Math.abs(off);
      /* What the next event has to wait for is not how far the car swung, but how
         far from the centreline it still is once the rope is released. Through a
         curve those are wildly different numbers: the road moved with the car, so
         a 1.66-unit corner ends with the car nearly centred. Charging the full
         corner as settle time bought two seconds of empty road after every turn,
         which is most of what "density is low" was. */
      if (t >= relT && Math.abs(off) > settleOff) settleOff = Math.abs(off);
      if (Math.abs(off) >= edge) return { ok: false, maxOff: Math.abs(off), settleOff: Math.abs(off), cause: 'barrier' };

      for (var i = 0; i < p.obstacles.length; i++) {
        var o = p.obstacles[i];
        if (zCar + cfg.carLengthZ > o.z0 && zCar < o.z0 + o.len) {
          // obstacle lateral span is relative to the centreline where it stands
          var ou = p.curve ? NL.arcEase((o.z0 - p.curve.zStart) / p.curve.length) : 0;
          var occ = p.curve ? p.curve.deltaX * ou : 0;
          if (carX + hw > occ + o.lo && carX - hw < occ + o.hi) {
            return { ok: false, maxOff: maxOff, settleOff: settleOff, cause: 'hit' };
          }
        }
      }
    }
    return { ok: true, maxOff: maxOff, settleOff: settleOff, cause: null };
  }

  // A plan must survive the ideal line AND a spread of human error around it.
  function verifyRobust(p) {
    var r = verifyPlan(p);
    if (!r.ok) return r;
    var jitter = [
      { dp: +0.34, dh: 0 }, { dp: -0.34, dh: 0 },
      { dp: 0, dh: +0.36 }, { dp: 0, dh: -0.36 },
      { dp: +0.26, dh: +0.26 }, { dp: -0.26, dh: -0.26 },
      { dp: +0.26, dh: -0.20 }, { dp: -0.26, dh: +0.20 }
    ];
    // an authored window (curves) must be survivable out to its own edges
    if (p.pressEarly) jitter.push({ dp: +p.pressEarly, dh: 0 }, { dp: +p.pressEarly, dh: +0.20 });
    if (p.pressLate) jitter.push({ dp: -p.pressLate, dh: 0 }, { dp: -p.pressLate, dh: -0.20 });
    for (var i = 0; i < jitter.length; i++) {
      var q = Object.create(p);
      q.pressLead = p.pressLead + jitter[i].dp;
      q.hold = p.hold + jitter[i].dh;
      var s = verifyPlan(q);
      if (!s.ok) return { ok: false, maxOff: s.maxOff, settleOff: s.settleOff, cause: 'fragile:' + s.cause };
      // spacing must hold for the sloppiest line that still survives, not just the ideal one
      if (s.settleOff > r.settleOff) r.settleOff = s.settleOff;
    }
    return r;
  }

  /* ---------------------------------------------------------------------
   * Free-space analysis: where may the car legally be, given blocked lanes?
   * ------------------------------------------------------------------- */
  function analyseBlocked(span) {
    var pad = cfg.carHalfWidth + cfg.clearMargin;
    var blocked = [[span[0] - pad, span[1] + pad]];
    var free = NL.freeIntervals([-cfg.edgeSafe, cfg.edgeSafe], blocked);
    var out = [];
    for (var i = 0; i < free.length; i++) {
      var f = free[i];
      if (f[1] - f[0] < 0.14) continue;               // too narrow to aim for
      if (f[0] <= 0.02 && f[1] >= -0.02) {
        // only a genuine breather if a slightly-off-centre car is still clear
        if (f[0] > -cfg.breatherMargin || f[1] < cfg.breatherMargin) continue;
        out.push({ breather: true, side: f[1] > -f[0] ? 1 : -1, req: 0, limit: Math.max(f[1], -f[0]) });
      } else if (f[0] > 0) {
        out.push({ breather: false, side: 1, req: f[0], limit: f[1] });
      } else {
        out.push({ breather: false, side: -1, req: -f[1], limit: -f[0] });
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------------
   * Candidate builders. Each returns an event descriptor or null.
   * ------------------------------------------------------------------- */

  function buildObstacle(world, z, vArr, rng, layout) {
    var span = lanesSpan(layout.lanes);
    if (layout.innerShrink) {                       // keep single-side hazards off the middle
      if (span[1] < 0) span = [span[0], span[1] - layout.innerShrink];
      else if (span[0] > 0) span = [span[0] + layout.innerShrink, span[1]];
    }
    var opts = analyseBlocked(span);
    if (!opts.length) return null;

    // Prefer the roomiest option, but break ties at random — otherwise a symmetric
    // hazard (anything blocking only the centre lane) would always send you the
    // same way and the run would read as scripted.
    for (var q = 0; q < opts.length; q++) opts[q]._r = rng();
    opts.sort(function (a, b) {
      var d = (b.limit - b.req) - (a.limit - a.req);
      return Math.abs(d) > 0.02 ? d : a._r - b._r;
    });
    var pickOpt = opts[0];

    var kind = layout.kind;
    var len = cfg.obstacleLen[kind] * (0.85 + rng() * 0.4);
    var pull = NL.obstaclePullAt(vArr);              // the ramp: gentler rope early
    // + driftTau: the car takes that long to spin up to full slide (02-util carStep)
    var tClear = pickOpt.req / pull + cfg.driftTau;
    var tLimit = Math.min(pickOpt.limit, cfg.edgeSafe) / pull + cfg.driftTau;

    /* A single swing can legitimately clear more than one hazard. Spacing is
       governed by the settle time between EVENTS, so packing two or three
       obstacles into one event raises what you actually dodge without shortening
       the recovery the fairness rule protects.

       The group is built against a BUDGET rather than rolled and rejected: the
       time available to pass everything is whatever is left after the swing out
       and the throw window, so hazards are added only while they still fit. */
    var passBudget = tLimit - tClear - (cfg.windowFloorSeconds + 0.12);
    var obstacles = [{ z0: z, len: len, lo: span[0], hi: span[1] }];
    var lastEnd = z + len;
    function passOf(end) { return (end - z + cfg.carLengthZ) / vArr; }

    if (!pickOpt.breather && passOf(lastEnd) < passBudget && rng() < cfg.clusterChance) {
      var want = rng() < 0.30 ? 2 : 1;
      for (var e = 0; e < want; e++) {
        // metres, not seconds: a debris field is a debris field at any speed,
        // and a speed-scaled gap instantly overran the pass budget
        var gapM = 5 + rng() * 11;
        var ekind = rng.weighted(layout.lanes.length > 1 ? WIDE_KINDS : SINGLE_KINDS);
        var elen = cfg.obstacleLen[ekind] * (0.85 + rng() * 0.4);
        var end = lastEnd + gapM + elen;
        if (passOf(end) > passBudget) break;
        obstacles.push({ z0: lastEnd + gapM, len: elen, lo: span[0], hi: span[1], kind: ekind });
        lastEnd = end;
      }
    }
    var tPassAll = passOf(lastEnd);
    var tPass = tPassAll;

    var tOpen = tLimit - tPassAll;                    // earliest useful press
    var tClose = tClear;                              // latest useful press
    var windowSeconds = tOpen - tClose;

    if (!pickOpt.breather && windowSeconds < cfg.windowFloorSeconds) return null;

    // The geometry allows `windowSeconds`; how much of it the anchor actually
    // offers is what the difficulty ramp controls.
    var wUse = Math.min(windowSeconds, Math.max(cfg.windowFloorSeconds, NL.windowTargetAt(world.time, vArr)));
    var tMid = pickOpt.breather ? Math.min(1.0, tOpen * 0.5) : tClose + wUse / 2;
    var hold = pickOpt.breather ? 0.5 : tMid + tPassAll;

    var plan = {
      vArr: vArr, zRef: z, curve: null, obstacles: obstacles,
      side: pickOpt.side, pressLead: tMid, hold: hold, pull: pull,
      eventSeconds: tPassAll + 0.5
    };
    if (world.time < cfg.warmUpSeconds) {
      // the first half-minute is verified against a first-timer's press error,
      // not a regular's: whatever cannot survive that does not get to be early
      plan.pressEarly = cfg.warmUpPressError;
      plan.pressLate = cfg.warmUpPressError;
    }
    var maxOff = 0;
    if (!pickOpt.breather) {
      var v = verifyRobust(plan);
      if (!v.ok) return null;
      maxOff = v.settleOff;
    }

    return {
      kind: 'obstacle',
      z: z, len: lastEnd - z, group: obstacles, obstacleKind: kind, lanes: layout.lanes,
      lo: span[0], hi: span[1],
      side: pickOpt.side, breather: pickOpt.breather,
      openHazardZ: vArr * (tClose + wUse),
      closeHazardZ: vArr * tClose,
      windowSeconds: Math.max(wUse, 0),
      idealPressLead: tMid, idealHold: hold, maxOff: maxOff,
      curve: null, vArr: vArr, pull: pull,
      allowSecondAnchor: false
    };
  }

  function buildCurve(world, z, vArr, rng, severity) {
    var mag = cfg.curveDelta[severity] *
              (world.time < cfg.curveGraceSeconds ? cfg.curveGraceScale : 1);
    // After a turn the road is more likely to turn back — that is what makes a
    // road feel like a road rather than a list of corners. Direction is otherwise
    // free: the computed settle spacing (below) is what keeps a chain fair, so it
    // no longer has to be prevented.
    var dir;
    if (world.lastCurveDir && rng() < 0.62) dir = -world.lastCurveDir;
    else dir = rng() < 0.5 ? -1 : 1;
    var deltaX = mag * dir;
    /* A corner is a swing around a pivot post. The post pulls at pivotPull, so the
       whole bend is ~1.1-1.5 s of rope; the road turns over exactly the distance
       that swing covers, which is what makes the bend on screen as sharp as the
       hold is short. */
    var pull = NL.pivotPullAt(vArr);
    var swing = mag / pull;                       // seconds of pull the bend needs
    var hold = swing;                             // hold exactly the swing...
    // ...and the road keeps turning for a short tail that the car's own momentum
    // covers after release: you let go and slide into line. A grid search over
    // press lead and tail puts the ideal line within 0.13 of the centreline for
    // the whole corner (it was 0.5 off with a fixed 0.35 s lead and no tail).
    var lengthM = vArr * (swing + cfg.curveTail) * cfg.curveSlack;
    var curve = { zStart: z, length: lengthM, deltaX: deltaX, severity: severity };

    var pressLead = cfg.curvePressLead;
    var w = NL.curveWindowAt(vArr);
    var plan = {
      vArr: vArr, zRef: z, curve: curve, obstacles: [],
      side: dir, pressLead: pressLead, hold: hold + pressLead, pull: pull,
      pressEarly: w.early, pressLate: w.late,
      eventSeconds: swing + cfg.curveTail + 0.5
    };
    var v = verifyRobust(plan);
    if (!v.ok) { NL._lastReject = v.cause; return null; }

    // A corner's window is authored, not derived, and it is the same at every
    // speed: the swing is what it is. Early presses cost the most (you run ahead
    // of the bend at the pivot's rate), so the window is verified out to both
    // edges above rather than assumed.
    var windowSeconds = w.early + w.late;

    return {
      kind: 'curve',
      z: z, len: lengthM, severity: severity,
      side: dir, breather: false,
      openHazardZ: vArr * (pressLead + w.early),
      closeHazardZ: vArr * (pressLead - w.late),
      windowSeconds: windowSeconds,
      idealPressLead: pressLead, idealHold: hold + pressLead, maxOff: v.settleOff,
      curve: curve, vArr: vArr, pull: pull,
      // the post stands INSIDE the bend, placed so it passes the car at the apex of
      // the swing: ahead when you throw, beside you at the tightest point, behind
      // only for the tail of the hold. Throwing at a post you have already passed
      // was fair and looked absurd.
      anchorLead: pressLead - (hold + pressLead) * cfg.pivotApex,
      allowSecondAnchor: false
    };
  }

  /* A combo is the same swing with a price on under-holding: a wreck against the
     OUTSIDE barrier at the exit of the bend, where a car that let go early ends
     up. The ideal swing clears it by construction; the verifier proves the
     sloppy ones do too, and the placement is pushed outward until they do. */
  function buildCombo(world, z, vArr, rng) {
    var severity = rng.weighted([['medium', 55], ['sharp', 45]]);
    var mag = cfg.curveDelta[severity];
    var dir = rng() < 0.5 ? -1 : 1;
    var deltaX = mag * dir;
    var pull = NL.pivotPullAt(vArr);
    var swing = mag / pull;
    var lengthM = vArr * (swing + cfg.curveTail) * cfg.curveSlack;
    var curve = { zStart: z, length: lengthM, deltaX: deltaX, severity: severity };

    var kind = rng.weighted([['wreck', 50], ['vehicle', 30], ['truck', 20]]);
    var len = cfg.obstacleLen[kind];
    var oz = z + lengthM * 1.02;                     // just past the exit of the bend
    var tPass = (len + cfg.carLengthZ) / vArr;

    // outside = the side the road turned AWAY from; the span runs from `inner`
    // out to the barrier, relative to the local centreline
    var inner = cfg.comboOutsideStart;
    var span = dir > 0 ? [-cfg.edgeSafe, -inner] : [inner, cfg.edgeSafe];

    var pressLead = cfg.curvePressLead;
    var w = NL.curveWindowAt(vArr);
    var hold = swing + pressLead;
    var plan = {
      vArr: vArr, zRef: z, curve: curve,
      obstacles: [{ z0: oz, len: len, lo: span[0], hi: span[1] }],
      side: dir, pressLead: pressLead, hold: hold, pull: pull,
      pressEarly: w.early, pressLate: w.late,
      eventSeconds: swing + cfg.curveTail + tPass + 0.8
    };
    var v = verifyRobust(plan);
    if (!v.ok) { NL._lastReject = v.cause; return null; }

    var windowSeconds = w.early + w.late;

    return {
      kind: 'combo',
      z: z, len: lengthM, severity: severity,
      obstacleKind: kind, obstacleZ: oz, obstacleLen: len,
      lo: span[0], hi: span[1], lanes: dir > 0 ? ['L'] : ['R'],
      side: dir, breather: false,
      openHazardZ: vArr * (pressLead + w.early),
      closeHazardZ: vArr * (pressLead - w.late),
      windowSeconds: windowSeconds,
      idealPressLead: pressLead, idealHold: hold, maxOff: v.settleOff,
      curve: curve, vArr: vArr, pull: pull,
      anchorLead: pressLead - hold * cfg.pivotApex,
      allowSecondAnchor: false
    };
  }

  /* ---------------------------------------------------------------------
   * Layout choice
   * ------------------------------------------------------------------- */
  function pickCandidate(world, z, vArr, rng) {
    var t = world.time;
    var warmUp = t < cfg.warmUpSeconds;
    var postCap = t > cfg.densityRampStart;
    // a turn makes another turn more likely — roads come in sequences
    var chained = world.lastWasCurve;


    var entries;
    if (warmUp) {
      // Learn the verb on dead-center hazards first, but only for a few
      // seconds — side lanes and a first turn arrive early, not at the end
      // of the whole warm-up window, so lane positioning is never something
      // a short session misses entirely.
      if (t < 6) entries = [['obs_C', 1]];
      else entries = [['obs_C', 46], ['obs_L', 13], ['obs_R', 13], ['curve_slight', 28]];
    } else {
      // obstacles are ~60-65 % of picks; corners come in chained pairs more often
      // than alone, because a road that turns tends to turn back
      entries = [
        ['obs_C', 25], ['obs_LC', 22], ['obs_CR', 22],
        // breathers: a hazard on one side that a CENTRED car passes untouched.
        // No post — the demand is to be where you should already be.
        ['obs_L', 12], ['obs_R', 12],
        ['curve_slight', chained ? 20 : 14],
        ['curve_medium', chained ? 16 : 12],
        ['curve_sharp', t > 35 ? (chained ? 12 : 9) * (t > 180 ? 1.35 : 1) : 0],
        ['combo', t > 120 ? 8 : 0]
      ];
    }
    var pick = rng.weighted(entries);
    if (pick === world.lastPick && rng() < 0.75) pick = rng.weighted(entries);
    world.lastPick = pick;
    var built = pickBuild(world, z, vArr, rng, pick);
    if (NL._rej) {                                   // test hook: rejection by kind
      var rk = NL._rej[pick] = NL._rej[pick] || { ok: 0, rej: 0, causes: {} };
      if (built) rk.ok++; else { rk.rej++; var c = NL._lastReject || '?'; rk.causes[c] = (rk.causes[c] || 0) + 1; }
    }
    return built;
  }

  function pickBuild(world, z, vArr, rng, pick) {

    switch (pick) {
      case 'obs_C':  return buildObstacle(world, z, vArr, rng, { lanes: ['C'], kind: rng.weighted(SINGLE_KINDS) });
      case 'obs_L':  return buildObstacle(world, z, vArr, rng, { lanes: ['L'], kind: rng.weighted(SINGLE_KINDS), innerShrink: cfg.sideInnerShrink });
      case 'obs_R':  return buildObstacle(world, z, vArr, rng, { lanes: ['R'], kind: rng.weighted(SINGLE_KINDS), innerShrink: cfg.sideInnerShrink });
      case 'obs_LC': return buildObstacle(world, z, vArr, rng, { lanes: ['L', 'C'], kind: rng.weighted(WIDE_KINDS) });
      case 'obs_CR': return buildObstacle(world, z, vArr, rng, { lanes: ['C', 'R'], kind: rng.weighted(WIDE_KINDS) });
      case 'curve_slight': return buildCurve(world, z, vArr, rng, 'slight');
      case 'curve_medium': return buildCurve(world, z, vArr, rng, 'medium');
      case 'curve_sharp':  return buildCurve(world, z, vArr, rng, 'sharp');
      case 'combo': return buildCombo(world, z, vArr, rng);
    }
    return null;
  }

  /* ---------------------------------------------------------------------
   * Commit an event into the world
   * ------------------------------------------------------------------- */
  function commit(world, ev, vArr) {
    var id = ++world.eventCount;
    var anchorZ = ev.z - vArr * (ev.anchorLead !== undefined ? ev.anchorLead : cfg.anchorLeadSeconds);

    var pickup = null;
    world.sinceP++; world.sinceB++;
    if (world.sinceB >= cfg.beamEveryNEvents && !ev.breather) { pickup = 'beam'; world.sinceB = 0; }
    else if (world.sinceP >= cfg.powerEveryNEvents && !ev.breather) { pickup = 'power'; world.sinceP = 0; }

    /* Two ropeable anchors, one per side (GDD 7.3's original ask).
     *
     * That only works because there are now two buttons, LEFT and RIGHT —
     * each ropes the post on its own side by name, so picking between a
     * safe anchor and a useless (or actively bad) one is a choice the player
     * can actually express, not a tie-break the nearest-post auto-attach
     * used to resolve on their behalf.
     *
     * The safe side (ev.side) carries the event's pickup, if any; the other
     * side is a real anchor too — pull it and you drift toward the hazard
     * itself. Breathers skip the safe side entirely (there's nothing to
     * rope to reach it, you're already there) but still light the hazard's
     * own side, so roping the wrong pole on a breather is a real, punishing
     * option rather than an impossibility. */
    var anchors = [];
    var isBend = (ev.kind === 'curve' || ev.kind === 'combo');
    if (!ev.breather) {
      anchors.push(NL.makeAnchor({
        z: anchorZ, side: ev.side, pickup: pickup, eventId: id, pull: ev.pull || 0,
        openHazardZ: ev.openHazardZ, closeHazardZ: ev.closeHazardZ, hazardZ: ev.z,
        pivot: isBend
      }));
    }
    if (ev.kind === 'obstacle') {
      anchors.push(NL.makeAnchor({
        z: anchorZ, side: -ev.side, eventId: id, pull: ev.pull || 0,
        openHazardZ: ev.openHazardZ, closeHazardZ: ev.closeHazardZ, hazardZ: ev.z
      }));
    }
    for (var i = 0; i < anchors.length; i++) world.anchors.push(anchors[i]);

    if (ev.kind === 'obstacle') {
      // commit the WHOLE group — the verifier already proved one swing clears it
      var g = ev.group || [{ z0: ev.z, len: ev.len, lo: ev.lo, hi: ev.hi }];
      for (var gi = 0; gi < g.length; gi++) {
        world.obstacles.push(NL.makeObstacle({
          kind: g[gi].kind || ev.obstacleKind, z0: g[gi].z0, len: g[gi].len,
          lanes: ev.lanes, lo: g[gi].lo, hi: g[gi].hi,
          eventId: id, phase: world.rng()
        }));
      }
    } else if (ev.kind === 'combo') {
      world.curves.push(ev.curve);
      world.lastCurveDir = ev.side;
      world.obstacles.push(NL.makeObstacle({
        kind: ev.obstacleKind, z0: ev.obstacleZ, len: ev.obstacleLen,
        lanes: ev.lanes, lo: ev.lo, hi: ev.hi, eventId: id, phase: world.rng()
      }));
    } else if (ev.kind === 'curve') {
      world.curves.push(ev.curve);
      world.lastCurveDir = ev.side;
    }

    var farZ = ev.z + ev.len + (ev.kind === 'combo' ? (ev.obstacleZ - ev.z) + ev.obstacleLen : 0);
    var evt = NL.makeEvent({
      id: id, kind: ev.kind, z: ev.z,
      idealPressDist: ev.z - vArr * ev.idealPressLead,
      idealHold: ev.idealHold,
      idealSide: ev.side,
      windowSeconds: ev.windowSeconds
    });
    evt.breather = !!ev.breather;
    evt.zEnd = farZ;
    world.events.push(evt);

    world.lastWasCurve = (ev.kind === 'curve' || ev.kind === 'combo');
    world.stats.events++;
    world.stats.minWindow = Math.min(world.stats.minWindow, ev.breather ? 99 : ev.windowSeconds);
    return ev;
  }

  // Move a built event later down the road. Verification is relative to zRef,
  // so a shifted event is exactly as fair as it was; only its address changes.
  function shiftEvent(ev, dz) {
    ev.z += dz;
    if (ev.group) for (var i = 0; i < ev.group.length; i++) ev.group[i].z0 += dz;
    if (ev.obstacleZ !== undefined) ev.obstacleZ += dz;
    if (ev.curve) ev.curve.zStart += dz;
  }

  NL.generator = {
    step: function (world) {
      // Only needs to reach a bit past the farthest anything ever draws
      // (relMax + 220, capped well under 1000m even at the speed cap) — the
      // old margin here (speed*6+480, over 2000m at the cap) was building
      // and holding several times as many live anchors/obstacles/events as
      // ever get drawn, and every per-frame loop over those arrays (render,
      // collision, anchor-state) was paying for all of it. This is a perf
      // fix only; the fairness floor (reactionSecondsAt et al) is untouched.
      var ahead = world.speed * 3 + 350;
      var guard = 0;
      while (world.nextZ < world.dist + ahead && guard++ < 12) {
        var z = world.nextZ;
        // speed the car will actually have on arrival (two-pass estimate)
        var tt = (z - world.dist) / world.speed;
        var vArr = NL.speedAt(world.time + tt);
        tt = (z - world.dist) / ((world.speed + vArr) * 0.5);
        vArr = NL.speedAt(world.time + tt);

        var ev = null;
        for (var tries = 0; tries < 14 && !ev; tries++) {
          ev = pickCandidate(world, z, vArr, world.rng);
          if (!ev) world.stats.rejections++;
        }
        if (!ev) {
          // guaranteed-safe fallback so the road is never empty
          ev = buildObstacle(world, z, vArr, world.rng, { lanes: ['C'], kind: 'debris' });
          world.stats.fallbacks++;
        }
        if (!ev) { world.nextZ += world.speed * cfg.ropeCycleSeconds; continue; }

        /* Hard authoring rule 3.5.5 — "the car must be able to return to centre
         * between hazards" — as a CALCULATION, not a constant, and now measured
         * at the only place it matters: the NEXT PRESS. The previous event told us
         * where its rope lets go and how long the car takes to settle from there;
         * this event knows how far ahead of its hazard the ideal press is. If the
         * press would land before the car is back on the centreline, the whole
         * event is pushed down the road until it does not.
         *
         * It used to be measured hazard-to-hazard with a constant allowance for
         * the next press lead, which is not a constant: a gentle early rope means
         * a long lead, and three left-hand obstacles in a row walked the perfect
         * bot into the barrier. */
        if (world.freeZ !== undefined) {
          var allowance = NL.pressAllowanceAt(vArr);
          var slack = cfg.gapSlackSeconds * NL.densityMultAt(world.time + tt)
                      * (0.55 + world.rng() * 0.75);
          // a breather has no press: the car must simply BE centred when it arrives
          var pressZ = ev.breather ? ev.z : ev.z - vArr * ev.idealPressLead;
          var needZ = world.freeZ + vArr * (allowance + slack);
          if (pressZ < needZ) shiftEvent(ev, needZ - pressZ);
        }

        commit(world, ev, vArr);

        var settleSeconds = (ev.maxOff || 0) / cfg.returnPerSec + cfg.returnTau + 0.15;
        var releaseZ = ev.z + vArr * (ev.idealHold - ev.idealPressLead);
        world.freeZ = ev.breather ? ev.z + ev.len : releaseZ + vArr * settleSeconds;   // centred again here
        var gapSeconds = (world.freeZ - ev.z) / vArr;
        world.stats.minGapSeconds = Math.min(world.stats.minGapSeconds, gapSeconds);

        // the next candidate starts where this one is physically over; the press
        // rule above pushes it further if it must
        world.nextZ = Math.max(ev.z + ev.len + vArr * 0.5,
                               (world.freeZ || 0) + vArr * cfg.minGapSeconds * 0.5);
      }
    },
    _verifyPlan: verifyPlan,
    _lanesSpan: lanesSpan
  };
})();

/* ===== 07-sim.js ===== */
/* NIGHT LINE — the simulation. No DOM, no rendering, fully deterministic.
 * This file is what the headless fairness test drives. */
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
      topSpeed: cfg.speedStart,

      car: { x: 0, vx: 0, mode: 'idle', anchor: null, missTimer: 0, holdTime: 0, lean: 0, slip: 0 },

      baseX: 0,
      curves: [],
      lastCurveDir: 0,
      obstacles: [],
      anchors: [],
      events: [],
      nextZ: 380,          // ~4 s of empty road: look, then act
      pruneAt: 0,
      eventCount: 0,
      sinceP: 0,
      sinceB: 2,

      power: 1,
      beam: 0,
      beamActive: false,

      score: 0,
      alive: true,
      deathCause: null,
      deathAt: null,
      shake: 0,
      flash: 0,

      envSets: ['desert', 'city'],
      envPeriod: 900,

      bot: { holdUntil: -1, holdSide: 0 },
      stats: { events: 0, rejections: 0, fallbacks: 0, minWindow: 99, minGapSeconds: 99 },
      nearMiss: 0,    // decays after a close pass; drives the spark and the tick
      nearMissSide: 1,
      cleared: 0,     // hazards survived this run — the thing that grows
      nearMisses: 0,
      // The chain: consecutive hazards cleared without scraping the barrier. A
      // near miss KEEPS it (that was skill); a wall graze breaks it. It never
      // touches the score — seconds are the score — it is the goal inside the goal.
      streak: 0,
      streakBest: 0,
      streakPulse: 0,   // flash on increment, decays
      streakBroke: 0,   // flash on break, decays
      grazed: false,    // barrier warning tripped since the last clear
      deathHint: null,  // what the death frame points at
      trail: [],        // the last ~2.5 s of (dist, x): the death frame rewinds into it
      speedTier: 0,
      beatBest: 0,    // >0 while the "you have passed your best" beat plays
      skid: [],       // tyre marks laid down while the car is sliding
      skidAt: 0,
      fx: []          // transient events for audio/render: {type, t}
    };
    world.envSets = world.rng() < 0.5 ? ['desert', 'city'] : ['city', 'desert'];
    return world;
  };

  function emit(world, type, data) {
    world.fx.push({ type: type, data: data || null });
  }

  function anchorWindowOpen(world, a) {
    if (a.used) return false;
    var hz = a.hazardZ - world.dist;
    return hz <= a.openHazardZ && hz >= a.closeHazardZ;
  }

  // The nearest open anchor on a GIVEN side — side is now named by which
  // button was pressed, so there is no tie-break left to resolve: the input
  // itself says which post the player means.
  function findAnchorSide(world, side) {
    var best = null, bestZ = Infinity;
    for (var i = 0; i < world.anchors.length; i++) {
      var a = world.anchors[i];
      if (a.side !== side) continue;
      if (!anchorWindowOpen(world, a)) continue;
      var rz = a.z - world.dist;
      if (rz < bestZ) { best = a; bestZ = rz; }
    }
    return best;
  }

  function collect(world, a) {
    if (a.collected || !a.pickup) return;
    a.collected = true;
    if (a.pickup === 'power') {
      world.power = Math.min(1, world.power + cfg.powerPickup);
      emit(world, 'pickup-power');
    } else {
      world.beam = cfg.beamPickup;
      world.beamActive = true;
      emit(world, 'pickup-beam');
    }
  }

  /* What the death frame points at: the post that would have saved you. For an
     obstacle or a curve that is the event's own anchor if it went unused; for a
     barrier death it is the moment you should have let go, which is not a place
     on the road, so the frame says so in words instead. */
  function deathHint(world, cause) {
    var ev = null;
    if (cause === 'barrier' && world.car.anchor) {
      // the rope that was held too long: rewind to where it should have let go
      for (var k = 0; k < world.events.length; k++) if (world.events[k].id === world.car.anchor.eventId) ev = world.events[k];
      if (ev) return { kind: 'release', rewindDist: ev.idealPressDist + ev.idealHold * world.speed };
      return { kind: 'release' };
    }
    var bd = Infinity;
    for (var i = 0; i < world.events.length; i++) {
      var e = world.events[i];
      var d = Math.abs(e.z - world.dist);
      if (d < bd) { bd = d; ev = e; }
    }
    if (!ev) return null;
    for (var j = 0; j < world.anchors.length; j++) {
      var a = world.anchors[j];
      if (a.eventId === ev.id) {
        return { kind: a.used ? 'late' : 'anchor', anchorId: a.id, side: a.side, rewindDist: ev.idealPressDist };
      }
    }
    return null;
  }

  function die(world, cause) {
    if (!world.alive) return;
    world.alive = false;
    world.deathCause = cause;
    world.deathAt = world.time;
    world.deathHint = deathHint(world, cause);
    if (world.deathHint && world.deathHint.anchorId !== undefined) {
      // light the post the death frame will ring; nothing updates anchors after death
      for (var q = 0; q < world.anchors.length; q++) if (world.anchors[q].id === world.deathHint.anchorId) world.anchors[q].state = 'active';
    }
    world.shake = 1;
    if (world.car.anchor) { world.car.anchor.state = 'passed'; world.car.anchor = null; }
    world.car.mode = 'idle';
    world.car.vx *= 0.2;
    emit(world, 'crash', cause);
  }

  function clearedOne(world) {
    if (world.grazed) {
      if (world.streak >= 3) { world.streakBroke = 1; emit(world, 'streak-break'); }
      world.streak = 0;
      world.grazed = false;
      return;
    }
    world.streak++;
    world.streakPulse = 1;
    if (world.streak > world.streakBest) world.streakBest = world.streak;
    if (world.streak === 5 || world.streak === 10 || world.streak % 20 === 0) emit(world, 'streak-mark');
  }

  NL.stepWorld = function (world, dt, input) {
    if (!world.alive) {
      world.shake = Math.max(0, world.shake - dt * 2.2);
      return;
    }

    world.time += dt;
    world.speed = NL.speedAt(world.time);
    if (world.speed > world.topSpeed) world.topSpeed = world.speed;
    world.dist += world.speed * dt;
    world.score = world.time;
    world.shake = Math.max(0, world.shake - dt * 3);
    if ((world.trailN = (world.trailN || 0) + 1) & 1) {
      world.trail.push({ d: world.dist, x: world.car.x, lean: world.car.lean, slip: world.car.slip });
      if (world.trail.length > 170) world.trail.shift();
    }
    world.streakPulse = Math.max(0, world.streakPulse - dt * 2.4);
    world.streakBroke = Math.max(0, world.streakBroke - dt * 1.6);
    world.flash = Math.max(0, world.flash - dt * 4);
    world.nearMiss = Math.max(0, world.nearMiss - dt * 2.2);
    world.beatBest = Math.max(0, world.beatBest - dt * 0.7);

    // "you are moving faster now" — a beat every speedTierStep so the climb is felt
    var tier = Math.floor((world.speed - cfg.speedStart) / cfg.speedTierStep);
    if (tier > world.speedTier) { world.speedTier = tier; emit(world, 'speed-up'); }

    /* ---- meters (GDD 7) ---- */
    if (world.beamActive) {
      world.beam -= dt / cfg.beamDuration;
      if (world.beam <= 0) { world.beam = 0; world.beamActive = false; emit(world, 'beam-off'); }
    }
    world.power = Math.max(0, world.power - cfg.powerDrainPerSec * dt);

    /* ---- generation ---- */
    NL.generator.step(world);

    /* ---- rope state machine (GDD 3.1) ---- */
    var car = world.car;
    if (car.missTimer > 0) car.missTimer = Math.max(0, car.missTimer - dt);

    if (car.mode !== 'attached') {
      var pressedSide = input.leftJustPressed ? -1 : (input.rightJustPressed ? 1 : 0);
      if (pressedSide && car.missTimer <= 0) {
        var a = findAnchorSide(world, pressedSide);
        if (a) {
          car.mode = 'attached';
          car.anchor = a;
          car.holdTime = 0;
          a.state = 'attached';
          a.used = true;
          collect(world, a);
          world.flash = 1;
          emit(world, 'rope-attach');
        } else {
          car.missTimer = cfg.missCooldown;
          emit(world, 'rope-miss');
        }
      }
    }

    if (car.mode === 'attached') {
      // whichever side you roped, releasing THAT button lets go — the other
      // button does nothing until you do, same as it would if there were
      // still only one rope in flight
      var stillHeld = car.anchor.side < 0 ? input.leftHeld : input.rightHeld;
      if (!stillHeld) {
        car.anchor.state = 'passed';
        car.anchor = null;
        car.mode = 'returning';
        emit(world, 'rope-detach');
      }
    }

    var centre = NL.road.centreAt(world, world.dist);

    // No clamp, no ceiling, no auto-stop. Holding steers you off the road, and
    // the car's own momentum carries it a little further than you asked.
    if (car.mode === 'attached') car.holdTime += dt;
    NL.carStep(car, car.mode, car.anchor ? car.anchor.side : 0, centre, dt, car.anchor ? car.anchor.pull : 0);
    if (car.mode === 'returning' && NL.settled(car, centre)) car.mode = 'idle';

    // slip = how sideways the car is right now; drives the yaw, the tyre marks
    // and the skid audio. This is the drift.
    car.slip = NL.clamp(car.vx / cfg.driftPerSec, -1.6, 1.6);
    car.lean = NL.lerp(car.lean, car.slip, Math.min(1, dt * 9));

    if (Math.abs(car.vx) > cfg.skidThreshold && world.dist - world.skidAt > 1.6) {
      world.skidAt = world.dist;
      world.skid.push({
        z: world.dist, x: car.x,
        a: NL.clamp((Math.abs(car.vx) - cfg.skidThreshold) / cfg.driftPerSec, 0, 1)
      });
      if (world.skid.length > 140) world.skid.shift();
    }

    /* ---- failure (GDD 9) ---- */
    var off = car.x - centre;
    if (Math.abs(off) > cfg.edgeSafe * 0.92) world.grazed = true;   // the barrier warning tripped
    if (Math.abs(off) >= cfg.edgeSafe) {
      var curve = NL.road.activeCurveAt(world, world.dist);
      var cause = 'barrier';
      if (curve && NL.sign(off) === -NL.sign(curve.deltaX) && car.mode !== 'attached') cause = 'curve';
      die(world, cause);
      return;
    }

    for (var i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i];
      if (world.dist >= o.z0 + o.len && !o.settled) {
        o.settled = true;
        world.cleared++;
        clearedOne(world);
        if (o.minGap !== undefined) {
          // The tighter the clearance, the more skill it took — rate it like a
          // rhythm game (OK/GOOD/PERFECT) instead of leaving a clean dodge with
          // no readout at all beyond the score ticking up.
          var rating = o.minGap < cfg.nearMissGap ? 'perfect' : (o.minGap < 0.30 ? 'good' : 'ok');
          emit(world, 'dodge-' + rating, { side: o.missSide || 1 });
          if (rating === 'perfect') {
            world.nearMisses++;
            world.nearMiss = 1;
            world.nearMissSide = o.missSide || 1;
            emit(world, 'near-miss');
          }
        }
        continue;
      }
      if (world.dist + cfg.carLengthZ <= o.z0 || world.dist >= o.z0 + o.len) continue;
      var oc = NL.road.centreAt(world, o.z0);
      var lo = oc + o.lo, hi = oc + o.hi;
      if (car.x + cfg.carHalfWidth > lo && car.x - cfg.carHalfWidth < hi) {
        die(world, 'obstacle');
        return;
      }
      var gap = car.x > hi ? (car.x - cfg.carHalfWidth) - hi : lo - (car.x + cfg.carHalfWidth);
      if (o.minGap === undefined || gap < o.minGap) {
        o.minGap = gap;
        o.missSide = car.x > hi ? -1 : 1;   // which side the hazard flashed past on
      }
    }

    // curves count as hazards cleared too — half the run is turns now
    for (var ci = 0; ci < world.curves.length; ci++) {
      var cv = world.curves[ci];
      if (!cv.settled && world.dist > cv.zStart + cv.length) { cv.settled = true; world.cleared++; clearedOne(world); }
    }

    /* ---- anchor states + pruning ---- */
    for (var j = 0; j < world.anchors.length; j++) {
      var an = world.anchors[j];
      if (an.state === 'attached') continue;
      if (an.used || an.z - world.dist < -6) an.state = 'passed';
      else an.state = anchorWindowOpen(world, an) ? 'active' : 'dormant';
    }

    if (world.dist - world.pruneAt > 200 || world.pruneAt === undefined) {
      world.pruneAt = world.dist;
      world.obstacles = world.obstacles.filter(function (o) { return o.z0 + o.len > world.dist - 80; });
      world.anchors = world.anchors.filter(function (a2) { return a2.z > world.dist - 140 || a2 === world.car.anchor; });
      world.events = world.events.filter(function (e) { return (e.zEnd || e.z) > world.dist - 120; });
      world.skid = world.skid.filter(function (k) { return k.z > world.dist - 260; });
      NL.road.prune(world);
    }
  };

  /* ---------------------------------------------------------------------
   * Test bot. Perfect-information by design — it is the fairness oracle
   * (build plan section 5), not an AI opponent.
   * ------------------------------------------------------------------- */
  NL.botInput = function (world, opts) {
    opts = opts || {};
    var delay = opts.delay || 0;
    var jitter = opts.jitter || 0;
    var bot = world.bot;

    if (bot.holdUntil > world.time) {
      return bot.holdSide < 0
        ? { leftHeld: true, rightHeld: false, leftJustPressed: false, rightJustPressed: false }
        : { leftHeld: false, rightHeld: true, leftJustPressed: false, rightJustPressed: false };
    }
    var pressedSide = 0;

    for (var i = 0; i < world.events.length; i++) {
      var ev = world.events[i];
      if (ev.botDone) continue;
      if (ev.breather) { if (world.dist > ev.z) ev.botDone = true; continue; }
      if (ev.z + 150 < world.dist) { ev.botDone = true; continue; }
      /* Human error is variance, not a constant lag: a fixed delay inside a
         symmetric window never fails, and a fixed delay outside it always does,
         so neither says anything about the difficulty curve. `sigma` is the
         spread of the press error (gaussian), `delay` its bias. The decision is
         made once per event, when the event first comes into range. */
      if (ev.botErr === undefined) {
        var g = 0;
        if (opts.sigma) {
          var u1 = Math.max(1e-9, world.rng()), u2 = world.rng();
          g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * opts.sigma;
        }
        ev.botErr = delay + g;
      }
      var pressDist = ev.idealPressDist + ev.botErr * world.speed;
      if (world.dist >= pressDist) {
        ev.botDone = true;
        var jit = jitter ? (world.rng() * 2 - 1) * jitter : 0;
        bot.holdUntil = world.time + Math.max(0.05, ev.idealHold + jit);
        bot.holdSide = ev.idealSide;
        pressedSide = ev.idealSide;
        break;
      }
    }
    return {
      leftHeld: pressedSide < 0, rightHeld: pressedSide > 0,
      leftJustPressed: pressedSide < 0, rightJustPressed: pressedSide > 0
    };
  };
})();

/* ===== 08-light.js ===== */
/* NIGHT LINE — visibility.
 *
 * GDD 7.4: the power meter is simultaneously the atmosphere system and the
 * difficulty system. It is protected by keeping VISIBILITY and the THROW WINDOW
 * completely separate concepts:
 *   isResolved() — can I see it?   depends on light
 *   window       — can I rope it?  depends only on distance-in-seconds (06)
 * Anchors are self-lit and drawn straight through the darkness, so the anchor is
 * always the first thing you learn about a hazard (hard authoring rule 3).
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
      var secs = world.beamActive
        ? cfg.lightBeamSeconds
        : NL.lerp(cfg.lightZeroSeconds, cfg.lightFullSeconds, world.power);
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
    coneHalfWidth: function (world) {
      return world.beamActive ? 1.55 : 1.95;
    },

    // 0 -> safe, 1 -> about to hit the barrier. Drives every "running out of road" cue.
    edgeProximity: function (world) {
      var off = Math.abs(world.car.x - NL.road.centreAt(world, world.dist));
      return NL.clamp((off - cfg.edgeSafe * 0.55) / (cfg.edgeSafe * 0.45), 0, 1);
    },

    lowPower: function (world) {
      return world.power < cfg.lowPowerWarn && !world.beamActive;
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

  // The car's own art (drawCarBody, below) is drawn in a fixed 148x104-unit
  // box; CAR_ASPECT is that box's own height/width so every caller that needs
  // to size or position relative to the car (beams, the rope's origin, the
  // car itself) agrees on its shape without each re-deriving it.
  var CAR_W_FRAC = 0.34;
  var CAR_ASPECT = 104 / 148;

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
    var edgeProx = NL.light.edgeProximity(world);
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
    drawRoad(world, relMax, edgeProx);
    drawRoadside(world, relMax);
    drawSkid(world);
    drawObstacles(world, relMax, tNow);
    drawDust(world);
    drawDarkness(world, vis);
    drawHorizonGlow(world);
    // Reflectors and edge lines are self-lit: the amount of road left must be
    // legible at a glance even at zero headlight power (GDD 4, 3.4).
    drawEdgesLit(world, relMax, edgeProx);
    drawAnchors(world, relMax, tNow);
    drawRope(world, tNow, edgeProx);
    drawCar(world, tNow);
    drawNearMiss(world);
    drawEdgeWarning(world, edgeProx);
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

  function drawRoad(world, relMax, edgeProx) {
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
     Always faintly readable; brightens hard on the side you are running out of. */
  function drawEdgesLit(world, relMax, edgeProx) {
    var pts = roadSamples(world, Math.min(relMax, NL.light.visibleDistance(world) * 1.2 + 90));
    drawEdgeLines(world, pts, edgeProx);
    drawBarrier(world, relMax, edgeProx);
    drawReflectors(world, relMax, edgeProx);
  }

  function drawReflectors(world, relMax, edgeProx) {
    var period = spacing(cfg.reflectorPeriod);
    var base = Math.floor(world.dist / period) * period;
    var carSide = NL.sign(world.car.x - NL.road.centreAt(world, world.dist));
    for (var k = 0; k < 40; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < -10 || rel > relMax) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var r = Math.max(1, 0.016 * view.roadHalfPx * s);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = sx(rel, c + sgn * 0.985);
        if (px < -30 || px > view.W + 30) continue;
        var hot = sgn === carSide ? Math.pow(edgeProx, 1.7) : 0;
        ctx.globalAlpha = NL.clamp(0.30 + 0.65 * hot - rel / (relMax * 1.6), 0.05, 0.95);
        ctx.fillStyle = hot > 0.03 ? T.edgeWarn : 'rgba(255,236,200,0.9)';
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

  function drawEdgeLines(world, pts, edgeProx) {
    var warm = edgeProx;
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var x = sx(pts[i].rel, pts[i].c + sgn * 0.985);
        if (i === 0) ctx.moveTo(x, pts[i].y); else ctx.lineTo(x, pts[i].y);
      }
      var carSide = NL.sign(world.car.x - NL.road.centreAt(world, world.dist));
      var lit = sgn === carSide ? Math.pow(warm, 1.7) : Math.pow(warm, 1.7) * 0.25;
      ctx.strokeStyle = lit > 0.02
        ? 'rgba(255,179,71,' + (0.25 + 0.75 * lit).toFixed(3) + ')'
        : T.edgeLine;
      ctx.lineWidth = 1.6 + 2.6 * lit;
      ctx.globalAlpha = 0.30 + 0.6 * lit;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawBarrier(world, relMax, edgeProx) {
    var period = spacing(cfg.barrierPeriod);
    var base = Math.floor(world.dist / period) * period;
    for (var k = 0; k < 44; k++) {
      var z = base + k * period, rel = z - world.dist;
      if (rel < 0 || rel > relMax) continue;
      var c = NL.road.centreAt(world, z), s = sc(rel), y = sy(rel);
      var h = 0.20 * view.roadHalfPx * s;
      var carSide = NL.sign(world.car.x - NL.road.centreAt(world, world.dist));
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = sx(rel, c + sgn * 1.06);
        if (px < -60 || px > view.W + 60) continue;
        var hot = sgn === carSide ? Math.pow(edgeProx, 1.7) : 0;
        ctx.fillStyle = hot > 0.02
          ? 'rgba(255,138,61,' + (0.35 + 0.65 * hot).toFixed(3) + ')'
          : T.barrier;
        ctx.globalAlpha = NL.clamp(1 - rel / (relMax * 0.95), 0.1, 0.9);
        ctx.fillRect(px - Math.max(1, 0.02 * view.roadHalfPx * s), y - h, Math.max(2, 0.04 * view.roadHalfPx * s), h);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- roadside scenery (unlit posts: an anchor reads as "one of these, lit") -- */
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
        var px = sx(rel, c + sgn * cfg.ropeSideOffset);
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
      var px = sx(rel, c + side * (cfg.ropeSideOffset + 0.22 + h2 * 0.5));
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
      // Linear falloff (litAmount itself is quadratic), and pushed well past
      // full linear brightness, so the silhouette is legible from most of
      // the lit distance instead of only its closest third — the pick
      // between posts needs the obstacle itself to already read, not just
      // the posts either side of it. Still zero past the lit distance; only
      // how fast it ramps up inside it changed.
      var fade = NL.clamp(Math.sqrt(NL.light.litAmount(world, rel0)) * 1.8, 0, 1);

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
    var warmth = world.beamActive ? 0.17 : 0.11;
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

  /* ---- anchors (self-lit, drawn through the dark) -------------------- */
  function drawAnchors(world, relMax, tNow) {
    var list = world.anchors.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var rel = a.z - world.dist;
      if (rel < -12 || rel > relMax + 220) continue;
      var c = NL.road.centreAt(world, a.z), s = sc(rel), y = sy(rel);
      var px = sx(rel, c + a.side * cfg.ropeSideOffset);
      if (px < -80 || px > view.W + 80) continue;
      var pivot = a.pivot;
      var h = (pivot ? 0.80 : 0.62) * view.roadHalfPx * s;
      var w = Math.max(2, 0.035 * view.roadHalfPx * s);

      var active = a.state === 'active' || a.state === 'attached';
      var pulse = active ? 0.72 + 0.28 * Math.sin(tNow * 9) : 0;
      var col = a.pickup === 'power' ? T.pickupPower : (a.pickup === 'beam' ? T.pickupBeam : T.anchorActive);
      var alpha = a.state === 'passed' ? 0.10 : (active ? 1 : 0.34);

      ctx.save();
      ctx.globalAlpha = alpha;
      if (active) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 14 + 20 * pulse;
      }
      ctx.fillStyle = active ? col : T.anchorDim;
      ctx.fillRect(px - w / 2, y - h, w, h);
      if (pivot) {
        /* A bend post carries a chevron board pointing into the corner — the way a
           real road marks a bend — so "this one throws you hard" is learned by
           sight before it has to be learned by dying. */
        var bw = w * 4.2, bh = w * 3.0, by = y - h * 0.62;
        ctx.fillStyle = active ? col : T.anchorDim;
        ctx.fillRect(px - bw / 2, by - bh / 2, bw, bh);
        ctx.fillStyle = '#0b0e14';
        ctx.globalAlpha = alpha * 0.9;
        var d = a.side;                       // chevron points toward the inside of the bend
        for (var cN = -1; cN <= 1; cN += 2) {
          ctx.beginPath();
          ctx.moveTo(px + cN * bw * 0.32 - d * bw * 0.12, by - bh * 0.42);
          ctx.lineTo(px + cN * bw * 0.32 + d * bw * 0.14, by);
          ctx.lineTo(px + cN * bw * 0.32 - d * bw * 0.12, by + bh * 0.42);
          ctx.lineTo(px + cN * bw * 0.32 - d * bw * 0.02, by + bh * 0.42);
          ctx.lineTo(px + cN * bw * 0.32 + d * bw * 0.24, by);
          ctx.lineTo(px + cN * bw * 0.32 - d * bw * 0.02, by - bh * 0.42);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = alpha;
      }
      if (active) {
        ctx.fillStyle = a.state === 'attached' ? T.anchorHot : col;
        ctx.globalAlpha = alpha * (0.6 + 0.4 * pulse);
        ctx.fillRect(px - w * 1.35, y - h - w * 1.6, w * 2.7, w * 2.4);
      }
      ctx.restore();

      if (a.pickup && a.state !== 'passed') {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, w * 0.5);
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(px, y - h * 0.55, w * 2.2 + Math.sin(tNow * 4 + a.id) * w * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---- rope ---------------------------------------------------------- */
  function drawRope(world, tNow, edgeProx) {
    var a = world.car.anchor;
    if (!a) return;
    var rel = a.z - world.dist;
    var c = NL.road.centreAt(world, a.z);
    var ax, ay, behind = rel < 0;
    if (!behind) {
      ax = sx(rel, c + a.side * cfg.ropeSideOffset);
      ay = sy(rel) - 0.5 * view.roadHalfPx * sc(rel);
    } else {
      /* Once the post is past the car the perspective projection has nothing
         sensible to say about it (it clamps to a point below the screen), so the
         far end is placed by hand: out to the side by the post's lateral offset,
         and down the screen by how far behind it is. The rope reads as trailing
         back to something you have just passed, which is what it is doing. */
      var lat = (c + a.side * cfg.ropeSideOffset) - world.car.x;
      var back = Math.min(1, -rel / 90);                    // 90 m behind = a screen-height down
      ax = sx(0, world.car.x) + lat * view.roadHalfPx * (1 + back * 0.8);
      ay = view.carY + back * view.H * 0.9;
    }

    // Thrown from the NOSE of the car, not from behind it. Computed in the car's
    // own rotated frame so the origin swings with the body during a drift — the
    // same frame the headlights use, so rope and beams leave from the same place.
    var w = CAR_W_FRAC * view.roadHalfPx;
    var h = w * CAR_ASPECT;
    var ang = (world.car.lean || 0) * 0.42;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var ox = a.side * w * 0.34, oy = -h * 0.52;
    var cx = sx(0, world.car.x) + ox * ca - oy * sa;
    var cy = (view.carY - h * 0.40) + ox * sa + oy * ca;

    var strain = edgeProx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = strain > 0.05
      ? 'rgba(255,138,92,' + (0.55 + 0.45 * strain).toFixed(3) + ')'
      : T.rope;
    ctx.lineWidth = view.px * (1.4 + 1.2 * strain);
    ctx.shadowColor = strain > 0.4 ? T.ropeStrain : T.rope;
    ctx.shadowBlur = 10 + 14 * strain;
    var sag = behind ? 0 : (1 - strain) * 14 + Math.sin(tNow * 22) * strain * 2.2;  // taut once it trails
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo((cx + ax) / 2, (cy + ay) / 2 + sag, ax, ay);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- car's own art --------------------------------------------------
   * A flared "flying buttress" coupe with real race hardware — 5-spoke-style
   * tires tucked under overlapping fenders, a GT wing mounted low on the
   * trunk deck, a finned diffuser, twin exhaust — drawn in the same language
   * as every hazard/anchor in this game: flat silhouette masses plus one
   * pale "catches the light first" stripe, edges defined by colour and glow
   * rather than a black outline. Drawn in a fixed mockup coordinate space
   * (centred on x=160, roof at y=118) that maps onto the local frame
   * drawCar already set up, so this drops straight into the same pivot
   * drawCar/beams/the rope already use. */
  function drawCarBody(w, h) {
    // maps this function's fixed mockup coordinates (built around a centre
    // of x=160, roof at y=118) onto the local frame drawCar already set up:
    // translate first so mockup (160,118) lands on local (0,-h*0.58) — the
    // sprite's old top-centre pivot — THEN scale, so a plain -160/-118
    // shift is all every coordinate below needs.
    var S = w / 148;
    var cx = 160;
    ctx.save();
    ctx.translate(0, -h * 0.58);
    ctx.scale(S, S);
    ctx.translate(-cx, -118);

    // From directly behind, a wheel is NOT a side-on face with spokes fanned
    // out — you only see the tire's sidewall as a narrow sliver peeking past
    // the fender, with a hint of rim and a brake-caliper dot inside it, edge
    // defined by a soft glow rather than a black stroke
    function wheel(x) {
      ctx.save();
      roundRect(x - 9, 194, 18, 28, 7);
      ctx.fillStyle = '#0a0a0e'; ctx.fill();
      ctx.fillStyle = '#7d8494';
      ctx.beginPath(); ctx.ellipse(x, 208, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.rearLight;
      ctx.beginPath(); ctx.ellipse(x, 208, 2.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a20';
      ctx.beginPath(); ctx.ellipse(x, 208, 1.1, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = T.rope; ctx.shadowBlur = 4;
      ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(168,236,255,.55)';
      ctx.beginPath(); ctx.ellipse(x, 208, 5, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    wheel(cx - 64);
    wheel(cx + 64);

    // dramatic flying-buttress flare: narrow cabin, wide shoulder, widest at
    // the rear haunch — the valance runs a little past the wheels (72 vs.
    // their 64) so the fender overlaps their top like a real wheel arch
    // instead of them floating outside the silhouette
    var bodyPts = [
      { x: cx - 26, y: 118 }, { x: cx + 26, y: 118 },
      { x: cx + 62, y: 150 }, { x: cx + 74, y: 182 }, { x: cx + 72, y: 206 },
      { x: cx - 72, y: 206 }, { x: cx - 74, y: 182 }, { x: cx - 62, y: 150 }
    ];
    function bodyPath() {
      ctx.beginPath();
      ctx.moveTo(bodyPts[0].x, bodyPts[0].y);
      for (var i = 1; i < bodyPts.length; i++) ctx.lineTo(bodyPts[i].x, bodyPts[i].y);
      ctx.closePath();
    }

    // two flat masses (main panel + a darker shadow mass low on the body) —
    // the same technique drawVehicle/drawLongBox use on the real hazards —
    // plus one pale hazardTape-cream stripe as the sole bright accent
    bodyPath(); ctx.fillStyle = T.carBody; ctx.fill();
    ctx.save();
    bodyPath(); ctx.clip();
    ctx.fillStyle = 'rgba(95,40,20,.4)';
    ctx.fillRect(cx - 90, 180, 180, 30);
    ctx.fillStyle = 'rgba(95,40,20,.6)';
    ctx.fillRect(cx - 90, 196, 180, 14);
    ctx.fillStyle = T.hazardTape;
    ctx.fillRect(cx - 74, 150, 148, 4);
    ctx.restore();

    var glassPts = [
      { x: cx - 26, y: 118 }, { x: cx + 26, y: 118 }, { x: cx + 40, y: 146 }, { x: cx - 40, y: 146 }
    ];
    function glassPath() {
      ctx.beginPath();
      ctx.moveTo(glassPts[0].x, glassPts[0].y);
      for (var i = 1; i < glassPts.length; i++) ctx.lineTo(glassPts[i].x, glassPts[i].y);
      ctx.closePath();
    }
    glassPath(); ctx.fillStyle = T.carRoof; ctx.fill();
    ctx.save();
    glassPath(); ctx.clip();
    ctx.fillStyle = 'rgba(160,210,255,.32)';
    ctx.beginPath();
    ctx.moveTo(cx - 34, 146); ctx.lineTo(cx - 4, 118); ctx.lineTo(cx + 8, 118); ctx.lineTo(cx - 22, 146);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // thin side-window slivers at the flanks
    function sideWindow(sign) {
      ctx.save();
      ctx.fillStyle = T.carRoof;
      var x0 = cx + sign * 58, x1 = cx + sign * 40;
      ctx.beginPath();
      ctx.moveTo(x0, 150); ctx.lineTo(x1, 146); ctx.lineTo(x1, 156); ctx.lineTo(x0, 160);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    sideWindow(1); sideWindow(-1);

    // engine deck louvers between the glass and the taillights
    ctx.save();
    bodyPath(); ctx.clip();
    ctx.strokeStyle = 'rgba(95,40,20,.5)';
    ctx.lineWidth = 2;
    for (var li = 0; li < 5; li++) {
      var ly2 = 152 + li * 6;
      ctx.beginPath(); ctx.moveTo(cx - 28, ly2); ctx.lineTo(cx + 28, ly2); ctx.stroke();
    }
    ctx.restore();

    // GT wing, mounted low on the trunk deck — below the glass (which ends
    // at 146), sitting on the deck surface — rather than floating high above
    // the roofline; reads as bolted to the trunk, not hovering over the car
    ctx.fillStyle = T.carTrim;
    ctx.fillRect(cx - 36, 158, 4, 12);
    ctx.fillRect(cx + 32, 158, 4, 12);
    ctx.fillRect(cx - 44, 148, 7, 16);
    ctx.fillRect(cx + 37, 148, 7, 16);
    roundRect(cx - 44, 148, 88, 8, 2);
    ctx.fillStyle = T.carTrim; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(cx - 40, 153, 80, 2);

    // taillight clusters — horizontal light bars, not vertical blocks, with
    // a glow that spreads sideways to match: canvas shadowBlur is always
    // radial, so the halo is drawn inside a horizontally-scaled transform
    // (stretch x, squash y) to fake an anisotropic horizontal glow instead
    function taillight(lx) {
      var tw = 34, th = 14, tly = 182;
      ctx.save();
      roundRect(lx - tw / 2, tly, tw, th, 4);
      ctx.fillStyle = T.hazardDark; ctx.fill();

      ctx.save();
      ctx.translate(lx, tly + th / 2);
      ctx.scale(1.7, 0.5);
      ctx.shadowColor = T.rearLight; ctx.shadowBlur = 22;
      ctx.fillStyle = T.rearLight;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      roundRect(lx - tw / 2, tly, tw, th, 4); ctx.clip();
      ctx.fillStyle = T.rearLight; ctx.fillRect(lx - tw / 2, tly, tw, th);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(lx - tw / 2 + 2, tly + 2, tw - 4, 3);
      ctx.restore();
      ctx.restore();
    }
    taillight(cx - 47);
    taillight(cx + 47);

    // pale center light bar in the established hazardTape cream
    roundRect(cx - 26, 184, 52, 12, 2);
    ctx.fillStyle = T.hazardTape; ctx.fill();

    roundRect(cx - 16, 203, 32, 9, 2); ctx.fillStyle = '#3a2f1a'; ctx.fill();
    ctx.fillStyle = 'rgba(255,232,196,.35)';
    ctx.fillRect(cx - 14, 204, 28, 2);

    // race-diffuser skirt between the wheels, finned like a real underbody vane
    roundRect(cx - 50, 208, 100, 10, 2);
    ctx.fillStyle = '#14141a'; ctx.fill();
    ctx.save();
    roundRect(cx - 50, 208, 100, 10, 2); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2;
    for (var di = -5; di <= 5; di++) {
      var dx = cx + di * 8;
      ctx.beginPath(); ctx.moveTo(dx, 208); ctx.lineTo(dx + 3, 218); ctx.stroke();
    }
    ctx.restore();

    // exhaust tips, glow tinted to the rope's icy blue
    function exhaust(x) {
      ctx.fillStyle = '#0a0a0e';
      ctx.beginPath(); ctx.ellipse(x, 210, 6, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = T.rope; ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(168,236,255,.75)';
      ctx.beginPath(); ctx.ellipse(x, 209, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    exhaust(cx - 20); exhaust(cx - 11);
    exhaust(cx + 11); exhaust(cx + 20);

    ctx.fillStyle = T.carTrim;
    roundRect(cx - 66, 138, 10, 8, 2); ctx.fill();
    roundRect(cx + 56, 138, 10, 8, 2); ctx.fill();

    ctx.restore();
  }

  /* ---- car -------------------------------------------------------------
   * Drawn after the darkness pass so it is always visible. Rotation is about
   * the car's middle rather than its tail, so the yaw during a drift reads
   * as the whole car stepping out. */
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
    ctx.ellipse(0, h * 0.40, w * 0.46, h * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.95;
    drawCarBody(w, h);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(0, -h * 0.58, 0, h * 0.42);
    g.addColorStop(0, 'rgba(' + T.headlight + ',0.09)');
    g.addColorStop(1, 'rgba(' + T.headlight + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h * 0.58, w, h);
    ctx.restore();

    // the taillights already glow on their own; this makes them flare
    // brighter under drift, on top of that base glow
    var glow = 0.22 + 0.5 * Math.abs(slip);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var lx = sgn * w * 0.32, ly = h * 0.10;
      var rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.19);
      rg.addColorStop(0, 'rgba(255,45,40,' + glow.toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,45,40,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(lx - w * 0.21, ly - w * 0.21, w * 0.42, w * 0.42);
    }
    ctx.restore();

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- near miss ------------------------------------------------------
     A hazard that went past inside your margin gets a hard white streak on the
     side it passed. It is the only readout the player gets on how much of their
     road they actually spent, and it is what turns a lucky clear into a lesson. */
  function drawNearMiss(world) {
    var k = world.nearMiss;
    if (k <= 0.01) return;
    var cx = sx(0, world.car.x);
    var side = world.nearMissSide;
    var w = 0.22 * view.roadHalfPx;
    var g = ctx.createLinearGradient(cx, 0, cx + side * w * 3, 0);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(cx, cx + side * w * 3), view.carY - view.H * 0.16,
                 w * 3, view.H * 0.24);
  }

  /* ---- "I am running out of road" ------------------------------------ */
  function drawEdgeWarning(world, edgeProx) {
    var v = ctx.createRadialGradient(view.W / 2, view.H * 0.6, view.W * 0.22,
                                     view.W / 2, view.H * 0.6, view.W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,' + (0.55 + 0.35 * edgeProx).toFixed(3) + ')');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, view.W, view.H);

    if (edgeProx > 0.02) {
      var side = NL.sign(world.car.x - NL.road.centreAt(world, world.dist));
      var g = ctx.createLinearGradient(side < 0 ? 0 : view.W, 0, side < 0 ? view.W * 0.3 : view.W * 0.7, 0);
      g.addColorStop(0, 'rgba(255,138,61,' + (0.30 * edgeProx).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,138,61,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }
})();

/* ===== 10-hud.js ===== */
/* NIGHT LINE — the readouts the shared shell doesn't already draw.
 *
 * Score, lives and the boot/home/game-over/leaderboard flow are the shell's
 * job now (shared/game-shell.js) — see 14-main. What is left here is the
 * stuff that is genuinely this game's own: the speedometer, the light/beam
 * meters (GDD 7.1 — the warning must read even at zero) each now labelled
 * against what it actually does, the clean-clear chain, per-dodge OK/GOOD/
 * PERFECT feedback, the "you just passed your own best" beat, and a one-time
 * first-run reminder of the single control. Positioned bottom-centre, clear
 * of the shell's own top-centre score/lives readout and its bottom-corner
 * controls.
 */
(function () {
  var NL = (globalThis.NL = globalThis.NL || {});
  var T = NL.tokens;

  var dodge = null;   // { label, colour, age } — sim-driven, see onFx()
  var DODGE_STYLE = {
    ok:      { label: 'OK',      colour: T.hudMid },
    good:    { label: 'GOOD',    colour: T.pickupPower },
    perfect: { label: 'PERFECT', colour: T.anchorActive }
  };

  function font(ctx, size, weight) {
    ctx.font = (weight || 500) + ' ' + size + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  }

  function formatTime(seconds) {
    var s = Math.floor(seconds);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
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
    // Clears transient HUD state between runs so a stale dodge-rating from
    // the previous attempt can't flash up at the start of a new one.
    reset: function () { dodge = null; },

    // Called once per drained sim event (see 12-game's fx loop) — picks out
    // the ones that need a floating readout rather than just a sound.
    onFx: function (fx) {
      if (fx.type.indexOf('dodge-') !== 0) return;
      var style = DODGE_STYLE[fx.type.slice(6)];
      if (style) dodge = { label: style.label, colour: style.colour, age: 0 };
    },

    draw: function (ctx, world, view, tNow, dt, best) {
      var pad = view.tall ? 14 : 20;
      var mw = view.tall ? 100 : 140, mh = 8, gap = 7;
      var mx = view.W / 2 - mw / 2, my = view.H - pad - mh * 2 - gap;

      var low = NL.light.lowPower(world);
      var pulse = low ? 0.55 + 0.45 * Math.abs(Math.sin(tNow * 4.2)) : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // time + top speed — score is already the shell's own readout, these
      // are the other two numbers worth seeing live instead of only at death
      font(ctx, view.tall ? 13 : 15, 600);
      ctx.fillStyle = T.hudDim;
      ctx.fillText(formatTime(world.time), view.W / 2, my - 74);
      ctx.fillStyle = T.hudMid;
      ctx.fillText('TOP ' + Math.round(world.topSpeed * 3.6) + ' KM/H', view.W / 2, my - 54);

      // the chain: consecutive clean clears
      if (world.streak >= 3 || world.streakBroke > 0.01) {
        var sp = world.streakPulse, sb = world.streakBroke;
        var sSize = view.tall ? 13 : 15;
        font(ctx, Math.round(sSize * (1 + 0.12 * sp)), 600);
        if (sb > 0.01) {
          ctx.globalAlpha = sb;
          ctx.fillStyle = T.hudWarn;
          ctx.fillText('CHAIN LOST', view.W / 2, my - 34);
        } else {
          var hot = Math.min(1, world.streak / 20);
          ctx.globalAlpha = 0.55 + 0.45 * hot;
          ctx.fillStyle = world.streak >= 10 ? T.anchorActive : T.hudMid;
          if (sp > 0.5) { ctx.shadowColor = T.anchorActive; ctx.shadowBlur = 14 * sp; }
          ctx.fillText('CHAIN ×' + world.streak, view.W / 2, my - 34);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      // ---- light / beam meters, bottom-centre, stacked, each labelled at
      // its own height so it is unambiguous which readout is which
      ctx.globalAlpha = low ? pulse : 0.92;
      meter(ctx, mx, my, mw, mh, world.power, low ? T.hudWarn : 'rgba(255,206,140,0.9)', low);
      ctx.globalAlpha = 0.92;
      meter(ctx, mx, my + mh + gap, mw, mh, world.beam,
            world.beamActive ? T.pickupBeam : 'rgba(192,140,255,0.45)', world.beamActive);
      ctx.globalAlpha = 1;

      ctx.textAlign = 'left';
      font(ctx, 9, 500);
      ctx.globalAlpha = low ? pulse : 1;
      ctx.fillStyle = low ? T.hudWarn : T.hudDim;
      ctx.fillText(low ? 'LIGHT LOW' : 'LIGHT', mx + mw + 8, my - 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = world.beamActive ? T.pickupBeam : T.hudDim;
      ctx.fillText(world.beamActive ? 'HIGH BEAM ON' : 'HIGH BEAM', mx + mw + 8, my + mh + gap - 1);
      ctx.textAlign = 'center';

      // per-dodge OK / GOOD / PERFECT, floating just above the car
      if (dodge) {
        dodge.age += dt;
        var life = 0.85;
        if (dodge.age >= life) { dodge = null; }
        else {
          var t = dodge.age / life;
          var rise = t * 22;
          ctx.save();
          ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
          font(ctx, view.tall ? 16 : 20, 700);
          ctx.fillStyle = dodge.colour;
          ctx.shadowColor = dodge.colour; ctx.shadowBlur = 10;
          ctx.fillText(dodge.label, view.W / 2, view.H * 0.58 - rise);
          ctx.restore();
        }
      }

      // the moment you pass your own best, mid-run
      if (world.beatBest > 0.01) {
        var bb = NL.clamp(world.beatBest * 1.6, 0, 1);
        ctx.save();
        font(ctx, view.tall ? 14 : 18, 700);
        ctx.fillStyle = T.anchorActive;
        ctx.globalAlpha = bb;
        ctx.shadowColor = T.anchorActive; ctx.shadowBlur = 18 * bb;
        ctx.fillText('NEW BEST', view.W / 2, view.H * 0.24);
        ctx.restore();
      }

      // first-ever run only: a few seconds of plain reminder of the one control
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
          ctx.fillText('LEFT ROPES LEFT, RIGHT ROPES RIGHT — PICK THE SAFE POST', view.W / 2, view.H * 0.30);
          ctx.fillStyle = T.hudDim;
          ctx.fillText('RELEASE BEFORE YOU RUN OUT OF ROAD', view.W / 2, view.H * 0.30 + 20);
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
        case 'rope-attach': NL.audio.noise(0.16, 0.28, 1800, 1.2, 500); NL.audio.blip(520, 0.12, 0.10, 'triangle'); break;
        case 'rope-miss':   NL.audio.noise(0.13, 0.16, 900, 0.8, 260); break;
        case 'rope-detach': NL.audio.noise(0.09, 0.10, 1400, 1.0, 700); break;
        case 'pickup-power':NL.audio.blip(680, 0.16, 0.12, 'sine'); setTimeout(function(){NL.audio.blip(1020,0.18,0.10,'sine');},70); break;
        case 'pickup-beam': NL.audio.blip(880, 0.16, 0.12, 'triangle'); setTimeout(function(){NL.audio.blip(1320,0.22,0.10,'triangle');},70); break;
        case 'near-miss':   NL.audio.noise(0.10, 0.20, 2600, 2.0, 1200); break;
        case 'dodge-ok':      NL.audio.blip(500, 0.05, 0.04, 'sine'); break;
        case 'dodge-good':    NL.audio.blip(700, 0.07, 0.06, 'triangle'); break;
        case 'dodge-perfect': NL.audio.blip(900, 0.06, 0.08, 'triangle'); setTimeout(function(){NL.audio.blip(1350,0.10,0.07,'triangle');},50); break;
        case 'streak-mark': NL.audio.blip(1180, 0.09, 0.07, 'sine'); setTimeout(function(){NL.audio.blip(1570,0.12,0.06,'sine');},60); break;
        case 'streak-break':NL.audio.blip(220, 0.16, 0.08, 'sawtooth'); break;
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
  var lastHudT = 0;     // for the HUD's own transient animations (dodge rating fade)

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
        var stepInput = {
          leftHeld: NL.input.leftHeld, rightHeld: NL.input.rightHeld,
          leftJustPressed: NL.input.leftJustPressed, rightJustPressed: NL.input.rightJustPressed
        };
        NL.input.leftJustPressed = false;   // one press per frame, consumed by the first sub-step
        NL.input.rightJustPressed = false;
        NL.stepWorld(world, DT, stepInput);
        acc -= DT;
        if (!world.alive) break;
      }

      // drain sim events to audio + the HUD's own floating dodge-rating text
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
      var centre = NL.road.centreAt(w, w.dist);
      var off = w.car.x - centre;
      var openCount = 0, nearest = null;
      for (var i = 0; i < w.anchors.length; i++) {
        var a = w.anchors[i];
        if (a.state === 'active') { openCount++; if (!nearest || a.z < nearest.z) nearest = a; }
      }
      var lines = [
        'fps      ' + this.fps.toFixed(0),
        'seed     ' + w.seed,
        't        ' + w.time.toFixed(1) + '  speed ' + w.speed.toFixed(1) + ' m/s',
        'dist     ' + w.dist.toFixed(0) + ' m',
        'car.x    ' + w.car.x.toFixed(3) + '   offset ' + off.toFixed(3) + ' / ' + cfg.edgeSafe,
        'rope     ' + w.car.mode + (w.car.missTimer > 0 ? ' (cooldown ' + w.car.missTimer.toFixed(2) + ')' : ''),
        'hold     ' + (w.car.mode === 'attached' ? w.car.holdTime.toFixed(2) + ' s' : '-'),
        'edgeProx ' + NL.light.edgeProximity(w).toFixed(2),
        'windows  ' + openCount + ' open' + (nearest ? '  next side ' + (nearest.side > 0 ? 'R' : 'L') : ''),
        'light    ' + NL.light.visibleDistance(w).toFixed(0) + ' m   power ' + w.power.toFixed(2) +
          (w.beamActive ? '  BEAM' : ''),
        'events   ' + w.stats.events + '  rejected ' + w.stats.rejections +
          '  fallback ' + w.stats.fallbacks,
        'minWin   ' + (w.stats.minWindow === 99 ? '-' : w.stats.minWindow.toFixed(2) + ' s') +
          '  (floor ' + cfg.windowFloorSeconds + ')'
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
    instructions: 'LEFT ROPES THE LEFT POST, RIGHT ROPES THE RIGHT POST — HOLD IT<br>' +
      'TO SLIDE TOWARD THAT SIDE, LET GO BEFORE YOU RUN OUT OF ROAD.<br>' +
      'ONLY ONE POST PER PAIR IS SAFE — READ THE ROAD AND PICK RIGHT.',
    accent: '--yellow',
    accent2: '--yellow',
    accent3: '--atari-red',
    titleFont: '--font-namco',
    livesStart: 1,
    controlsDefaultSide: 'right',
    buttons: [
      { id: 'left', label: 'LEFT', key: 'ArrowLeft', hold: true, pair: 'drift', dir: 'left' },
      { id: 'right', label: 'RIGHT', key: 'ArrowRight', hold: true, pair: 'drift', dir: 'right' }
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

