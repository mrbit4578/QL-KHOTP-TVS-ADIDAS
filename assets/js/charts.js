/* ═══════════════════════════════════════════════════════════════════
   charts.js — Bộ biểu đồ SVG thuần (offline, không CDN)
   barH · columns · donut · line — dùng chung cho toàn hệ thống
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const C = {};
  const NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#0050d8", "#12b5a5", "#f2a20c", "#e5484d", "#7c5cff",
                   "#2e90fa", "#66c61c", "#ef6820", "#0e9384", "#d444f1",
                   "#4e5ba6", "#ca8504", "#3ccb7f", "#ff692e"];

  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const txt = (e, s) => { e.textContent = s; return e; };
  const F = n => U.fmt(n);
  /* Màu theo THEME (đọc biến CSS) — biểu đồ tự đổi màu khi bật nền tối */
  const CV = (name, fb) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; } };
  const TC = () => ({ grid: CV("--line", "#eef1f5"), track: CV("--neu-bg", "#eef1f5"),
    strong: CV("--txt", "#101828"), muted: CV("--txt-2", "#475467"), faint: CV("--txt-3", "#98a2b3"),
    acc: CV("--acc", "#0050d8"), card: CV("--card", "#ffffff") });

  /* ── Bar ngang: data=[{label,value,color?,sub?}] ─────────────── */
  C.barH = function (container, data, opts = {}) {
    container.innerHTML = "";
    const max = Math.max(...data.map(d => d.value), 1);
    const rowH = opts.rowH || 30, labW = opts.labW || 150, valW = 74; const c = TC();
    const W = 640, H = data.length * rowH + 4;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block", role: "img" });
    data.forEach((d, i) => {
      const y = i * rowH + 3, barW = Math.max(2, (d.value / max) * (W - labW - valW - 14));
      const g = el("g", {}, svg);
      el("title", {}, g).textContent = `${d.label}: ${F(d.value)}${opts.unit ? " " + opts.unit : ""}`;
      txt(el("text", { x: labW - 10, y: y + rowH / 2 + 1, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": "11.5", "font-weight": "600", fill: c.muted }, g), d.label);
      el("rect", { x: labW, y: y + 4, width: W - labW - valW - 14, height: rowH - 12, rx: 5, fill: c.track }, g);
      el("rect", { x: labW, y: y + 4, width: barW, height: rowH - 12, rx: 5,
        fill: d.color || PALETTE[i % PALETTE.length] }, g);
      txt(el("text", { x: labW + barW + 8, y: y + rowH / 2 + 1, "dominant-baseline": "middle",
        "font-size": "11.5", "font-weight": "800", fill: c.strong }, g), F(d.value));
    });
    container.appendChild(svg);
  };

  /* ── Cột đứng: data=[{label,value,color?}] ───────────────────── */
  C.columns = function (container, data, opts = {}) {
    container.innerHTML = "";
    const W = 640, H = opts.h || 240, padB = 26, padT = 22, padL = 8, padR = 8;
    const max = Math.max(...data.map(d => d.value), 1);
    const iw = (W - padL - padR) / data.length;
    const bw = Math.min(iw * 0.62, 64); const c = TC();
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block" });
    // lưới ngang
    for (let i = 1; i <= 3; i++) {
      const y = padT + (H - padT - padB) * (i / 4);
      el("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: c.grid, "stroke-width": 1 }, svg);
    }
    data.forEach((d, i) => {
      const h = (d.value / max) * (H - padT - padB);
      const x = padL + i * iw + (iw - bw) / 2, y = H - padB - h;
      const g = el("g", {}, svg);
      el("title", {}, g).textContent = `${d.label}: ${F(d.value)}${opts.unit ? " " + opts.unit : ""}`;
      el("rect", { x, y, width: bw, height: Math.max(h, 2), rx: 6, fill: d.color || c.acc }, g);
      txt(el("text", { x: x + bw / 2, y: y - 6, "text-anchor": "middle", "font-size": "11",
        "font-weight": "800", fill: c.strong }, g), F(d.value));
      txt(el("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle", "font-size": "10.6",
        "font-weight": "600", fill: c.muted }, g), d.label);
    });
    container.appendChild(svg);
  };

  /* ── Donut: data=[{label,value,color?}] + chú giải ───────────── */
  C.donut = function (container, data, opts = {}) {
    container.innerHTML = "";
    const total = U.sum(data, d => d.value) || 1;
    const box = document.createElement("div");
    box.style.cssText = "display:flex;gap:18px;align-items:center;flex-wrap:wrap";
    const size = opts.size || 168, R = size / 2, r = R - (opts.thick || 26), cx = R, cy = R; const c = TC();
    const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, style: `width:${size}px;height:${size}px;flex-shrink:0` });
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = d.value / total, a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p1 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
      const p2 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      const p3 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      const p4 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const path = el("path", {
        d: `M${p1} A${R},${R} 0 ${large} 1 ${p2} L${p3} A${r},${r} 0 ${large} 0 ${p4} Z`,
        fill: d.color || PALETTE[i % PALETTE.length], stroke: c.card, "stroke-width": 1.5
      }, svg);
      el("title", {}, path).textContent = `${d.label}: ${F(d.value)} (${U.fmtPct(frac)})`;
      a0 = a1;
    });
    txt(el("text", { x: cx, y: cy - 4, "text-anchor": "middle", "font-size": "17", "font-weight": "800", fill: c.strong }, svg), F(total));
    txt(el("text", { x: cx, y: cy + 13, "text-anchor": "middle", "font-size": "9.5", "font-weight": "700",
      fill: c.faint, "letter-spacing": ".08em" }, svg), (opts.centerLabel || "TỔNG").toUpperCase());
    box.appendChild(svg);

    const lg = document.createElement("div");
    lg.style.cssText = "display:flex;flex-direction:column;gap:7px;min-width:170px;flex:1";
    data.forEach((d, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12.3px";
      row.innerHTML = `<span style="width:10px;height:10px;border-radius:3px;flex-shrink:0;background:${d.color || PALETTE[i % PALETTE.length]}"></span>
        <span style="color:${c.muted};font-weight:600">${U.esc(d.label)}</span>
        <span style="margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums;color:${c.strong}">${F(d.value)}</span>
        <span style="color:${c.faint};font-variant-numeric:tabular-nums;width:52px;text-align:right">${U.fmtPct(d.value / total)}</span>`;
      lg.appendChild(row);
    });
    box.appendChild(lg);
    container.appendChild(box);
  };

  /* ── Đường/miền theo thời gian: data=[{label,value}] ─────────── */
  C.line = function (container, data, opts = {}) {
    container.innerHTML = "";
    const W = 680, H = opts.h || 230, padB = 34, padT = 20, padL = 14, padR = 14;
    const max = Math.max(...data.map(d => d.value), 1);
    const n = data.length;
    const X = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
    const Y = v => H - padB - (v / max) * (H - padT - padB); const c = TC();
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block" });
    for (let i = 1; i <= 3; i++) {
      const y = padT + (H - padT - padB) * (i / 4);
      el("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: c.grid }, svg);
    }
    const pts = data.map((d, i) => `${X(i)},${Y(d.value)}`).join(" ");
    el("polygon", { points: `${padL},${H - padB} ${pts} ${W - padR},${H - padB}`, fill: c.acc + "22" }, svg);
    el("polyline", { points: pts, fill: "none", stroke: c.acc, "stroke-width": 2.4, "stroke-linejoin": "round" }, svg);
    data.forEach((d, i) => {
      const g = el("g", {}, svg);
      el("title", {}, g).textContent = `${d.label}: ${F(d.value)}${opts.unit ? " " + opts.unit : ""}`;
      el("circle", { cx: X(i), cy: Y(d.value), r: 4, fill: c.card, stroke: c.acc, "stroke-width": 2.2 }, g);
      if (opts.values !== false)
        txt(el("text", { x: X(i), y: Y(d.value) - 9, "text-anchor": "middle", "font-size": "10.2", "font-weight": "800", fill: c.strong }, g), F(d.value));
      const t = txt(el("text", { x: X(i), y: H - 9, "text-anchor": "middle", "font-size": "9.8", "font-weight": "600", fill: c.muted }, g), d.label);
      if (n > 9) t.setAttribute("transform", `rotate(-32 ${X(i)} ${H - 9})`);
    });
    container.appendChild(svg);
  };

  C.PALETTE = PALETTE;
  window.Charts = C;
})();
