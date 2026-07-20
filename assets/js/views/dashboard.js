/* ═══════════════════════════════════════════════════════════════════
   views/dashboard.js — BẢNG ĐIỀU KHIỂN (Analytics & Dashboard)
   Toàn cảnh đơn đặt hàng adidas Rubber Boots & tiến độ nhập kho TVS
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  function kpi(ico, lab, val, sub, accent) {
    return `<div class="card kpi${accent ? " kpi-acc" : ""}">
      <div class="k-lab">${App.icon(ico)}<span>${lab}</span></div>
      <div class="k-val">${val}</div>
      <div class="k-sub">${sub}</div>
    </div>`;
  }

  window.Views.dashboard = {
    title: "Bảng điều khiển",
    render(root) {
      const N = U.NXT;
      const atRisk = U.ORDER_INDEX.filter(o => o.daysLeft !== null && o.daysLeft <= 30 && o.short > 0);
      const activeOrders = U.ORDER_INDEX.filter(o => o.recvPrs > 0);

      /* ── Cảnh báo: banner chi tiết cho đơn khẩn cấp, gộp phần còn lại ── */
      const critical = atRisk.filter(o => o.daysLeft <= 7 || o.recvPrs > 0);
      const others = atRisk.filter(o => !critical.includes(o));
      let alerts = critical.map(o => {
        const cls = o.daysLeft <= 7 ? "" : " warn";
        return `<div class="alert${cls}">
          ${App.icon("alert", "a-ico")}
          <div class="a-t">
            <b>${U.flag(o.ctry)} ${o.ord} — ${U.esc(o.ctry)}</b> xuất KD ngày <b>${U.fmtDate(o.d)}</b>
            (còn <b>${o.daysLeft} ngày</b>) · đã nhập <b>${U.fmt(o.recvPrs)}/${U.fmt(o.prs)}</b> đôi,
            thiếu <b>${U.fmt(o.short)} đôi</b>${o.notes.length ? ` · chưa sản xuất: <b>${o.notes.map(U.esc).join("; ")}</b>` : ""}
            &nbsp;<a href="#/orders?q=${o.ord}" style="color:inherit;font-weight:800">Xem đơn →</a>
          </div>
        </div>`;
      }).join("");
      if (others.length) {
        alerts += `<div class="alert warn">
          ${App.icon("clock", "a-ico")}
          <div class="a-t"><b>${others.length} đơn khác</b> phải xuất trong 30 ngày tới nhưng chưa nhập kho
          (tổng <b>${U.fmt(U.sum(others, o => o.short))} đôi</b>: ${others.slice(0, 5).map(o => o.ord).join(", ")}${others.length > 5 ? "…" : ""})
          &nbsp;<a href="#/shipping" style="color:inherit;font-weight:800">Xem kế hoạch xuất →</a></div>
        </div>`;
      }

      root.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">${alerts}</div>

        <div class="grid g-kpi ${alerts ? "mt" : ""}">
          ${kpi("orders", "Tổng đặt hàng", `${U.fmt(N.datPrs)} <small>đôi</small>`, `${U.fmt(N.datCtn)} thùng · mã hàng ${TVS_META.itemCode}`, true)}
          ${kpi("clip", "Đơn hàng", `${U.fmt(U.ORDER_INDEX.length)}`, `3 đợt đặt hàng · 5 mã màu`)}
          ${kpi("globe", "Thị trường xuất", `${U.uniq(TVS_ORDERS, r => r.ctry).length}`, `Ý, Đức, Mỹ, Nhật, Anh…`)}
          ${kpi("box", "Đã nhập kho", `${U.fmt(N.nhapPrs)} <small>đôi</small>`, `${U.fmt(N.nhapCtn)} thùng · ${activeOrders.length} đơn đang chạy`)}
          ${kpi("layers", "Tồn kho hiện tại", `${U.fmt(N.tonPrs)} <small>đôi</small>`,
            `Xuất kho: ${U.fmt(N.xuatPrs)} đôi${U.ONTIME.n ? " · đúng hạn " + U.fmtPct(U.ONTIME.rate, 0) : ""}`)}
          ${kpi("gauge", "Tiến độ sản xuất", U.fmtPct(N.progress), `Còn phải SX ${U.fmt(N.conSXPrs)} đôi`)}
        </div>

        <div class="grid g-23 mt">
          <div class="card">
            <div class="card-h"><h3>Đơn đặt hàng theo thị trường</h3><span class="sub">số đôi — 14 quốc gia</span></div>
            <div class="card-b" id="chCountry"></div>
          </div>
          <div class="card">
            <div class="card-h"><h3>Cơ cấu theo mã màu</h3><span class="sub">LC1783 – LC1787</span></div>
            <div class="card-b" id="chColor"></div>
          </div>
        </div>

        <div class="grid g-2 mt">
          <div class="card">
            <div class="card-h"><h3>Phân bố theo size</h3><span class="sub">UK 3 → UK 9 · số đôi</span></div>
            <div class="card-b" id="chSize"></div>
          </div>
          <div class="card">
            <div class="card-h"><h3>Kế hoạch xuất kinh doanh theo mốc ngày</h3><span class="sub">25/07/2026 → 09/01/2027</span></div>
            <div class="card-b" id="chShip"></div>
          </div>
        </div>

        <div class="grid g-32 mt">
          <div class="card">
            <div class="card-h"><h3>Đợt đặt hàng</h3><span class="sub">theo số đôi</span></div>
            <div class="card-b" id="chBatch"></div>
          </div>
          <div class="card">
            <div class="card-h">
              <h3>Tiến độ nhập kho theo đơn hàng đang sản xuất</h3>
              <span class="sub">đối chiếu sheet ChitietNK ↔ Data</span>
              <span class="spacer"></span>
              <a class="btn ghost" href="#/inventory">Xem N-X-T →</a>
            </div>
            <div class="card-b" id="pgOrders"></div>
          </div>
        </div>`;

      /* ── Vẽ biểu đồ từ dữ liệu thật ── */
      Charts.barH(document.getElementById("chCountry"),
        U.aggBy(TVS_ORDERS, r => r.ctry).map((x, i) => ({
          label: `${U.flag(x.key)} ${x.key}`, value: x.prs, color: Charts.PALETTE[i % Charts.PALETTE.length]
        })), { unit: "đôi", labW: 190 });

      Charts.donut(document.getElementById("chColor"),
        U.aggBy(TVS_ORDERS, r => r.col).map(x => ({ label: x.key, value: x.prs, color: U.colorHex(x.key) })),
        { centerLabel: "đôi" });

      Charts.columns(document.getElementById("chSize"),
        U.SIZES.map(s => ({ label: s, value: U.sum(TVS_ORDERS.filter(r => r.sz === s), r => r.prs) })),
        { unit: "đôi" });

      Charts.line(document.getElementById("chShip"),
        U.SHIP_PLAN.map(p => ({ label: U.fmtDate(p.d).slice(0, 5), value: p.prs })),
        { unit: "đôi" });

      Charts.columns(document.getElementById("chBatch"),
        U.aggBy(TVS_ORDERS, r => r.bat).sort((a, b) => a.key - b.key).map((x, i) => ({
          label: "Đợt " + x.key, value: x.prs, color: ["#0050d8", "#12b5a5", "#f2a20c"][i]
        })), { unit: "đôi", h: 220 });

      /* ── Tiến độ các đơn đang chạy + tổng ── */
      const pg = document.getElementById("pgOrders");
      const rows = activeOrders.map(o => {
        const pct = o.recvPrs / o.prs;
        const cls = pct >= 1 ? "ok" : (o.daysLeft <= 7 ? "bad" : "warn");
        return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)">
          <div style="width:210px;font-weight:700;font-size:12.8px">${U.flag(o.ctry)} ${o.ord}
            <span class="note" style="font-weight:600"> · ${U.esc(o.ctry)}</span></div>
          <div class="pline" style="flex:1"><div class="pbar ${cls}" style="flex:1"><i style="width:${Math.min(100, pct * 100)}%"></i></div>
            <span class="pv">${U.fmt(o.recvPrs)}/${U.fmt(o.prs)} đôi (${U.fmtPct(pct)})</span></div>
          <span class="bdg ${o.short > 0 ? "bad" : "ok"}">${o.short > 0 ? "thiếu " + U.fmt(o.short) : "đủ hàng"}</span>
        </div>`;
      }).join("");
      const pctAll = U.NXT.progress;
      pg.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid var(--line-2)">
          <div style="width:210px;font-weight:800;font-size:12.8px">TOÀN BỘ CHƯƠNG TRÌNH</div>
          <div class="pline" style="flex:1"><div class="pbar" style="flex:1"><i style="width:${(pctAll * 100).toFixed(2)}%"></i></div>
            <span class="pv">${U.fmt(U.NXT.nhapPrs)}/${U.fmt(U.NXT.datPrs)} đôi (${U.fmtPct(pctAll)})</span></div>
          <span class="bdg acc">${U.ORDER_INDEX.length - activeOrders.length} đơn chưa bắt đầu</span>
        </div>
        ${rows}
        <div class="note" style="margin-top:10px">Quy cách đóng thùng chuẩn: <b>${TVS_META.packing} đôi/thùng</b> — số thùng = ROUNDUP(số đôi ÷ 6) đúng theo công thức trong file Excel.</div>`;
    }
  };
})();
