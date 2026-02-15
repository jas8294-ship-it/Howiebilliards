const UA = 2.0, UB = 1.0;

function unit2(vx,vy){
  const n = Math.hypot(vx,vy);
  if (n === 0) return [1,0];
  return [vx/n, vy/n];
}

function simulateHitsRect(a,b, p0, v0, maxHits=8, eps=1e-12){
  let p = {x:p0.x, y:p0.y};
  let [vx,vy] = unit2(v0.vx, v0.vy);
  const pts = [{x:p.x,y:p.y}];
  const sides = [];

  for (let k=0; k<maxHits; k++){
    let tx = Infinity, ty = Infinity;
    if (vx > eps) tx = (a - p.x)/vx;
    else if (vx < -eps) tx = (0 - p.x)/vx;

    if (vy > eps) ty = (b - p.y)/vy;
    else if (vy < -eps) ty = (0 - p.y)/vy;

    const dt = Math.min(tx, ty);
    if (!Number.isFinite(dt) || dt < eps) break;

    p = { x: p.x + vx*dt, y: p.y + vy*dt };

    const hitCorner = Math.abs(tx - ty) < 1e-9;
    if (hitCorner){
      sides.push("corner");
      vx *= -1; vy *= -1;
    } else if (tx < ty){
      sides.push("vertical");
      vx *= -1;
    } else {
      sides.push("horizontal");
      vy *= -1;
    }
    pts.push({x:p.x,y:p.y});
  }
  return { pts, sides };
}

function unfoldPoints(a,b, pts, sides){
  let rx=0, ry=0;
  const U = [];
  U.push({x: pts[0].x, y: pts[0].y});

  for (let k=1; k<pts.length; k++){
    const x = pts[k].x, y = pts[k].y;
    const ux = rx*a + (rx%2===0 ? x : (a-x));
    const uy = ry*b + (ry%2===0 ? y : (b-y));
    U.push({x:ux, y:uy});

    const side = sides[k-1];
    if (side==="vertical") rx++;
    if (side==="horizontal") ry++;
    if (side==="corner"){ rx++; ry++; }
  }
  return U;
}

function drawUnfold(canOrig, canTile, pts, U, progress){
  // progress in [0,1]
  const ctxL = canOrig.getContext("2d");
  const ctxR = canTile.getContext("2d");

  function clear(ctx, W,H){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,W,H);
  }

  clear(ctxL, canOrig.width, canOrig.height);
  clear(ctxR, canTile.width, canTile.height);

  // left mapping for [0,2]x[0,1]
  const pad=28, W=canOrig.width, H=canOrig.height;
  const s = Math.min((W-2*pad)/UA, (H-2*pad)/UB);
  const ox=pad, oy=H-pad;
  const toL = (p)=>[ox + p.x*s, oy - p.y*s];

  // left border
  ctxL.strokeStyle="#111"; ctxL.lineWidth=3;
  ctxL.beginPath();
  ctxL.rect(ox, oy-UB*s, UA*s, UB*s);
  ctxL.stroke();

  // right mapping: fit unfolded points
  const WR=canTile.width, HR=canTile.height;
  const padR=28;
  const xs = U.map(p=>p.x), ys = U.map(p=>p.y);
  let xmin=Math.min(...xs), xmax=Math.max(...xs);
  let ymin=Math.min(...ys), ymax=Math.max(...ys);
  const wU = Math.max(1e-9, xmax-xmin), hU = Math.max(1e-9, ymax-ymin);
  const sR = Math.min((WR-2*padR)/wU, (HR-2*padR)/hU);
  const oxR = padR - xmin*sR;
  const oyR = HR - padR + ymin*sR;
  const toR = (p)=>[oxR + p.x*sR, oyR - p.y*sR];

  // draw some tile lines (light)
  ctxR.strokeStyle="#777"; ctxR.lineWidth=2;
  const tiMin = Math.floor(xmin/UA)-1, tiMax = Math.floor(xmax/UA)+2;
  const tjMin = Math.floor(ymin/UB)-1, tjMax = Math.floor(ymax/UB)+2;
  for (let ti=tiMin; ti<=tiMax; ti++){
    for (let tj=tjMin; tj<=tjMax; tj++){
      const x0=ti*UA, y0=tj*UB;
      const pA={x:x0,y:y0}, pB={x:x0+UA,y:y0}, pC={x:x0+UA,y:y0+UB}, pD={x:x0,y:y0+UB};
      const [a1,b1]=toR(pA), [a2,b2]=toR(pB), [a3,b3]=toR(pC), [a4,b4]=toR(pD);
      ctxR.beginPath();
      ctxR.moveTo(a1,b1); ctxR.lineTo(a2,b2); ctxR.lineTo(a3,b3); ctxR.lineTo(a4,b4); ctxR.closePath();
      ctxR.stroke();
    }
  }

  // partial polyline based on progress
  function drawPartial(ctx, toXY, P){
    if (P.length < 2) return;
    const totalSeg = P.length - 1;
    const t = progress * totalSeg;
    const full = Math.floor(t);
    const frac = t - full;

    ctx.strokeStyle="blue"; ctx.lineWidth=2;
    ctx.beginPath();
    let [x0,y0]=toXY(P[0]);
    ctx.moveTo(x0,y0);

    for (let i=1; i<=full; i++){
      const [x,y]=toXY(P[i]);
      ctx.lineTo(x,y);
    }
    if (full+1 < P.length){
      const p0=P[full], p1=P[full+1];
      const pm={x: p0.x + frac*(p1.x-p0.x), y: p0.y + frac*(p1.y-p0.y)};
      const [x,y]=toXY(pm);
      ctx.lineTo(x,y);
    }
    ctx.stroke();

    // start dot
    ctx.fillStyle="red";
    const [sx,sy]=toXY(P[0]);
    ctx.beginPath(); ctx.arc(sx,sy,6,0,2*Math.PI); ctx.fill();
  }

  drawPartial(ctxL, toL, pts);
  drawPartial(ctxR, toR, U);
}

(function initUnfold(){
  const btn = document.getElementById("btnUnfold");
  const err = document.getElementById("errUnfold");
  const cvL = document.getElementById("cvUnOrig");
  const cvR = document.getElementById("cvUnTile");

  let raf = null;
  function stop(){ if (raf) cancelAnimationFrame(raf); raf=null; }

  btn?.addEventListener("click", ()=>{
    err.textContent = "";
    stop();

    const hits = parseInt(document.getElementById("unHits").value, 10);
    const dirStr = document.getElementById("unDir").value.trim();
    const parts = dirStr.split(",").map(s=>parseFloat(s.trim()));
    if (!Number.isInteger(hits) || hits < 1 || hits > 200){
      err.textContent = "Hits must be an integer between 1 and 200.";
      return;
    }
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])){
      err.textContent = "Direction must look like: 2,1";
      return;
    }

    const p0 = { x: UA/4, y: 0.0 }; // like your period-4 setup
    const v0 = { vx: parts[0], vy: parts[1] };

    const sim = simulateHitsRect(UA, UB, p0, v0, hits);
    const U = unfoldPoints(UA, UB, sim.pts, sim.sides);

    const t0 = performance.now();
    const periodMs = 2400;

    function tick(t){
      const u = ((t - t0) % periodMs) / periodMs;
      drawUnfold(cvL, cvR, sim.pts, U, u);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });

  btn?.click();
})();
