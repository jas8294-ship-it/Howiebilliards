/* Rectangular billiards in [0,A]x[0,B] with A=2, B=1 */
const A = 2.0, B = 1.0;
const start = { x: 0.3, y: 0.4 };

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }
function hypot(x,y){ return Math.hypot(x,y); }

function parseExpr(s){
  // Accepts numbers, inf, pi, sqrt, and arithmetic.
  s = (s ?? "").trim().toLowerCase();
  if (s === "inf" || s === "infty" || s === "infinity" || s === "∞") return Infinity;

  if (!/^[0-9+\-*/().\s a-zA-Z]+$/.test(s)) {
    throw new Error("Invalid characters.");
  }
  const fn = new Function("pi","sqrt", `return (${s});`);
  const val = fn(Math.PI, Math.sqrt);
  if (!Number.isFinite(val)) throw new Error("Expression did not evaluate to a finite number.");
  return val;
}

function simulateBilliard(slope, maxBounces=200, tol=1e-12){
  // initial direction with vx>0, vy>=0
  let vx, vy;
  if (slope === Infinity){
    vx = 0; vy = 1;
  } else if (Math.abs(slope) < tol){
    vx = 1; vy = 0;
  } else {
    const den = Math.sqrt(1 + slope*slope);
    vx = 1/den;
    vy = slope/den;
  }

  let x = start.x, y = start.y;
  const pts = [{x,y}];
  let corner = false;

  for (let k=0; k<maxBounces; k++){
    let tx = Infinity, ty = Infinity;

    if (Math.abs(vx) > tol){
      tx = (vx > 0) ? (A - x)/vx : (0 - x)/vx;
    }
    if (Math.abs(vy) > tol){
      ty = (vy > 0) ? (B - y)/vy : (0 - y)/vy;
    }

    const t = Math.min(tx, ty);
    if (!Number.isFinite(t) || t <= tol) break;

    let xn = x + vx*t;
    let yn = y + vy*t;

    // snap
    if (Math.abs(xn) < 1e-10) xn = 0;
    if (Math.abs(xn - A) < 1e-10) xn = A;
    if (Math.abs(yn) < 1e-10) yn = 0;
    if (Math.abs(yn - B) < 1e-10) yn = B;

    pts.push({x:xn, y:yn});

    const hitV = Math.abs(t - tx) < 1e-9;
    const hitH = Math.abs(t - ty) < 1e-9;

    if (hitV && hitH){
      corner = true;
      x = xn; y = yn;
      break;
    }
    if (hitV) vx = -vx;
    if (hitH) vy = -vy;

    x = xn; y = yn;
  }
  return { pts, corner };
}

function candidateSlopesForBounces(N){
  // mimic your rectangle family: N=2(m+n), slope=(m*B)/(n*A)
  if (N % 2 !== 0 || N < 2) return [];
  const target = N/2;
  const out = [];
  for (let m=1; m<target; m++){
    const n = target - m;
    if (n >= 1){
      const slope = (m*B)/(n*A);
      out.push({m,n,slope});
    }
  }
  out.sort((a,b)=>a.slope-b.slope);
  return out;
}

function returnedAfterNbouncesCandidate(slope, N){
  // "return after N bounces" is subtle; we use a pragmatic check:
  // simulate exactly N bounces + a bit, and see if we return near start at some point.
  const sim = simulateBilliard(slope, N + 60);
  // Check whether any visited point equals start (position only).
  const eps = 1e-6;
  const hit = sim.pts.some((p,i)=>{
    if (i===0) return false;
    return Math.abs(p.x - start.x) < eps && Math.abs(p.y - start.y) < eps;
  });
  return { sim, hit };
}

