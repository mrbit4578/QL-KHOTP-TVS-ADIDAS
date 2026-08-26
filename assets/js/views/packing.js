/* ═══════════════════════════════════════════════════════════════════
   views/packing.js — PACKING LIST (CLP) · v5.0
   • Xem toàn bộ packing list theo ĐỢT ĐẶT HÀNG (đợt 1–2–3 nhúng sẵn
     trong assets/js/data-packing.js + các đợt sau do người dùng import)
   • IMPORT PACKING LIST THEO MẪU (.xlsx / .csv) → tự mapping thành
     thùng nguyên / thùng lẻ / thùng MIX SIZE, đối chiếu với đơn đặt
     hàng (OMS) trước khi lưu; chỉ thị đã có packing phải TÍCH CHỌN
     mới ghi đè
   • Export packing (.xlsx/.csv) · xoá bản import · nhật ký import
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const st = { bat: "", src: "", q: "" };
  let imp = null;                     /* kết quả import đang xem trước */

  const srcBdg = s => s === "seed"
    ? `<span class="bdg neu plain" title="Dữ liệu gốc nhúng trong assets/js/data-packing.js">gốc</span>`
    : `<span class="bdg acc plain" title="Import từ file packing list">import</span>`;
  const matchBdg = m => m === "ok"
    ? `<span class="bdg ok">khớp đơn đặt hàng</span>`
    : (m === "diff" ? `<span class="bdg warn">lệch số đôi</span>`
      : `<span class="bdg bad">chưa có đơn hàng</span>`);
  const mixTxt = g => Object.entries(g.sizes).map(([sz, q]) => `${sz.replace("UK ", "")}×${q}`).join(" · ");
  const ctnTxt = g => g.from ? (g.from === g.to ? "#" + g.from : `#${g.from}–${g.to}`) : "—";
  const batTxt = b => b ? "đợt " + b : "—";

  /* ═════════ MÀN HÌNH CHÍNH ═════════ */
  window.Views.packing = {
    title: "Packing List · CLP",
    render(root) {
      const S = Store.packingStats();
      const rows = Store.packingRows();
      const log = (Store.local.packingLog || []);
      const bats = Object.keys(S.byBat).map(Number).sort((a, b) => a - b);
      const noPk = (U.ORDER_INDEX || []).filter(o => !(window.TVS_PACKING || {})[o.ord]);

      const q = st.q.trim().toLowerCase();
      const view = rows.filter(r =>
        (!st.bat || String(r.bat || "") === st.bat) &&
        (!st.src || r.src === st.src) &&
        (!q || r.ord.toLowerCase().includes(q) || (r.p.po || "").toLowerCase().includes(q)
          || (r.p.col || "").toLowerCase().includes(q) || (r.p.ctry || "").toLowerCase().includes(q)));

      root.innerHTML = `
        <div class="grid g-kpi">
          <div class="card kpi kpi-acc"><div class="k-lab">${App.icon("box")}<span>Chỉ thị có packing</span></div>
            <div class="k-val">${U.fmt(S.orders)}<small>/${U.fmt((U.ORDER_INDEX || []).length)} đơn</small></div>
            <div class="k-sub">${U.fmt(S.seed)} gốc (đợt 1–3) · ${U.fmt(S.imported)} import</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("layers")}<span>Tổng số đôi (PL)</span></div>
            <div class="k-val">${U.fmt(S.prs)} <small>đôi</small></div>
            <div class="k-sub">đơn đặt hàng: ${U.fmt(U.NXT.datPrs)} đôi</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("box")}<span>Tổng thùng carton</span></div>
            <div class="k-val">${U.fmt(S.ctn)} <small>thùng</small></div>
            <div class="k-sub">${U.fmt(S.groups)} nhóm thùng theo packing</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("layers")}<span>Nhóm MIX SIZE</span></div>
            <div class="k-val">${U.fmt(S.mix)}</div>
            <div class="k-sub">thùng gộp nhiều size trong 1 carton</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("alert")}<span>Chưa có packing</span></div>
            <div class="k-val" style="color:${S.without ? "var(--warn)" : "var(--ok)"}">${U.fmt(S.without)}</div>
            <div class="k-sub">tạm dùng quy cách ${TVS_META.packing} đôi/thùng</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("check")}<span>Đối chiếu đơn đặt hàng</span></div>
            <div class="k-val" style="color:${S.diff ? "var(--bad)" : "var(--ok)"}">${S.diff ? U.fmt(S.diff) + " lệch" : "khớp 100%"}</div>
            <div class="k-sub">${S.noOrder ? U.fmt(S.noOrder) + " chỉ thị chưa có đơn hàng" : "packing ↔ SL đặt theo từng size"}</div></div>
        </div>

        <div class="card mt">
          <div class="filters">
            <button class="btn primary need-edit" id="pkImp" data-testid="pk-import-btn">${App.icon("upload", "ico")} Import packing list</button>
            <button class="btn" id="pkTplX" data-testid="pk-tpl-xlsx">${App.icon("download", "ico")} File mẫu (.xlsx)</button>
            <button class="btn" id="pkTplC" data-testid="pk-tpl-csv">${App.icon("download", "ico")} File mẫu (.csv)</button>
            <button class="btn" id="pkExpX" data-testid="pk-export-xlsx">${App.icon("download", "ico")} Export packing (.xlsx)</button>
            <button class="btn" id="pkExpC" data-testid="pk-export-csv">${App.icon("download", "ico")} Export (.csv)</button>
            ${S.imported ? `<button class="btn danger need-edit" id="pkClear" data-testid="pk-clear-btn">${App.icon("trash", "ico")} Xoá ${S.imported} packing đã import</button>` : ""}
            <span class="f-chipcount">Nguồn: sheet <b>CLP</b> file đơn hàng khách adidas · các đợt sau chỉ cần <b>Import theo mẫu</b></span>
          </div>
          <div class="filters" style="border-bottom:0">
            <select class="f-select" id="pkBat" data-testid="pk-filter-bat">
              <option value="">Tất cả đợt (${bats.length} đợt)</option>
              ${bats.map(b => `<option value="${b}" ${st.bat === String(b) ? "selected" : ""}>Đợt ${b} — ${U.fmt(S.byBat[b].orders)} chỉ thị</option>`).join("")}
            </select>
            <select class="f-select" id="pkSrc" data-testid="pk-filter-src">
              <option value="">Mọi nguồn dữ liệu</option>
              <option value="seed" ${st.src === "seed" ? "selected" : ""}>Gốc — data-packing.js</option>
              <option value="import" ${st.src === "import" ? "selected" : ""}>Đã import từ file</option>
            </select>
            <input class="f-input" id="pkQ" placeholder="Tìm chỉ thị, PO, màu, quốc gia…" value="${U.esc(st.q)}" data-testid="pk-search">
            <span class="f-chipcount">${U.fmt(view.length)} chỉ thị · ${U.fmt(U.sum(view, r => r.prs))} đôi · ${U.fmt(U.sum(view, r => r.ctn))} thùng</span>
          </div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Packing list theo đợt đặt hàng</h3>
            <span class="sub">số thùng thực tế theo CLP (khác ROUNDUP ÷ ${TVS_META.packing} vì có thùng lẻ & thùng MIX)</span></div>
          <div class="tbl-wrap"><table class="tbl" data-testid="pk-batch-table">
            <thead><tr>
              <th>Đợt đặt hàng</th><th class="num">Chỉ thị</th><th class="num">Số đôi (PL)</th>
              <th class="num">Số thùng (PL)</th><th class="num">Nhóm thùng</th><th class="num">Nhóm MIX</th>
              <th>Nguồn dữ liệu</th><th>Đối chiếu đơn đặt hàng</th>
            </tr></thead>
            <tbody>${bats.map(b => {
              const x = S.byBat[b];
              return `<tr>
                <td><b>${batTxt(b)}</b></td>
                <td class="num">${U.fmt(x.orders)}</td>
                <td class="num">${U.fmt(x.prs)}</td>
                <td class="num">${U.fmt(x.ctn)}</td>
                <td class="num">${U.fmt(x.groups)}</td>
                <td class="num">${U.fmt(x.mix)}</td>
                <td>${x.seed ? `<span class="bdg neu plain">${x.seed} gốc</span> ` : ""}${x.imported ? `<span class="bdg acc plain">${x.imported} import</span>` : ""}</td>
                <td>${x.diff ? `<span class="bdg warn">${x.diff} chỉ thị lệch</span>` : `<span class="bdg ok">khớp 100%</span>`}</td>
              </tr>`;
            }).join("")}</tbody>
            <tfoot><tr>
              <td>TỔNG ${bats.length} ĐỢT</td>
              <td class="num">${U.fmt(S.orders)}</td><td class="num">${U.fmt(S.prs)}</td>
              <td class="num">${U.fmt(S.ctn)}</td><td class="num">${U.fmt(S.groups)}</td>
              <td class="num">${U.fmt(S.mix)}</td><td></td><td></td>
            </tr></tfoot>
          </table></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Chi tiết packing list theo chỉ thị</h3>
            <span class="sub">bấm 1 dòng để xem toàn bộ nhóm thùng & đối chiếu size</span></div>
          <div class="tbl-wrap"><table class="tbl" data-testid="pk-detail-table">
            <thead><tr>
              <th>Chỉ thị</th><th>Đợt</th><th>Quốc gia</th><th>PO</th><th>Màu</th>
              <th class="num">Đôi (PL)</th><th class="num">Đôi (đặt)</th><th class="num">Thùng</th>
              <th class="num">Nhóm</th><th class="num">MIX</th><th>Nguồn</th><th>Đối chiếu</th><th>Thao tác</th>
            </tr></thead>
            <tbody>${view.length ? view.map(r => `
              <tr>
                <td class="clickable" onclick="Views._pkDetail('${r.ord}')"><b>${r.ord}</b></td>
                <td>${batTxt(r.bat)}</td>
                <td>${U.flag(r.p.ctry)} ${U.esc(r.p.ctry || "—")}</td>
                <td class="mono">${U.esc(r.p.po || "—")}</td>
                <td>${U.colorCell(r.p.col)}</td>
                <td class="num"><b>${U.fmt(r.prs)}</b></td>
                <td class="num">${r.ordPrs === null ? "—" : U.fmt(r.ordPrs)}</td>
                <td class="num">${U.fmt(r.ctn)}</td>
                <td class="num">${U.fmt(r.groups)}</td>
                <td class="num">${r.mix ? U.fmt(r.mix) : "—"}</td>
                <td>${srcBdg(r.src)}</td>
                <td>${matchBdg(r.match)}</td>
                <td style="white-space:nowrap">
                  <button class="btn small" onclick="Views._pkDetail('${r.ord}')">Xem</button>
                  <button class="btn small" onclick="Views._pkExport('${r.ord}')">CSV</button>
                  ${r.src === "import" ? `<button class="btn small danger need-edit" onclick="Views._pkDelete('${r.ord}')">${App.icon("trash", "ico")}</button>` : ""}
                </td>
              </tr>`).join("") : `<tr><td colspan="13" class="note" style="text-align:center;padding:30px">
                Không có chỉ thị nào khớp bộ lọc.</td></tr>`}
            </tbody>
            <tfoot><tr>
              <td colspan="5">TỔNG (${U.fmt(view.length)} chỉ thị)</td>
              <td class="num">${U.fmt(U.sum(view, r => r.prs))}</td>
              <td class="num">${U.fmt(U.sum(view, r => r.ordPrs || 0))}</td>
              <td class="num">${U.fmt(U.sum(view, r => r.ctn))}</td>
              <td class="num">${U.fmt(U.sum(view, r => r.groups))}</td>
              <td class="num">${U.fmt(U.sum(view, r => r.mix))}</td>
              <td colspan="3"></td>
            </tr></tfoot>
          </table></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Chỉ thị chưa có packing list (${U.fmt(noPk.length)})</h3>
            <span class="sub">hệ thống tạm tính thùng theo quy cách chuẩn ${TVS_META.packing} đôi/thùng — import packing để chính xác 100%</span></div>
          <div class="tbl-wrap"><table class="tbl" data-testid="pk-missing-table">
            <thead><tr><th>Chỉ thị</th><th>Đợt</th><th>Quốc gia</th><th>PO</th><th>Màu</th>
              <th class="num">SL đặt (đôi)</th><th class="num">Thùng (ROUNDUP)</th><th>Ngày xuất KD</th></tr></thead>
            <tbody>${noPk.length ? noPk.map(o => `
              <tr>
                <td class="clickable" onclick="Views._openOrder('${o.ord}')"><b>${o.ord}</b></td>
                <td>${batTxt(o.bat)}</td>
                <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
                <td class="mono">${U.esc(o.po)}</td>
                <td>${U.colorCell(o.col)}</td>
                <td class="num">${U.fmt(o.prs)}</td>
                <td class="num">${U.fmt(o.ctn)}</td>
                <td>${U.fmtDate(o.d)}</td>
              </tr>`).join("") : `<tr><td colspan="8" class="note" style="text-align:center;padding:26px">
                ✓ Toàn bộ ${U.fmt((U.ORDER_INDEX || []).length)} chỉ thị đều đã có packing list (CLP).</td></tr>`}
            </tbody>
          </table></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Nhật ký import packing list (${log.length})</h3>
            <span class="sub">ai import · lúc nào · file nào · lý do — đồng bộ GitHub cùng dữ liệu chung</span></div>
          <div class="tbl-wrap"><table class="tbl" data-testid="pk-log-table">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>File / sheet</th>
              <th class="num">Thêm mới</th><th class="num">Ghi đè</th><th class="num">Bỏ qua</th>
              <th class="num">Số đôi</th><th>Chỉ thị</th><th>Lý do</th></tr></thead>
            <tbody>${log.length ? log.map(l => `
              <tr>
                <td>${new Date(l.at).toLocaleString("vi-VN")}</td>
                <td><b>${U.esc(l.by || "?")}</b></td>
                <td class="note">${U.esc(l.file || "—")}${l.sheet ? ` <span class="bdg neu plain">${U.esc(l.sheet)}</span>` : ""}</td>
                <td class="num">${(l.added || []).length}</td>
                <td class="num">${(l.over || []).length}</td>
                <td class="num">${(l.skipped || []).length}</td>
                <td class="num">${U.fmt(l.prs || 0)}</td>
                <td class="note" style="max-width:240px;white-space:normal">${U.esc(
                  (l.deleted && l.deleted.length ? "🗑 " + l.deleted.join(", ") : [...(l.added || []), ...(l.over || [])].slice(0, 6).join(", ")) +
                  ([...(l.added || []), ...(l.over || [])].length > 6 ? "…" : ""))}</td>
                <td class="note" style="max-width:260px;white-space:normal">${U.esc(l.reason || "")}</td>
              </tr>`).join("") : `<tr><td colspan="9" class="note" style="text-align:center;padding:26px">
                Chưa có lần import nào. Packing list đợt 1–3 là dữ liệu gốc nhúng trong <code>assets/js/data-packing.js</code>.</td></tr>`}
            </tbody>
          </table></div>
        </div>`;

      document.getElementById("pkImp").onclick = openImport;
      document.getElementById("pkTplX").onclick = () => { Store.templatePackingXLSX(); App.toast("Đã tải file mẫu packing list (.xlsx)", "ok"); };
      document.getElementById("pkTplC").onclick = () => { Store.templatePackingCSV(); App.toast("Đã tải file mẫu packing list (.csv)", "ok"); };
      document.getElementById("pkExpX").onclick = () => {
        Store.exportPackingXLSX(view.map(r => r.ord), "PACKING_LIST_CLP_TVS.xlsx");
        App.toast(`Đã export packing list ${view.length} chỉ thị (.xlsx)`, "ok");
      };
      document.getElementById("pkExpC").onclick = () => {
        Store.exportPackingCSV(view.map(r => r.ord));
        App.toast(`Đã export packing list ${view.length} chỉ thị (.csv)`, "ok");
      };
      const clr = document.getElementById("pkClear");
      if (clr) clr.onclick = () => {
        const reason = prompt("Xoá TOÀN BỘ packing list đã import (đợt 1–3 gốc giữ nguyên).\nNhập lý do:", "");
        if (reason === null) return;
        const r = Store.clearImportedPacking(reason);
        App.toast(r.ok ? `Đã xoá packing import của ${r.n} chỉ thị` : "⚠ " + r.msg, r.ok ? "ok" : "warn");
      };
      document.getElementById("pkBat").onchange = e => { st.bat = e.target.value; this.render(root); };
      document.getElementById("pkSrc").onchange = e => { st.src = e.target.value; this.render(root); };
      const qi = document.getElementById("pkQ");
      qi.oninput = () => { clearTimeout(qi._t); qi._t = setTimeout(() => { st.q = qi.value; this.render(root); }, 260); };
    }
  };

  /* ═════════ CHI TIẾT PACKING 1 CHỈ THỊ ═════════ */
  window.Views._pkDetail = function (ord) {
    const p = Store.packingOf(ord);
    if (!p) { App.toast("Không tìm thấy packing list của " + ord, "warn"); return; }
    const o = U.orderByCode(ord), src = Store.packingSource(ord), meta = Store.packingMeta(ord);
    const sizes = {};
    p.groups.forEach(g => Object.entries(g.sizes).forEach(([sz, q]) => { sizes[sz] = (sizes[sz] || 0) + q; }));
    const allSz = U.SIZES.filter(sz => sizes[sz] || (o && o.sizes[sz]));

    App.openModal(`
      <div class="modal-h"><h3>Packing list · ${U.esc(ord)}</h3>
        ${srcBdg(src)} <span class="bdg neu plain">${batTxt(Store.packingBatch(ord))}</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">
          <div class="card kpi"><div class="k-lab"><span>Tổng số đôi</span></div>
            <div class="k-val">${U.fmt(p.totalPrs)}</div><div class="k-sub">đơn đặt: ${o ? U.fmt(o.prs) : "—"} đôi</div></div>
          <div class="card kpi"><div class="k-lab"><span>Tổng thùng</span></div>
            <div class="k-val">${U.fmt(p.totalCtn)}</div><div class="k-sub">${p.groups.length} nhóm thùng</div></div>
          <div class="card kpi"><div class="k-lab"><span>Nhóm MIX size</span></div>
            <div class="k-val">${U.fmt(p.groups.filter(g => g.mix).length)}</div><div class="k-sub">gộp nhiều size / thùng</div></div>
          <div class="card kpi"><div class="k-lab"><span>Quốc gia · PO</span></div>
            <div class="k-val" style="font-size:16px">${U.flag(p.ctry)} ${U.esc(p.ctry || "—")}</div>
            <div class="k-sub mono">${U.esc(p.po || "—")}</div></div>
        </div>

        <div class="note mt">Hình thể <b>${U.esc(p.col)}</b> ${U.colorVN(p.col) ? "· " + U.colorVN(p.col) : ""}
          · ${U.esc(p.name)} · ${U.esc(p.gender)} · Mã KH <b>${U.esc(p.cust || "—")}</b> · Mã nước–kho <b>${U.esc(p.wh || "—")}</b></div>

        <h4 style="margin:16px 0 8px;font-size:13.5px">Đối chiếu số đôi theo size — packing list ↔ đơn đặt hàng</h4>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Chỉ tiêu</th>${allSz.map(s => `<th class="num">${s}</th>`).join("")}<th class="num">Cộng</th></tr></thead>
          <tbody>
            <tr><td>Packing list (CLP)</td>${allSz.map(s => `<td class="num">${U.fmt(sizes[s] || 0)}</td>`).join("")}
              <td class="num"><b>${U.fmt(p.totalPrs)}</b></td></tr>
            <tr><td>SL đặt hàng (OMS)</td>${allSz.map(s => `<td class="num">${o && o.sizes[s] ? U.fmt(o.sizes[s].ordered) : "—"}</td>`).join("")}
              <td class="num"><b>${o ? U.fmt(o.prs) : "—"}</b></td></tr>
            <tr><td>Chênh lệch</td>${allSz.map(s => {
              const d = (sizes[s] || 0) - (o && o.sizes[s] ? o.sizes[s].ordered : 0);
              return `<td class="num ${d ? "neg" : ""}">${d ? (d > 0 ? "+" : "") + U.fmt(d) : "0"}</td>`;
            }).join("")}<td class="num ${o && o.prs !== p.totalPrs ? "neg" : ""}">${o ? U.fmt(p.totalPrs - o.prs) : "—"}</td></tr>
          </tbody>
        </table></div>

        <h4 style="margin:16px 0 8px;font-size:13.5px">Các nhóm thùng theo packing list (${p.groups.length} nhóm)</h4>
        <div class="tbl-wrap" style="max-height:44vh;overflow:auto"><table class="tbl">
          <thead><tr><th>#</th><th>Thùng số</th><th>Size / MIX</th><th class="num">Số đôi</th>
            <th class="num">Đôi/thùng</th><th class="num">Số thùng</th><th>Mã hộp</th></tr></thead>
          <tbody>${p.groups.map((g, i) => `
            <tr class="${g.mix ? "row-mix" : ""}">
              <td>${i + 1}</td>
              <td class="mono">${ctnTxt(g)}</td>
              <td>${g.mix ? `<b>MIX</b> <span class="mix-bd">${mixTxt(g)}</span>`
                : `<b>${Object.keys(g.sizes)[0]}</b>`}</td>
              <td class="num">${U.fmt(g.prs)}</td>
              <td class="num">${U.fmt(g.perCtn)}</td>
              <td class="num">${U.fmt(g.ctn)}</td>
              <td>${U.esc(g.box || "—")}</td>
            </tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="3">TỔNG</td><td class="num">${U.fmt(p.totalPrs)}</td><td></td>
            <td class="num">${U.fmt(p.totalCtn)}</td><td></td></tr></tfoot>
        </table></div>

        ${meta ? `<div class="alert warn mt"><div class="a-t">
          <b>Nguồn: import từ file</b> ${U.esc(meta.file || "")} ${meta.sheet ? `(sheet ${U.esc(meta.sheet)})` : ""}<br>
          Người import: <b>${U.esc(meta.by || "?")}</b> · ${new Date(meta.at).toLocaleString("vi-VN")}
          ${meta.over ? ` · <b>đã ghi đè</b> bản ${meta.prevSource === "seed" ? "gốc" : "import trước"}` : ""}<br>
          Lý do: ${U.esc(meta.reason || "—")}</div></div>`
        : `<div class="note mt">Nguồn: dữ liệu gốc nhúng trong <code>assets/js/data-packing.js</code> (packing list đợt 1–3 từ file khách adidas).</div>`}

        <div class="mt" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="Views._pkExport('${ord}')">${App.icon("download", "ico")} Export CSV chỉ thị này</button>
          <button class="btn" onclick="Views._openOrder('${ord}')">Xem đơn đặt hàng</button>
          ${src === "import" ? `<button class="btn danger need-edit" onclick="Views._pkDelete('${ord}')">${App.icon("trash", "ico")} Xoá packing import</button>` : ""}
          <button class="btn" onclick="App.closeModal()" style="margin-left:auto">Đóng</button>
        </div>
      </div>`, true);
  };

  window.Views._pkExport = function (ord) {
    Store.exportPackingCSV([ord], `PACKING_LIST_${ord}.csv`);
    App.toast(`Đã export packing list ${ord} (CSV)`, "ok");
  };

  window.Views._pkDelete = function (ord) {
    const reason = prompt(`Xoá packing list đã import của ${ord}?\nNhập lý do:`, "");
    if (reason === null) return;
    const r = Store.deletePacking(ord, reason);
    App.closeModal();
    App.toast(r.ok ? "✓ " + r.msg : "⚠ " + r.msg, r.ok ? "ok" : "warn");
  };

  /* ═════════ IMPORT PACKING LIST THEO MẪU ═════════ */
  function openImport() {
    if (!Store.guard()) return;
    App.pickDataFile(res => {
      const out = Store.importPackingCLP(res);
      imp = out;
      renderPreview();
    }, { allSheets: true });
  }
  window.Views._packingImport = openImport;

  function renderPreview() {
    const r = imp;
    const T = r.totals;
    const dupes = r.dupes || [];
    const news = r.preview.filter(p => !p.exists);

    let html = `<div class="modal-h"><h3>Xem trước packing list vừa đọc từ file</h3>
        <span class="bdg acc plain">${U.esc(r.file || "file")}${r.sheet ? " · sheet " + U.esc(r.sheet) : ""}</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">`;

    if (r.errs.length)
      html += `<div class="alert" style="margin-bottom:12px"><div class="a-t"><b>${r.errs.length} lỗi khi đọc file:</b><br>
        ${r.errs.slice(0, 12).map(U.esc).join("<br>")}${r.errs.length > 12 ? "<br>…" : ""}</div></div>`;

    if (!T.orders) {
      html += `<div class="note">Không đọc được chỉ thị nào. Hãy tải <b>File mẫu</b> để đối chiếu đúng cấu trúc cột
        (Mã chỉ thị · SIZE · Tổng số đôi · Số đôi/thùng · Số thùng · Số thùng từ → đến · Mã hộp).</div>
        <div class="mt"><button class="btn" onclick="App.closeModal()">Đóng</button></div></div>`;
      App.openModal(html, true);
      return;
    }

    html += `<div class="grid" style="grid-template-columns:repeat(5,1fr);gap:12px">
        <div class="card kpi"><div class="k-lab"><span>Chỉ thị đọc được</span></div>
          <div class="k-val">${U.fmt(T.orders)}</div><div class="k-sub">${news.length} mới · ${dupes.length} đã có</div></div>
        <div class="card kpi"><div class="k-lab"><span>Tổng số đôi</span></div>
          <div class="k-val">${U.fmt(T.prs)}</div><div class="k-sub">theo packing list</div></div>
        <div class="card kpi"><div class="k-lab"><span>Tổng thùng</span></div>
          <div class="k-val">${U.fmt(T.ctn)}</div><div class="k-sub">${U.fmt(T.groups)} nhóm thùng</div></div>
        <div class="card kpi"><div class="k-lab"><span>Nhóm MIX size</span></div>
          <div class="k-val">${U.fmt(T.mix)}</div><div class="k-sub">gộp nhiều size / thùng</div></div>
        <div class="card kpi"><div class="k-lab"><span>Đối chiếu đơn hàng</span></div>
          <div class="k-val" style="color:${r.preview.some(p => p.match !== "ok") ? "var(--warn)" : "var(--ok)"}">
            ${r.preview.filter(p => p.match === "ok").length}/${T.orders}</div>
          <div class="k-sub">chỉ thị khớp 100% SL đặt</div></div>
      </div>`;

    if (r.warns.length)
      html += `<div class="alert warn mt"><div class="a-t"><b>${r.warns.length} cảnh báo — kiểm tra trước khi lưu:</b><br>
        ${r.warns.slice(0, 10).map(U.esc).join("<br>")}${r.warns.length > 10 ? "<br>…" : ""}</div></div>`;

    html += `<h4 style="margin:16px 0 8px;font-size:13.5px">Chi tiết mapping từng chỉ thị</h4>
      <div class="tbl-wrap" style="max-height:38vh;overflow:auto"><table class="tbl" data-testid="pk-preview-table">
        <thead><tr><th>Chỉ thị</th><th>Đợt</th><th>Quốc gia</th><th>PO</th><th>Màu</th>
          <th class="num">Đôi (PL)</th><th class="num">Đôi (đặt)</th><th class="num">Thùng</th>
          <th class="num">Nhóm</th><th class="num">MIX</th><th>Đối chiếu</th><th>Trạng thái</th></tr></thead>
        <tbody>${r.preview.map(p => `
          <tr>
            <td><b>${p.ord}</b></td>
            <td>${batTxt(p.bat)}</td>
            <td>${U.flag(p.ctry)} ${U.esc(p.ctry || "—")}</td>
            <td class="mono">${U.esc(p.po || "—")}</td>
            <td>${U.colorCell(p.col)}</td>
            <td class="num"><b>${U.fmt(p.prs)}</b></td>
            <td class="num">${p.ordPrs === null ? "—" : U.fmt(p.ordPrs)}</td>
            <td class="num">${U.fmt(p.ctn)}</td>
            <td class="num">${U.fmt(p.groups)}</td>
            <td class="num">${p.mix ? U.fmt(p.mix) : "—"}</td>
            <td>${matchBdg(p.match)}</td>
            <td>${p.exists
              ? `<span class="bdg warn">đã có (${p.exists === "seed" ? "gốc" : "import"}) — cần tích ghi đè</span>`
              : `<span class="bdg ok">thêm mới</span>`}</td>
          </tr>`).join("")}</tbody>
      </table></div>`;

    if (dupes.length) {
      html += `<h4 style="margin:16px 0 8px;font-size:13.5px">⚠ ${dupes.length} chỉ thị đã có packing list — chọn chỉ thị muốn GHI ĐÈ</h4>
        <div class="note" style="margin-bottom:8px">Hãy kiểm tra số đôi / số thùng ở bảng trên rồi tự tích chọn. Không tích = giữ nguyên dữ liệu cũ.</div>
        <div class="chk-list" data-testid="pk-overwrite-list">
          <label class="chkline chk-head" style="cursor:pointer">
            <input type="checkbox" id="pkOwAll" data-testid="pk-ow-all">
            <span style="flex:1">Chọn tất cả — ghi đè ${dupes.length} chỉ thị</span>
            <span class="num-col">cũ → mới (đôi)</span></label>
          ${dupes.map(ord => {
            const cur = Store.packingOf(ord), nw = r.packing[ord];
            const chg = cur && (cur.totalPrs !== nw.totalPrs || cur.totalCtn !== nw.totalCtn);
            return `<label class="chkline">
              <input type="checkbox" class="pkOw" value="${ord}" data-testid="pk-ow-${ord}">
              <span style="flex:1"><b>${ord}</b> <span class="note">${Store.packingSource(ord) === "seed" ? "dữ liệu gốc" : "bản import trước"}
                ${chg ? `· <b style="color:var(--warn)">số liệu thay đổi</b>` : "· số liệu không đổi"}</span></span>
              <span class="num-col">${cur ? U.fmt(cur.totalPrs) : "—"} → ${U.fmt(nw.totalPrs)}</span>
              <span class="num-col">${cur ? U.fmt(cur.totalCtn) : "—"} → ${U.fmt(nw.totalCtn)} thùng</span></label>`;
          }).join("")}
        </div>`;
    }

    html += `<div class="frm mt" style="display:flex;flex-direction:column;gap:6px">
        <label>Lý do / ghi chú cho lần import này <span class="note">(bắt buộc — lưu vào nhật ký & đồng bộ GitHub)</span>
          <input id="pkReason" data-testid="pk-reason" placeholder="VD: Nhận packing list đợt 4 từ khách adidas ngày ${U.fmtDate(new Date().toISOString().slice(0, 10))}"></label>
      </div>
      <div class="mt" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn primary" id="pkApply" data-testid="pk-apply">Lưu packing list — thêm mới ${news.length} chỉ thị</button>
        <button class="btn" onclick="App.closeModal()">Huỷ</button>
        <span class="note" style="margin-left:auto">Dữ liệu lưu vào máy + tự commit <code>data/tvs-data.json</code> lên GitHub (nếu có token)</span>
      </div></div>`;

    App.openModal(html, true);

    const owBoxes = () => [...document.querySelectorAll(".pkOw")];
    const btn = document.getElementById("pkApply");
    const relabel = () => {
      const n = owBoxes().filter(b => b.checked).length;
      btn.textContent = `Lưu packing list — thêm mới ${news.length} chỉ thị${n ? ` + ghi đè ${n} chỉ thị` : ""}`;
      btn.disabled = (news.length + n) === 0;
    };
    const all = document.getElementById("pkOwAll");
    if (all) all.onchange = () => { owBoxes().forEach(b => { b.checked = all.checked; }); relabel(); };
    owBoxes().forEach(b => { b.onchange = relabel; });
    relabel();

    btn.onclick = () => {
      const reason = (document.getElementById("pkReason").value || "").trim();
      const overwrite = owBoxes().filter(b => b.checked).map(b => b.value);
      const res = Store.applyPacking(imp, { reason, overwrite });
      if (!res.ok) { App.toast("⚠ " + res.msg, "warn"); return; }
      App.closeModal();
      App.toast(`✓ Đã lưu packing list: <b>${res.added.length}</b> chỉ thị mới${res.over.length ? ` · <b>${res.over.length}</b> ghi đè` : ""}${res.skipped.length ? ` · ${res.skipped.length} bỏ qua` : ""}`, "ok");
      if (location.hash.replace(/^#\/?/, "").split("?")[0] !== "packing") location.hash = "#/packing";
    };
  }
})();
