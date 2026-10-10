// First-visit intro for the Home page (mouse/trackpad only).
//
// The page starts hidden: just a flow field and one dot drifting through it,
// among a few hundred tiny particles. Click the dot and it snaps to the
// pointer, becomes the site's cursor dot, and the page types itself in.
//
// index.html's <head> adds `intro-pending` to <html> only when the intro
// should run (mouse + no reduced-motion + not seen this session).
(function () {
  const html = document.documentElement;
  if (!html.classList.contains('intro-pending')) return;
  window.__introReady = true;

  // ---- tunables ---------------------------------------------------------
  const SCL = 20;            // flow-field cell size (px)
  const NOISE_STEP = 0.055;  // noise units per cell
  const FIELD_SPEED = 0.2;   // how fast the field evolves (noise units / s)
  const MAX_SPEED = 115;     // dot top speed (px/s)
  const STEER = 1.3;         // how quickly the dot follows the field (1/s)
  const EDGE_BAND = 220;     // width of the zone along each edge that pushes inward (px)
  const EDGE_FORCE = 2.4;    // how strongly (relative to the noise vector)
  const DOT_R = 5;           // dot radius, matches .cursor-dot
  const MOUSE_PULL_R = 170;  // the pointer slows and gently attracts the dot inside this radius (px)
  const MOUSE_DAMP = 3;      // slow-down strength inside that radius (1/s)
  const MOUSE_PULL = 260;    // attraction inside that radius (px/s^2)
  const HIT_RADIUS = 32;     // click tolerance around the dot (px)
  const LABEL_TEXT = '[Enter]';
  // the label is a quiet hint, not a sign: it stays invisible until the pointer
  // comes close to the dot, and only shows by itself if nobody finds the dot for a while
  const LABEL_REACH = 280;   // pointer this close (px): the label starts to appear
  const LABEL_FULL = 90;     // pointer this close (px): fully visible
  const LABEL_HINT_AFTER = 15; // seconds before it shows up on its own...
  const LABEL_HINT_LEVEL = 0.7; // ...at this opacity
  const LABEL_GAP = 10;      // space between the dot and the label (px)
  // the label swings round the dot like a weight on a soft spring: it eases in,
  // eases out, and can never whip round faster than LABEL_MAX_TURN
  const LABEL_STIFFNESS = 6;   // spring stiffness (lower = lazier)
  const LABEL_MAX_TURN = 2.6;  // top swing speed (rad/s, about 150 degrees per second)
  const LABEL_MAX_ACCEL = 7;   // how abruptly it may start or stop swinging (rad/s^2)
  const LABEL_HEADING_TAU = 0.3;  // seconds over which a sudden turn of the dot is smoothed out
  const LABEL_MIN_SPEED = 12; // below this speed (px/s) the dot has no direction: the label stays put
  const LABEL_EDGE = 8;      // the label never gets closer than this to the window edge (px)
  const LINE_ALPHA = 0.07;   // field line opacity
  // the pointer leaves a wake: only the field BEHIND its direction of travel is
  // swept along (nothing ahead of it), narrow near the pointer and spreading out
  const WAKE_LENGTH = [70, 360];  // px behind the pointer, grows with its speed
  const WAKE_WIDTH = [40, 90];    // px either side of its path, grows with its speed
  const WAKE_SPREAD = 0.18;       // extra width per px behind the pointer
  const WAKE_FRONT = 14;          // px ahead of the pointer where the effect fades out
  const MOVE_THRESHOLD = 90;      // px/s below which the pointer counts as standing still
  const WAKE_HALF_LIFE = 0.9; // seconds for the pointer's effect on the field to fade to half (like a hand through water)

  const PARTICLES = 500;                // small semi-transparent particles drifting in the field
  const PARTICLE_SPEED = [35, 95];      // their top speeds (px/s), random per particle
  const PARTICLE_RADIUS = [0.8, 1.7];   // px
  const PARTICLE_ALPHA = [0.06, 0.22];
  const REPEL_RADIUS = 24;              // particles closer than this push each other apart (px)
  const REPEL_FORCE = 1100;             // how hard (px/s^2, at zero distance)

  const TYPE_MAX_MS = 3500;  // the longest text takes this long to type
  const TYPE_MS_PER_CHAR = 38;
  const CATCH_MS = 380;      // dot -> pointer snap duration

  // ---- seen-flag --------------------------------------------------------
  function markSeen() {
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
  }

  // ---- Perlin noise (improved noise, 3D) --------------------------------
  const perm = new Uint8Array(512);
  (function () {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  // 3D Perlin noise, roughly -1..1
  function perlin(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x), fy = y - Math.floor(y), fz = z - Math.floor(z);
    const u = fade(fx), v = fade(fy), w = fade(fz);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const x1 = lerp(grad(perm[AA], fx, fy, fz), grad(perm[BA], fx - 1, fy, fz), u);
    const x2 = lerp(grad(perm[AB], fx, fy - 1, fz), grad(perm[BB], fx - 1, fy - 1, fz), u);
    const x3 = lerp(grad(perm[AA + 1], fx, fy, fz - 1), grad(perm[BA + 1], fx - 1, fy, fz - 1), u);
    const x4 = lerp(grad(perm[AB + 1], fx, fy - 1, fz - 1), grad(perm[BB + 1], fx - 1, fy - 1, fz - 1), u);
    return lerp(lerp(x1, x2, v), lerp(x3, x4, v), w);
  }

  // ---- canvas + particle elements ---------------------------------------
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const particleEl = document.createElement('div');
  particleEl.className = 'intro-particle';
  document.body.appendChild(particleEl);

  // a small "[Click me]" that keeps close to the dot, trailing behind it
  const labelEl = document.createElement('div');
  labelEl.className = 'intro-label';
  labelEl.textContent = LABEL_TEXT;
  document.body.appendChild(labelEl);
  let labelW = 0, labelH = 0;
  function measureLabel() {
    labelW = labelEl.offsetWidth;
    labelH = labelEl.offsetHeight;
  }

  const rgb = (getComputedStyle(document.body).color.match(/\d+/g) || [0, 0, 0]).slice(0, 3).join(',');

  let W = 0, H = 0, cols = 0, rows = 0;
  let angleOff, fx, fy;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(1, Math.floor(W / SCL));
    rows = Math.max(1, Math.floor(H / SCL));
    angleOff = new Float32Array(cols * rows);
    fx = new Float32Array(cols * rows);
    fy = new Float32Array(cols * rows);
    p.x = Math.min(Math.max(p.x, DOT_R), W - DOT_R);
    p.y = Math.min(Math.max(p.y, DOT_R), H - DOT_R);
    buildRepelGrid();
    measureLabel();
  }

  // ---- state ------------------------------------------------------------
  const p = { x: 0, y: 0, vx: 0, vy: 0 };
  const mouse = { x: 0, y: 0, px: 0, py: 0, svx: 0, svy: 0, known: false };
  // current shape of the wake, refreshed every frame
  const wake = { on: false, ux: 1, uy: 0, angle: 0, len: 0, width: 0 };
  const flock = [];
  let zoff = Math.random() * 100;
  let state = 'roam'; // roam -> catching -> revealing
  let raf = 0;
  let last = performance.now();

  p.x = window.innerWidth * (0.25 + Math.random() * 0.5);
  p.y = window.innerHeight * (0.25 + Math.random() * 0.5);
  const a0 = Math.random() * Math.PI * 2;
  p.vx = Math.cos(a0) * MAX_SPEED * 0.5;
  p.vy = Math.sin(a0) * MAX_SPEED * 0.5;
  let labelHeading = a0;            // last direction the dot travelled in
  let labelOmega = 0;               // how fast the label is swinging round (rad/s)
  let hx = Math.cos(a0), hy = Math.sin(a0); // low-passed velocity of the dot
  let labelAngle = a0 + Math.PI;    // where the label sits around the dot (starts behind it)
  let labelOpacity = 0;             // eased towards labelWanted() every frame
  let labelFading = false;          // set once the dot is caught
  const introStart = performance.now();

  // ---- small particles + the spatial grid that keeps them apart ---------
  let repelCols = 1, repelRows = 1;
  let repelHead = new Int32Array(1);
  const repelNext = new Int32Array(PARTICLES);

  function buildRepelGrid() {
    repelCols = Math.max(1, Math.ceil(W / REPEL_RADIUS));
    repelRows = Math.max(1, Math.ceil(H / REPEL_RADIUS));
    repelHead = new Int32Array(repelCols * repelRows);
  }

  function respawn(q) {
    q.x = Math.random() * W;
    q.y = Math.random() * H;
    q.vx = 0;
    q.vy = 0;
  }
  for (let n = 0; n < PARTICLES; n++) {
    const q = {
      max: PARTICLE_SPEED[0] + Math.random() * (PARTICLE_SPEED[1] - PARTICLE_SPEED[0]),
      r: PARTICLE_RADIUS[0] + Math.random() * (PARTICLE_RADIUS[1] - PARTICLE_RADIUS[0]),
      // opacity is quantised in 4 steps so each frame needs only 4 draw batches
      tier: Math.floor(Math.random() * 4)
    };
    flock.push(q);
  }
  const TIER_ALPHA = [0, 1, 2, 3].map((n) =>
    PARTICLE_ALPHA[0] + (PARTICLE_ALPHA[1] - PARTICLE_ALPHA[0]) * (n / 3));

  resize();
  flock.forEach(respawn);
  measureLabel();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureLabel);

  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // how strongly the pointer's wake acts on the point (x, y): 1 right behind the
  // pointer, fading with distance and sideways, 0 ahead of it
  function wakeWeight(x, y) {
    const dx = x - mouse.x, dy = y - mouse.y;
    const along = dx * wake.ux + dy * wake.uy;   // > 0: ahead of the pointer
    if (along > WAKE_FRONT) return 0;
    const behind = Math.max(0, -along);
    if (behind >= wake.len) return 0;
    const lateral = Math.abs(dx * wake.uy - dy * wake.ux);
    const width = wake.width + behind * WAKE_SPREAD;
    if (lateral >= width) return 0;
    let lengthwise = 1 - behind / wake.len;
    lengthwise *= lengthwise;
    let sideways = 1 - lateral / width;
    sideways *= sideways;
    const front = along > 0 ? 1 - along / WAKE_FRONT : 1;
    return lengthwise * sideways * front;
  }

  // ---- the "[Click me]" label -------------------------------------------
  // Centre of the label when it sits at angle `a` around the dot: pushed out
  // along that direction until the nearest point of its box is exactly
  // DOT_R + LABEL_GAP away from the dot's centre (so a wide box never grazes it).
  function labelCentre(a) {
    const ux = Math.cos(a), uy = Math.sin(a);
    const want = DOT_R + LABEL_GAP;
    let lo = 0, hi = want + Math.hypot(labelW, labelH);
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const gx = Math.max(Math.abs(ux * mid) - labelW / 2, 0);
      const gy = Math.max(Math.abs(uy * mid) - labelH / 2, 0);
      if (Math.hypot(gx, gy) < want) lo = mid; else hi = mid;
    }
    return [p.x + ux * hi, p.y + uy * hi];
  }
  function labelFits(a) {
    const [cx, cy] = labelCentre(a);
    return cx - labelW / 2 >= LABEL_EDGE && cx + labelW / 2 <= W - LABEL_EDGE &&
           cy - labelH / 2 >= LABEL_EDGE && cy + labelH / 2 <= H - LABEL_EDGE;
  }
  // the preferred angle if the label fits there, otherwise the closest one that does
  function labelPick(preferred) {
    if (labelFits(preferred)) return preferred;
    for (let k = 1; k <= 12; k++) {
      for (const side of [1, -1]) {
        const a = preferred + side * k * (Math.PI / 12);
        if (labelFits(a)) return a;
      }
    }
    return preferred;
  }
  function updateLabel(dt) {
    // direction of travel, softened so an abrupt turn reaches the label gradually
    const soften = 1 - Math.exp(-dt / LABEL_HEADING_TAU);
    hx += (p.vx - hx) * soften;
    hy += (p.vy - hy) * soften;
    if (Math.hypot(hx, hy) > LABEL_MIN_SPEED) labelHeading = Math.atan2(hy, hx);

    // trail behind the dot: a critically damped spring pulls the label's angle
    // towards "behind", so it starts and stops gently and has a speed limit
    const target = labelPick(labelHeading + Math.PI);
    const err = wrapAngle(target - labelAngle);
    let accel = LABEL_STIFFNESS * err - 2 * Math.sqrt(LABEL_STIFFNESS) * labelOmega;
    accel = Math.max(-LABEL_MAX_ACCEL, Math.min(LABEL_MAX_ACCEL, accel));
    labelOmega += accel * dt;
    labelOmega = Math.max(-LABEL_MAX_TURN, Math.min(LABEL_MAX_TURN, labelOmega));
    labelAngle += labelOmega * dt;
    const c = labelCentre(labelAngle);
    labelEl.style.transform = 'translate(' + (c[0] - labelW / 2).toFixed(1) + 'px,' + (c[1] - labelH / 2).toFixed(1) + 'px)';

    // how visible it wants to be: closer pointer -> clearer; plus a late nudge
    let want = 0;
    if (!labelFading) {
      if (mouse.known) {
        const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        want = Math.min(1, Math.max(0, (LABEL_REACH - dist) / (LABEL_REACH - LABEL_FULL)));
      }
      if ((performance.now() - introStart) / 1000 > LABEL_HINT_AFTER) want = Math.max(want, LABEL_HINT_LEVEL);
    }
    labelOpacity += (want - labelOpacity) * (1 - Math.exp(-(want > labelOpacity ? 2.5 : 4) * dt));
    labelEl.style.opacity = labelOpacity.toFixed(3);
  }

  // ---- one simulation + draw step ---------------------------------------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (dt <= 0) return;
    zoff += dt * FIELD_SPEED;

    // pointer motion, smoothed: its direction and speed shape the wake
    wake.on = false;
    if (mouse.known) {
      const mdx = mouse.x - mouse.px, mdy = mouse.y - mouse.py;
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      const k = Math.min(1, dt * 18);
      mouse.svx += (mdx / dt - mouse.svx) * k;
      mouse.svy += (mdy / dt - mouse.svy) * k;
      const speed = Math.hypot(mouse.svx, mouse.svy);
      if (speed > MOVE_THRESHOLD) {
        const t = Math.min(1, speed / 1400);
        wake.on = true;
        wake.ux = mouse.svx / speed;
        wake.uy = mouse.svy / speed;
        wake.angle = Math.atan2(mouse.svy, mouse.svx);
        // long enough to cover everything the pointer travelled since the last frame
        wake.len = Math.max(lerp(WAKE_LENGTH[0], WAKE_LENGTH[1], t), Math.hypot(mdx, mdy) * 1.5);
        wake.width = lerp(WAKE_WIDTH[0], WAKE_WIDTH[1], t);
      }
    }
    const moving = wake.on;
    const decay = Math.pow(0.5, dt / WAKE_HALF_LIFE);
    const catchUp = Math.min(1, dt * 60);

    // -- the flow field: noise + pointer sweep + inward push at the edges --
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = x + y * cols;
        const cx = x * SCL + SCL / 2;
        const cy = y * SCL + SCL / 2;

        // two independent noise components -> a direction with no preferred
        // heading (a single noise value would mostly point one way)
        const nx = x * NOISE_STEP, ny = y * NOISE_STEP;
        const base = Math.atan2(
          perlin(nx + 57.3, ny + 11.9, zoff + 31.7) * 0.75 + perlin(nx * 2 + 3.1, ny * 2 + 8.4, zoff * 1.5 + 90.2) * 0.25,
          perlin(nx, ny, zoff) * 0.75 + perlin(nx * 2, ny * 2, zoff * 1.5) * 0.25
        );

        let off = angleOff[i];
        if (moving) {
          const w = wakeWeight(cx, cy);
          if (w > 0) off += wrapAngle(wake.angle - (base + off)) * w * 0.75 * catchUp;
        }
        off *= decay;
        angleOff[i] = off;

        const a = base + off;
        let vx = Math.cos(a), vy = Math.sin(a);

        // each window edge bends the vectors back towards the inside
        const dl = cx, dr = W - cx, dtp = cy, db = H - cy;
        if (dl < EDGE_BAND) { const k = (EDGE_BAND - dl) / EDGE_BAND; vx += k * EDGE_FORCE; }
        if (dr < EDGE_BAND) { const k = (EDGE_BAND - dr) / EDGE_BAND; vx -= k * EDGE_FORCE; }
        if (dtp < EDGE_BAND) { const k = (EDGE_BAND - dtp) / EDGE_BAND; vy += k * EDGE_FORCE; }
        if (db < EDGE_BAND) { const k = (EDGE_BAND - db) / EDGE_BAND; vy -= k * EDGE_FORCE; }

        const m = Math.hypot(vx, vy) || 1;
        fx[i] = vx / m;
        fy[i] = vy / m;
      }
    }

    // -- the dot --
    if (state === 'roam') {
      const cxI = Math.min(cols - 1, Math.max(0, Math.floor(p.x / SCL)));
      const cyI = Math.min(rows - 1, Math.max(0, Math.floor(p.y / SCL)));
      const i = cxI + cyI * cols;
      const s = Math.min(1, STEER * dt);
      p.vx += (fx[i] * MAX_SPEED - p.vx) * s;
      p.vy += (fy[i] * MAX_SPEED - p.vy) * s;

      if (mouse.known) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_PULL_R && dist > 0.001) {
          let w = 1 - dist / MOUSE_PULL_R;
          w *= w;
          const damp = Math.exp(-MOUSE_DAMP * w * dt);
          p.vx *= damp;
          p.vy *= damp;
          p.vx += (dx / dist) * MOUSE_PULL * w * dt;
          p.vy += (dy / dist) * MOUSE_PULL * w * dt;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // safety net: the dot can never leave the window
      if (p.x < DOT_R) { p.x = DOT_R; p.vx = Math.abs(p.vx); }
      if (p.x > W - DOT_R) { p.x = W - DOT_R; p.vx = -Math.abs(p.vx); }
      if (p.y < DOT_R) { p.y = DOT_R; p.vy = Math.abs(p.vy); }
      if (p.y > H - DOT_R) { p.y = H - DOT_R; p.vy = -Math.abs(p.vy); }
    }

    particleEl.style.transform = 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px)';
    updateLabel(dt);

    // -- draw --
    ctx.clearRect(0, 0, W, H);

    // field lines, all at once
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(' + rgb + ',' + LINE_ALPHA + ')';
    ctx.beginPath();
    const L = SCL * 0.8;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = x + y * cols;
        const cx = x * SCL + SCL / 2, cy = y * SCL + SCL / 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + fx[i] * L, cy + fy[i] * L);
      }
    }
    ctx.stroke();

    // lines in the wake glow brighter (a small halo when the pointer is still)
    if (mouse.known && state === 'roam') {
      const reach = wake.on ? wake.len + wake.width : 70;
      const x0 = Math.max(0, Math.floor((mouse.x - reach) / SCL));
      const x1 = Math.min(cols - 1, Math.floor((mouse.x + reach) / SCL));
      const y0 = Math.max(0, Math.floor((mouse.y - reach) / SCL));
      const y1 = Math.min(rows - 1, Math.floor((mouse.y + reach) / SCL));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const cx = x * SCL + SCL / 2, cy = y * SCL + SCL / 2;
          let f;
          if (wake.on) {
            f = wakeWeight(cx, cy);
          } else {
            const dist = Math.hypot(cx - mouse.x, cy - mouse.y);
            f = dist < 70 ? Math.pow(1 - dist / 70, 2) * 0.6 : 0;
          }
          if (f <= 0.01) continue;
          const i = x + y * cols;
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (LINE_ALPHA + f * 0.4).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + fx[i] * L, cy + fy[i] * L);
          ctx.stroke();
        }
      }
    }

    moveFlock(dt);
    drawFlock();
  }

  // ---- the small particles ----------------------------------------------
  function moveFlock(dt) {
    // 1. bucket every particle into the spatial grid
    repelHead.fill(-1);
    for (let n = 0; n < flock.length; n++) {
      const q = flock[n];
      const cx = Math.min(repelCols - 1, Math.max(0, Math.floor(q.x / REPEL_RADIUS)));
      const cy = Math.min(repelRows - 1, Math.max(0, Math.floor(q.y / REPEL_RADIUS)));
      const c = cx + cy * repelCols;
      repelNext[n] = repelHead[c];
      repelHead[c] = n;
      q.cell = c;
    }

    const steer = Math.min(1, STEER * 1.6 * dt);
    const r2max = REPEL_RADIUS * REPEL_RADIUS;

    for (let n = 0; n < flock.length; n++) {
      const q = flock[n];

      // 2. follow the flow field
      const ci = Math.min(cols - 1, Math.max(0, Math.floor(q.x / SCL)));
      const ri = Math.min(rows - 1, Math.max(0, Math.floor(q.y / SCL)));
      const i = ci + ri * cols;
      q.vx += (fx[i] * q.max - q.vx) * steer;
      q.vy += (fy[i] * q.max - q.vy) * steer;

      // 3. push away from any neighbour that comes too close
      const qcx = q.cell % repelCols;
      const qcy = (q.cell - qcx) / repelCols;
      for (let gy = Math.max(0, qcy - 1); gy <= Math.min(repelRows - 1, qcy + 1); gy++) {
        for (let gx = Math.max(0, qcx - 1); gx <= Math.min(repelCols - 1, qcx + 1); gx++) {
          for (let m = repelHead[gx + gy * repelCols]; m !== -1; m = repelNext[m]) {
            if (m === n) continue;
            const o = flock[m];
            let dx = q.x - o.x, dy = q.y - o.y;
            let d2 = dx * dx + dy * dy;
            if (d2 >= r2max) continue;
            if (d2 < 0.0001) {
              // exactly on top of each other: pick a random direction
              const a = Math.random() * Math.PI * 2;
              dx = Math.cos(a); dy = Math.sin(a); d2 = 1;
            }
            const d = Math.sqrt(d2);
            const push = (1 - d / REPEL_RADIUS) * REPEL_FORCE * dt;
            q.vx += (dx / d) * push;
            q.vy += (dy / d) * push;
          }
        }
      }

      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.x < 0 || q.x > W || q.y < 0 || q.y > H) respawn(q);
    }
  }

  function drawFlock() {
    for (let t = 0; t < 4; t++) {
      ctx.fillStyle = 'rgba(' + rgb + ',' + TIER_ALPHA[t].toFixed(3) + ')';
      ctx.beginPath();
      for (const q of flock) {
        if (q.tier !== t) continue;
        ctx.moveTo(q.x + q.r, q.y);
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // ---- input ------------------------------------------------------------
  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.known) {
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.svx = 0;
      mouse.svy = 0;
      mouse.known = true;
    }
  }
  function onLeave() { mouse.known = false; mouse.svx = 0; mouse.svy = 0; }
  function onClick(e) {
    if (state !== 'roam') return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) <= HIT_RADIUS) {
      catchDot(e.clientX, e.clientY);
    }
  }
  function onKey(e) {
    // keyboard way in, for anyone who can't chase the dot
    if (state === 'roam' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
      e.preventDefault();
      skip();
    }
  }

  // the page underneath is hidden: nothing there should be selectable
  function onSelectStart(e) { e.preventDefault(); }
  document.addEventListener('selectstart', onSelectStart);
  if (window.getSelection) window.getSelection().removeAllRanges();

  document.addEventListener('mousemove', onMove);
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);

  // ---- catching the dot -------------------------------------------------
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function catchDot(tx, ty) {
    state = 'catching';
    labelFading = true;
    const sx = p.x, sy = p.y;
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / CATCH_MS);
      const e = easeOutCubic(t);
      // follow the live pointer so it lands exactly under it
      const px = mouse.known ? mouse.x : tx;
      const py = mouse.known ? mouse.y : ty;
      p.x = lerp(sx, px, e);
      p.y = lerp(sy, py, e);
      if (t < 1) requestAnimationFrame(step);
      else reveal();
    })(t0);
  }

  function detachInput() {
    document.removeEventListener('selectstart', onSelectStart);
    document.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
  }

  function removeIntroLayers() {
    canvas.style.opacity = '0';
    setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas.remove();
    }, 700);
    particleEl.remove();
    setTimeout(() => labelEl.remove(), 700);
  }

  function reveal() {
    state = 'revealing';
    markSeen();
    detachInput();
    const typing = prepareTyping();
    html.classList.remove('intro-pending');
    removeIntroLayers();
    window.dispatchEvent(new Event('intro:revealed'));
    runTyping(typing);
  }

  function skip() {
    state = 'revealing';
    markSeen();
    detachInput();
    cancelAnimationFrame(raf);
    canvas.remove();
    particleEl.remove();
    labelEl.remove();
    html.classList.remove('intro-pending');
    window.dispatchEvent(new Event('intro:revealed'));
  }

  // ---- typewriter -------------------------------------------------------
  // Every piece of text keeps its real layout (the not-yet-typed rest is
  // just visibility:hidden), so nothing reflows while it types.
  const UNITS = [
    '.title .prefix', '.title .rest', '.credits p', '.site-nav a',
    '.media-caption', '.description', '.utility-nav a', '.utility-nav button'
  ];

  function prepareTyping() {
    const units = [];
    document.querySelectorAll(UNITS.join(',')).forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue.trim() === '') continue;
        const tw = document.createElement('span');
        tw.className = 'intro-tw';
        const a = document.createElement('span');
        const b = document.createElement('span');
        b.style.visibility = 'hidden';
        b.textContent = n.nodeValue;
        tw.append(a, b);
        nodes.push({ orig: n, tw, a, b, text: n.nodeValue, len: n.nodeValue.length });
      }
      if (!nodes.length) return;
      nodes.forEach((o) => o.orig.parentNode.replaceChild(o.tw, o.orig));
      const total = nodes.reduce((s, o) => s + o.len, 0);
      units.push({
        nodes,
        total,
        dur: Math.min(TYPE_MAX_MS, Math.max(300, total * TYPE_MS_PER_CHAR)),
        delay: Math.random() * 120,
        shown: -1,
        done: false
      });
    });
    return units;
  }

  function setUnitProgress(u, k) {
    let rem = k;
    for (const o of u.nodes) {
      const take = Math.min(rem, o.len);
      o.a.textContent = o.text.slice(0, take);
      o.b.textContent = o.text.slice(take);
      rem -= take;
    }
  }

  function finishUnit(u) {
    u.nodes.forEach((o) => o.tw.parentNode && o.tw.parentNode.replaceChild(o.orig, o.tw));
    u.done = true;
  }

  function runTyping(units) {
    const t0 = performance.now();
    (function tick(now) {
      let pending = 0;
      for (const u of units) {
        if (u.done) continue;
        const t = now - t0 - u.delay;
        if (t < 0) { pending++; continue; }
        const prog = Math.min(1, t / u.dur);
        const k = Math.floor(prog * u.total);
        if (prog >= 1) { finishUnit(u); continue; }
        if (k !== u.shown) { u.shown = k; setUnitProgress(u, k); }
        pending++;
      }
      if (pending) requestAnimationFrame(tick);
    })(t0);
  }

  // ---- go ---------------------------------------------------------------
  raf = requestAnimationFrame(frame);
})();
