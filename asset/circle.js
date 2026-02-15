/* --- Math helpers --- */
function dot(a,b){ return a[0]*b[0] + a[1]*b[1]; }
function norm(a){ return Math.hypot(a[0], a[1]); }
function add(a,b){ return [a[0]+b[0], a[1]+b[1]]; }
function sub(a,b){ return [a[0]-b[0], a[1]-b[1]]; }
function scale(a,s){ return [a[0]*s, a[1]*s]; }
function unit(a){ const n = norm(a); return n===0 ? [0,0] : [a[0]/n, a[1]/n]; }
function reflect(v, nUnit){
  const vn = dot(v, nUnit);
  return sub(v, scale(nUnit, 2*vn));
}

/* Parse expressions like pi/4, sqrt(2)/5 */
function parseAngle(expr){
  const allowed = { pi: Math.PI, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos };
  if (!/^[0-9+\-*/().\s a-zA-Z]+$/.test(expr)) {
    throw new Error("Angle contains invalid characters.");
  }
  expr = expr.replace(/\bPI\b/g, "pi").replace(/\bPi\b/g, "pi");
  const fn = new Function("pi","sqrt","sin","cos", `return (${expr});`);
  const val = fn(allowed.pi, allowed.sqrt, allowed.sin, allowed.cos);
  if (!Number.isFinite(val)) throw new Error("Angle did not evaluate to a finite number.");
  return val;
}

/* Core: enforce impact angle */
function simulateWithInteriorStart(alpha, bounces){
  if (!(alpha > 0 && alpha <= Math.PI/2 + 1e-14)) {
    throw new Error("Angle must be in (0, pi/2].");
  }
  if (!(Number.isInteger(bounces) && bounces >= 1)) {
    throw new Error("Bounces must be a positive integer.");
  }

  const q = [1, 0];
  const n0 = [1, 0];
  const t0 = [0, 1];
  const inward0 = [-1, 0];

  const d_out0 = unit(add(scale(t0, Math.cos(alpha)), scale(inward0, Math.sin(alpha))));
  const d_in0  = unit(reflect(d_out0, n0));

  const sMax = 2 * Math.sin(alpha);
  const s = (0.15 + 0.75*Math.random()) * sMax;
  const p0 = sub(q, scale(d_in0, s));

  const causticRadius = Math.cos(alpha);

  let p = p0.slice();
  let d = d_in0.slice();

  const pts = [p.slice(), q.slice()];

  d = d_out0.slice();
  p = q.slice();

  for (let i=1; i<bounces; i++){
    const pd = dot(p, d);
    let tau = -2 * pd;
    if (tau <= 1e-12) tau = 1e-12;

    const qNext = add(p, scale(d, tau));
    const n = unit(qNext);
    d = unit(reflect(d, n));
    p = qNext;
    pts.push(p.slice());
  }

  return { pts, causticRadius };
}

/* Arc-length tools */
function buildArc(pts){
  const s = new Array(pts.length).fill(0);
  let total = 0;
  for (let i=1; i<pts.length; i++){
    const dx = pts[i][0] - pts[i-1][0];
    const dy = pts[i][1] - pts[i-1][1];
    total += Math.hypot(dx, dy);
    s[i] = total;
  }
  return { s, total: Math.max(total, 1e-12) };
}
function pointAtArc(pts, sArr, total, u){
  const t = Math.min(Math.max(u, 0), total);
  let i = 1;
  while (i < sArr.length && sArr[i] < t) i++;
  if (i >= sArr.length) return pts[pts.length - 1];

  const s0 = sArr[i-1], s1 = sArr[i];
  const segLen = s1 - s0;
  const w = segLen > 0 ? (t - s0) / segLen : 0;

  const p0 = pts[i-1], p1 = pts[i];
  return [p0[0] + w*(p1[0]-p0[0]), p0[1] + w*(p1[1]-p0[1])];
}
function tracedPrefix(pts, sArr, u){
  const out = [pts[0]];
  if (u <= 0) return out;

  let i = 1;
  while (i < sArr.length && sArr[i] <= u){
    out.push(pts[i]);
    i++;
  }
  if (i >= sArr.length) return out;

  const s0 = sArr[i-1], s1 = sArr[i];
  const segLen = s1 - s0;
  const w = segLen > 0 ? (u - s0) / segLen : 0;
  const p0 = pts[i-1], p1 = pts[i];
  out.push([p0[0] + w*(p1[0]-p0[0]), p0[1] + w*(p1[1]-p0[1])]);
  return out;
}

/* Drawing */
function draw(state){
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;

  const pad = 40;
  const cx = W/2, cy = H/2;
  const Rpx = Math.min(W, H)/2 - pad;

  function toXY(p){ return [cx + p[0]*Rpx, cy - p[1]*Rpx]; }

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,W,H);

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, Rpx, 0, 2*Math.PI);
  ctx.stroke();

  if (!state) return;

  // caustic
  ctx.strokeStyle = "green";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, state.causticRadius*Rpx, 0, 2*Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // traced orbit
  const traced = tracedPrefix(state.pts, state.arcS, Math.min(state.u, state.arcTotal));
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let [x0,y0] = toXY(traced[0]);
  ctx.moveTo(x0,y0);
  for (let i=1; i<traced.length; i++){
    const [x,y] = toXY(traced[i]);
    ctx.lineTo(x,y);
  }
  ctx.stroke();

  // particle
  const pos = pointAtArc(state.pts, state.arcS, state.arcTotal, state.u);
  const [px, py] = toXY(pos);
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, 2*Math.PI);
  ctx.fill();
}

/* Animation loop */
let state = null;
let lastT = null;

function rebuild(){
  const errEl = document.getElementById("err");
  errEl.textContent = "";

  try{
    const alpha = parseAngle(document.getElementById("angle").value.trim());
    const bounces = parseInt(document.getElementById("bounces").value, 10);
    const speed = Math.max(0, parseFloat(document.getElementById("speed").value || "0.9"));

    const sim = simulateWithInteriorStart(alpha, bounces);
    const arc = buildArc(sim.pts);

    state = {
      pts: sim.pts,
      causticRadius: sim.causticRadius,
      arcS: arc.s,
      arcTotal: arc.total,
      u: 0,
      speed
    };

    draw(state);
  } catch(e){
    state = null;
    errEl.textContent = e.message || String(e);
    draw(null);
  }
}

function tick(t){
  if (lastT == null) lastT = t;
  const dt = (t - lastT)/1000;
  lastT = t;

  if (state){
    const speed = Math.max(0, parseFloat(document.getElementById("speed").value || "0.9"));
    state.u += speed * dt;
    if (state.u > state.arcTotal) state.u = state.arcTotal;
    draw(state);
  }
  requestAnimationFrame(tick);
}

/* Wire UI */
document.getElementById("drawBtn").addEventListener("click", rebuild);
document.getElementById("angle").addEventListener("keydown", (ev)=>{ if(ev.key==="Enter") rebuild(); });
document.getElementById("bounces").addEventListener("keydown", (ev)=>{ if(ev.key==="Enter") rebuild(); });
document.getElementById("speed").addEventListener("keydown", (ev)=>{ if(ev.key==="Enter") rebuild(); });

rebuild();
requestAnimationFrame(tick);
