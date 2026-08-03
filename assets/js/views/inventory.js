/* ═══════════════════════════════════════════════════════════════════
   views/inventory.js — N-X-T · NHẬP – XUẤT – TỒN KHO THÀNH PHẨM
   Đối chiếu: SL đặt (Data) ↔ SL nhập (ChitietNK) ↔ SL xuất ↔ Tồn kho
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};
  const st = { showAll: false };

  window.Views.inventory = {
    title: "Tồn kho N-X-T",
    render(root) {
      const N = U.NXT;
      const active = U.ORDER_INDEX.filter(o => o.recvPrs > 0);
      const pending = U.ORDER_INDEX.filter(o => o.recvPrs === 0);

      const flowCard = (lab, prs, ctn, color, note) => `
        <div class="card kpi" style="border-top:3px solid ${color}">
          <div class="k-lab"><span>${lab}</span></div>
          <div class="k-val">${U.fmt(prs)} <small>đôi</small></div>
          <div class="k-sub">${U.fmt(ctn)} thùng${note ? " · " + note : ""}</div>
        </div>`;

      /* Ma trận size của các đơn đang chạy */
      const sizeMatrix = active.map(o => {
        const cells = U.SIZES.filter(s => o.sizes[s]).map(s => {
          const c = o.sizes[s], diff = c.received - c.ordered;
          const cls = c.received === 0 ? "short" : (diff >= 0 ? "full" : "short");
          return `<div class="sm-cell ${cls}">
            <div class="s">${s}</div>
            <div class="v">${U.fmt(c.received)}<span style="font-size:11px;color:var(--txt-3)">/${U.fmt(c.ordered)}</span></div>
            <div class="m">${diff === 0 ? "đủ" : (diff > 0 ? "+" + diff : diff + " đôi")}</div>
          </div>`;
        }).join("");
        return `<div style="margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
            <b>${U.flag(o.ctry)} ${o.ord}</b><span class="note">${U.esc(o.ctry)} · màu ${o.col} · xuất KD ${U.fmtDate(o.d)}</span>
            <span class="bdg ${o.short > 0 ? "warn" : "ok"}">nhập ${U.fmt(o.recvPrs)}/${U.fmt(o.prs)} đôi</span>
          </div>
          <div class="size-matrix">${cells}</div>
        </div>`;
      }).join("");

      const rowsToShow = st.showAll ? U.ORDER_INDEX : active;

      root.innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(5,1fr);gap:16px">
          ${flowCard("① SL ĐẶT HÀNG", N.datPrs, N.datCtn, "#0050d8", "95 đơn")}
          ${flowCard("② ĐÃ NHẬP KHO (N)", N.nhapPrs, N.nhapCtn, "#12b5a5", U.fmtPct(N.progress) + " kế hoạch")}
          ${flowCard("③ ĐÃ XUẤT KHO (X)", N.xuatPrs, N.xuatCtn, "#f2a20c",
            N.xuatPrs ? `đúng hạn ${U.ONTIME.rate === null ? "—" : U.fmtPct(U.ONTIME.rate, 0)}` : "chưa có ngày thực xuất")}
          ${flowCard("④ TỒN KHO (T = N − X)", N.tonPrs, N.tonCtn, "#0c0e12", "sẵn sàng chờ xuất")}
          ${flowCard("⑤ CÒN PHẢI SẢN XUẤT", N.conSXPrs, N.datCtn - N.nhapCtn, "#e5484d", "so với tổng đặt")}
        </div>

        <div class="grid g-32 mt">
          <div class="card">
            <div class="card-h"><h3>Danh sách thiếu hụt cần xử lý</h3><span class="sub">từ cột “SL đôi thiếu/đủ” & “SL thiếu chưa sx”</span></div>
            <div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Loại</th><th>Đơn hàng</th><th>Size</th><th class="num">Số đôi</th><th>Ghi chú</th></tr></thead>
              <tbody>${U.SHORTAGES.map(s => `
                <tr>
                  <td><span class="bdg ${s.type === "chưa sản xuất" ? "warn" : "bad"}">${s.type}</span></td>
                  <td class="clickable" onclick="Views._openOrder('${s.ord}')"><b>${s.ord}</b> <span class="note">${U.flag(s.ctry)}</span></td>
                  <td><b>${s.sz}</b></td>
                  <td class="num neg">${U.fmt(s.qty)}</td>
                  <td class="note">${U.esc(s.note)}</td>
                </tr>`).join("")}</tbody>
              <tfoot><tr><td colspan="3">TỔNG THIẾU</td>
                <td class="num neg">${U.fmt(U.sum(U.SHORTAGES, s => s.qty))}</td><td></td></tr></tfoot>
            </table></div>
          </div>

          <div class="card">
            <div class="card-h"><h3>Tồn kho theo size — đơn đang sản xuất</h3>
              <span class="sub">đã nhập / đặt hàng theo từng size</span></div>
            <div class="card-b">${sizeMatrix || `<div class="note">Chưa có đơn nào nhập kho.</div>`}</div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-h">
            <h3>Bảng N-X-T theo đơn hàng</h3>
            <span class="sub">${st.showAll ? "toàn bộ 95 đơn" : "đơn có phát sinh nhập kho"}</span>
            <span class="spacer"></span>
            <button class="btn" id="btnToggleAll">${st.showAll ? "Chỉ hiện đơn có phát sinh" : "Hiện toàn bộ 95 đơn"}</button>
          </div>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Đơn hàng</th><th>Quốc gia</th><th>Màu</th><th>Xuất KD</th>
              <th class="num">Đặt (đôi)</th><th class="num">Nhập (N)</th><th class="num">Xuất (X)</th>
              <th class="num">Tồn (T)</th><th class="num">Còn thiếu</th><th style="min-width:190px">Tiến độ</th>
            </tr></thead>
            <tbody>${rowsToShow.map(o => {
              const pct = o.prs ? o.recvPrs / o.prs : 0;
              const cls = pct >= 1 ? "ok" : (pct > 0 ? "warn" : "");
              return `<tr class="clickable" onclick="Views._openOrder('${o.ord}')">
                <td><b>${o.ord}</b></td>
                <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
                <td>${U.colorCell(o.col)}</td>
                <td>${U.fmtDate(o.d)}</td>
                <td class="num">${U.fmt(o.prs)}</td>
                <td class="num">${o.recvPrs ? U.fmt(o.recvPrs) : "0"}</td>
                <td class="num">${o.shipPrs ? U.fmt(o.shipPrs) : "0"}</td>
                <td class="num"><b>${U.fmt(o.tonPrs)}</b></td>
                <td class="num ${o.short > 0 && o.recvPrs > 0 ? "neg" : ""}">${U.fmt(o.short)}</td>
                <td><div class="pline"><div class="pbar ${cls}"><i style="width:${Math.min(100, pct * 100)}%"></i></div>
                  <span class="pv">${U.fmtPct(pct)}</span></div></td>
              </tr>`;
            }).join("")}</tbody>
            <tfoot><tr>
              <td colspan="4">TỔNG ${st.showAll ? "(95 đơn)" : "(" + rowsToShow.length + " đơn có phát sinh)"}</td>
              <td class="num">${U.fmt(U.sum(rowsToShow, o => o.prs))}</td>
              <td class="num">${U.fmt(U.sum(rowsToShow, o => o.recvPrs))}</td>
              <td class="num">${U.fmt(U.sum(rowsToShow, o => o.shipPrs))}</td>
              <td class="num">${U.fmt(U.sum(rowsToShow, o => o.tonPrs))}</td>
              <td class="num neg">${U.fmt(U.sum(rowsToShow, o => o.short))}</td><td></td>
            </tr></tfoot>
          </table></div>
          ${st.showAll ? "" : `<div class="note" style="padding:10px 18px">${pending.length} đơn còn lại chưa bắt đầu nhập kho (Tồn = 0). Bấm “Hiện toàn bộ 95 đơn” để xem đầy đủ.</div>`}
        </div>`;

      document.getElementById("btnToggleAll").onclick = () => { st.showAll = !st.showAll; this.render(root); };
    }
  };
})();