/* ---------- Drawing ---------- */
function drawRectPath(canvas, pts, titleText=""){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,W,H);

  // map [0,A]x[0,B] to canvas with padding
  const pad = 35;
  const sx = (W - 2*pad)/A;
  const sy = (H - 2*pad)/B;
  const s = Math.min(sx, sy);
  const ox = pad;
  const oy = H - pad;

  function toXY(p){
    return [ox + p.x*s, oy - p.y*s];
  }

  // border
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(ox, oy - B*s, A*s, B*s);
  ctx.stroke();

  // title
  if (titleText){
    ctx.fillStyle = "#111";
    ctx.font = "14px system-ui";
    ctx.fillText(titleText, pad, 18);
  }

  if (!pts || pts.length < 2) return;

  // path
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let [x0,y0] = toXY(pts[0]);
  ctx.moveTo(x0,y0);
  for (let i=1; i<pts.length; i++){
    const [x,y] = toXY(pts[i]);
    ctx.lineTo(x,y);
  }
  ctx.stroke();

  // bounce points
  ctx.fillStyle = "#111";
  for (let i=1; i<pts.length; i++){
    const [x,y] = toXY(pts[i]);
    ctx.beginPath();
    ctx.arc(x,y,3.5,0,2*Math.PI);
    ctx.fill();
  }

  // start point
  ctx.fillStyle = "red";
  const [xs,ys] = toXY(pts[0]);
  ctx.beginPath();
  ctx.arc(xs,ys,6,0,2*Math.PI);
  ctx.fill();
}

/* ---------- Wire UI ---------- */
(function init(){
  const btnB = document.getElementById("btnBounces");
  const btnS = document.getElementById("btnSlope");

  btnB?.addEventListener("click", ()=>{
    const err = document.getElementById("errBounces");
    const out = document.getElementById("outBounces");
    err.textContent = "";
    out.textContent = "";

    const N = parseInt(document.getElementById("N_bounces").value, 10);
    if (!Number.isInteger(N) || N < 2 || N % 2 !== 0){
      err.textContent = "Please enter an even integer ≥ 2.";
      return;
    }

    const cands = candidateSlopesForBounces(N);
    if (cands.length === 0){
      err.textContent = "No candidates found for this N.";
      return;
    }

    // pick first candidate that appears to return; otherwise show first candidate anyway
    let chosen = null, chosenSim = null, chosenHit = false;
    for (const c of cands){
      const { sim, hit } = returnedAfterNbouncesCandidate(c.slope, N);
      if (!sim.corner && hit){
        chosen = c; chosenSim = sim; chosenHit = true; break;
      }
      if (!chosen){ chosen = c; chosenSim = sim; chosenHit = hit; }
    }

    out.textContent = `Candidate slopes: ${cands.length}. Showing m=${chosen.m}, n=${chosen.n}, slope=${chosen.slope.toPrecision(6)}`
      + (chosenSim.corner ? " (corner hit ⚠️)" : (chosenHit ? " (returns near start ✅)" : " (no near-return detected —)"));

    const cv = document.getElementById("cvBounces");
    drawRectPath(cv, chosenSim.pts, `2×1 rectangle | N=${N} | slope≈${chosen.slope.toPrecision(6)}`);
  });

  btnS?.addEventListener("click", ()=>{
    const err = document.getElementById("errSlope");
    const out = document.getElementById("outSlope");
    err.textContent = "";
    out.textContent = "";

    let slope;
    try{
      slope = parseExpr(document.getElementById("slopeInput").value);
    } catch(e){
      err.textContent = e.message || String(e);
      return;
    }

    const maxB = parseInt(document.getElementById("maxBounces").value, 10);
    const { pts, corner } = simulateBilliard(slope, clamp(maxB, 1, 5000));
    out.textContent = `Bounces shown: ${Math.max(0, pts.length-1)}`
      + (corner ? " (corner hit ⚠️)" : "");

    const cv = document.getElementById("cvSlope");
    const title = (slope===Infinity) ? "slope = ∞" : `slope = ${slope}`;
    drawRectPath(cv, pts, `2×1 rectangle | ${title}`);
  });

  // initial renders
  btnB?.click();
  btnS?.click();
})();
