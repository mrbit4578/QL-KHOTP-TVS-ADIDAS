/* ═══════════════════════════════════════════════════════════════════
   views/shipping.js — TMS · KẾ HOẠCH XUẤT HÀNG KINH DOANH
   15 mốc "Ngày xuất KD" thật (25/07/2026 → 09/01/2027) từ sheet Data
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  window.Views.shipping = {
    title: "Kế hoạch xuất hàng · TMS",
    render(root) {
      const plan = U.SHIP_PLAN;
      const next = plan.find(p => p.days >= 0);
      const in30 = plan.filter(p => p.days >= 0 && p.days <= 30);

      const readiness = p => {
        if (p.shipped >= p.prs && p.prs) return { cls: "ok", lab: "đã xuất đủ" };
        const pct = p.prs ? p.ready / p.prs : 0;
        if (pct >= 1) return { cls: "ok", lab: "sẵn sàng" };
        if (pct > 0) return { cls: "warn", lab: `sẵn sàng ${U.fmtPct(pct)}` };
        return { cls: "neu", lab: "chưa sản xuất" };
      };

      root.innerHTML = `
        <div class="grid g-kpi">
          <div class="card kpi kpi-acc"><div class="k-lab">${App.icon("truck")}<span>Mốc xuất gần nhất</span></div>
            <div class="k-val">${U.fmtDate(next.d)}</div>
            <div class="k-sub">còn ${next.days} ngày · ${U.fmt(next.prs)} đôi đi ${next.ctries.map(c => U.flag(c)).join(" ")}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("calendar")}<span>Tổng mốc xuất</span></div>
            <div class="k-val">${plan.length}</div><div class="k-sub">${U.fmtDate(plan[0].d)} → ${U.fmtDate(plan[plan.length - 1].d)}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("clock")}<span>Trong 30 ngày tới</span></div>
            <div class="k-val">${U.fmt(U.sum(in30, p => p.prs))} <small>đôi</small></div>
            <div class="k-sub">${in30.length} mốc · ${U.fmt(U.sum(in30, p => p.ctn))} thùng</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("box")}<span>Hàng sẵn trong kho</span></div>
            <div class="k-val">${U.fmt(U.NXT.tonPrs)} <small>đôi</small></div>
            <div class="k-sub">${U.fmt(U.NXT.tonCtn)} thùng chờ xuất</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("globe")}<span>Thị trường</span></div>
            <div class="k-val">14</div><div class="k-sub">quốc gia nhận hàng</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("check")}<span>Đã thực xuất</span></div>
            <div class="k-val">${U.fmt(U.NXT.xuatPrs)} <small>đôi</small></div>
            <div class="k-sub">${U.ONTIME.n ? `${(window.TVS_SHIPMENTS || []).filter(s => s.status === "shipped").length} phiếu XK · đúng hạn ${U.fmtPct(U.ONTIME.rate, 0)}` : `chưa có phiếu xuất kho nào`}</div></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Khối lượng xuất theo mốc ngày</h3><span class="sub">số đôi cần sẵn sàng tại mỗi mốc</span></div>
          <div class="card-b" id="chShipCols"></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Lịch xuất hàng chi tiết — 15 mốc</h3>
            <span class="sub">gom theo "Ngày xuất KD" · trạng thái so với tồn kho hiện tại</span></div>
          <div class="card-b"><div class="tl">
            ${plan.map(p => {
              const r = readiness(p);
              const urgent = p.days >= 0 && p.days <= 14 && p.ready < p.prs;
              return `<div class="tl-item ${r.cls === "ok" ? "done" : (urgent ? "late" : "")}">
                <div class="tl-dot"></div>
                <div class="tl-date">${U.fmtDate(p.d)} · ${p.days >= 0 ? "còn " + p.days + " ngày" : "đã qua"}</div>
                <div class="tl-main">
                  <b>${U.fmt(p.prs)} đôi</b> = ${U.fmt(p.ctn)} thùng · ${p.orders.length} đơn hàng ·
                  ${p.ctries.map(c => U.flag(c) + " " + (U.VN_COUNTRY[c] || c)).join(", ")}
                  <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">
                    <span class="bdg ${r.cls}">${r.lab}</span>
                    ${p.shipped > 0 && p.shipped < p.prs ? `<span class="bdg acc">đã xuất ${U.fmt(p.shipped)} đôi</span>` : ""}
                    ${urgent ? `<span class="bdg bad">cần ưu tiên sản xuất</span>` : ""}
                    ${p.orders.slice(0, 6).map(o => `<span class="bdg neu plain clickable" style="cursor:pointer" onclick="Views._openOrder('${o.ord}')">${o.ord}</span>`).join("")}
                    ${p.orders.length > 6 ? `<span class="note">+${p.orders.length - 6} đơn khác</span>` : ""}
                  </div>
                </div>
              </div>`;
            }).join("")}
          </div></div>
        </div>`;

      Charts.columns(document.getElementById("chShipCols"),
        plan.map(p => ({
          label: U.fmtDate(p.d).slice(0, 5),
          value: p.prs,
          color: p.days <= 30 && p.days >= 0 ? "#e5484d" : (p.days <= 90 ? "#f2a20c" : "#0050d8")
        })), { unit: "đôi", h: 250 });
    }
  };
})();
