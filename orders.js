/* ═══════════════════════════════════════════════════════════════════
   views/orders.js — OMS · ĐƠN ĐẶT HÀNG KHÁCH HÀNG (sheet Data)
   549 dòng chi tiết / 95 đơn hàng thật — lọc, tìm kiếm, xem ma trận size
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const st = { q: "", ctry: "", col: "", bat: "", d: "", mode: "orders", page: 1, per: 60,
               editRow: null };   /* editRow = "MÃ ĐƠN|UK 5" → dòng đang sửa nhanh tại chỗ */

  function statusBdg(o) {
    if (o.status === "full") return `<span class="bdg ok">đủ hàng</span>`;
    if (o.status === "partial") return `<span class="bdg warn">đang SX · thiếu ${U.fmt(o.short)}</span>`;
    return `<span class="bdg neu">chưa nhập kho</span>`;
  }
  /* Nhãn “đã sửa n lần” cho đơn có chỉnh sửa */
  function editBdg(ord) {
    const e = Store.orderEditInfo(ord);
    if (!e) return "";
    return Store.isOrderOverridden(ord)
      ? `<span class="bdg acc plain" title="Đơn đang khác dữ liệu gốc — bấm ⟲ để xem nhật ký">đã sửa ${e.rev}×</span>`
      : `<span class="bdg neu plain" title="Đơn đã được khôi phục về đúng dữ liệu gốc — vẫn giữ nhật ký">đã khôi phục gốc</span>`;
  }

  function applyFilterRows() {
    const q = st.q.trim().toLowerCase();
    return TVS_ORDERS.filter(r =>
      (!q || r.ord.toLowerCase().includes(q) || r.po.toLowerCase().includes(q) || r.ctry.toLowerCase().includes(q)) &&
      (!st.ctry || r.ctry === st.ctry) && (!st.col || r.col === st.col) &&
      (!st.bat || String(r.bat) === st.bat) && (!st.d || r.d === st.d));
  }
  function applyFilterOrders() {
    const q = st.q.trim().toLowerCase();
    return U.ORDER_INDEX.filter(o =>
      (!q || o.ord.toLowerCase().includes(q) || o.po.toLowerCase().includes(q) || o.ctry.toLowerCase().includes(q)) &&
      (!st.ctry || o.ctry === st.ctry) && (!st.col || o.col.includes(st.col)) &&
      (!st.bat || String(o.bat) === st.bat) && (!st.d || o.d === st.d));
  }

  /* ── Modal chi tiết 1 đơn hàng ── */
  function openOrder(code) {
    const o = U.orderByCode(code);
    if (!o) return;
    const cells = U.SIZES.filter(s => o.sizes[s]).map(s => {
      const c = o.sizes[s];
      const cls = c.received >= c.ordered && c.received > 0 ? "full" : (c.received > 0 || 0 > 0 ? "short" : "");
      return `<div class="sm-cell ${o.recvPrs > 0 ? (c.received >= c.ordered ? "full" : "short") : ""}">
        <div class="s">${s}</div><div class="v">${U.fmt(c.ordered)}</div>
        <div class="m">${o.recvPrs > 0 ? "nhập " + U.fmt(c.received) : U.fmt(c.ctn) + " thùng"}</div></div>`;
    }).join("");

    App.openModal(`
      <div class="modal-h">
        <h3>${U.flag(o.ctry)} Đơn hàng ${o.ord}</h3>
        ${statusBdg(o)} ${editBdg(o.ord)}
        <button class="modal-x" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-b">
        <div class="grid g-3">
          <div><div class="note">Quốc gia</div><b>${U.esc(o.ctry)} (${U.VN_COUNTRY[o.ctry] || ""})</b></div>
          <div><div class="note">PO khách hàng</div><b class="mono">${U.esc(o.po)}</b></div>
          <div><div class="note">Mã màu</div><b>${U.colorCell(o.col)}</b></div>
          <div><div class="note">Ngày xuất KD</div><b>${U.fmtDate(o.d)}</b> <span class="note">(${o.daysLeft >= 0 ? "còn " + o.daysLeft + " ngày" : "đã qua " + (-o.daysLeft) + " ngày"})</span></div>
          <div><div class="note">Đợt đặt hàng</div><b>Đợt ${o.bat}</b></div>
          <div><div class="note">Tổng đặt</div><b>${U.fmt(o.prs)} đôi · ${U.fmt(o.ctn)} thùng</b></div>
        </div>
        <h4 style="margin:16px 0 8px;font-size:13px">Ma trận size (đặt hàng${o.recvPrs > 0 ? " / đã nhập kho" : ""})</h4>
        <div class="size-matrix">${cells}</div>
        ${o.recvPrs > 0 ? `
          <div class="mt" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <span class="bdg acc plain">Đã nhập ${U.fmt(o.recvPrs)}/${U.fmt(o.prs)} đôi · ${U.fmt(o.recvCtn)} thùng</span>
            <span class="bdg neu plain">Ngày nhập: ${o.recvDates.join(" · ")}</span>
            ${o.notes.length ? `<span class="bdg bad plain">Chưa sản xuất: ${o.notes.map(U.esc).join("; ")}</span>` : ""}
          </div>
          <div class="note mt">→ Xem dòng nhập kho tại mục <a href="#/warehouse" onclick="App.closeModal()">Nhập kho (ChitietNK)</a>.</div>`
        : `<div class="note mt">Đơn chưa có thành phẩm nhập kho — nguồn: sheet Data (đơn đặt hàng gốc).</div>`}
        <div class="mt" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px">
          <button class="btn primary need-edit" onclick="Views._ordEdit('${o.ord}')">${App.icon("clip", "ico")} Sửa đơn hàng</button>
          <button class="btn need-edit" onclick="Views._ordHistory('${o.ord}')">⟲ Nhật ký chỉnh sửa</button>
          <button class="btn danger need-edit" style="margin-left:auto" onclick="Views._ordDelete('${o.ord}')">${App.icon("trash", "ico")} Xoá đơn</button>
        </div>
      </div>`);
  }
  window.Views._openOrder = openOrder;

  window.Views.orders = {
    title: "Đơn đặt hàng · OMS",
    render(root, params) {
      if (params.q !== undefined) { st.q = params.q; }
      const ctries = U.uniq(TVS_ORDERS, r => r.ctry).sort();
      const cols = U.uniq(TVS_ORDERS, r => r.col).sort();
      const dates = U.uniq(TVS_ORDERS, r => r.d).sort();
      const edN = Store.orderEditCount();          /* đơn đang khác gốc */
      const edLog = Store.orderEditLogCount();     /* đơn có nhật ký (kể cả đã khôi phục) */
      st.editRow = null;

      root.innerHTML = `
        <div class="card">
          <div class="filters" style="background:#fafbfc">
            <button class="btn primary need-edit" id="oAdd">${App.icon("plus", "ico")} Thêm đơn hàng</button>
            <button class="btn" id="oTpl">${App.icon("download", "ico")} File mẫu (size hàng ngang)</button>
            <button class="btn need-edit" id="oImp">${App.icon("upload", "ico")} Import từ file</button>
            <button class="btn" id="oExp">${App.icon("download", "ico")} Export dữ liệu (CSV)</button>
            <span class="f-chipcount">Import file <b>size hàng ngang</b> (1 dòng = 1 đơn, cột UK 3→UK 9) — hệ thống tự chuyển sang dạng hàng dọc ·
              <a id="oTplLong" style="cursor:pointer;color:var(--acc);font-weight:700">mẫu dạng dọc</a></span>
          </div>
          <div class="filters" style="gap:10px">
            <span class="bdg ${edN ? "acc" : "neu"} plain">${edN
              ? `Đang có ${edN} đơn khác dữ liệu gốc`
              : (edLog ? `Tất cả đơn đúng dữ liệu gốc (${edLog} đơn có nhật ký sửa)` : "Chưa chỉnh sửa đơn nào")}</span>
            <span class="note">Sửa được <b>mọi đơn</b> (kể cả đơn Excel gốc) ngay trên bảng — bấm
              <b>${App.icon("clip", "ico")} Sửa</b> ở cột Thao tác, hoặc bấm <b>✎</b> ở chế độ
              <b>Chi tiết từng dòng size</b> để sửa nhanh số đôi tại chỗ. Mọi thay đổi đều ghi nhật ký người sửa &amp; lý do.</span>
            ${edLog ? `<button class="btn small need-edit" id="oRestoreAll" style="margin-left:auto">↺ Khôi phục toàn bộ đơn về gốc${edN ? "" : " (xoá nhật ký)"}</button>` : ""}
          </div>
          <div class="filters">
            <input class="f-input" id="fQ" placeholder="Tìm mã đơn / PO / quốc gia…" value="${U.esc(st.q)}">
            <select class="f-select" id="fCtry"><option value="">Tất cả quốc gia</option>
              ${ctries.map(c => `<option ${st.ctry === c ? "selected" : ""} value="${c}">${U.flag(c)} ${c}</option>`).join("")}</select>
            <select class="f-select" id="fCol"><option value="">Tất cả màu</option>
              ${cols.map(c => `<option ${st.col === c ? "selected" : ""}>${c}</option>`).join("")}</select>
            <select class="f-select" id="fBat"><option value="">Tất cả đợt</option>
              ${[1, 2, 3].map(b => `<option ${st.bat == b ? "selected" : ""} value="${b}">Đợt ${b}</option>`).join("")}</select>
            <select class="f-select" id="fD"><option value="">Mọi ngày xuất KD</option>
              ${dates.map(d => `<option ${st.d === d ? "selected" : ""} value="${d}">${U.fmtDate(d)}</option>`).join("")}</select>
            <button class="btn" id="fReset">Xoá lọc</button>
            <span class="f-chipcount" id="fCount"></span>
          </div>
          <div style="padding:12px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div class="seg">
              <button id="mOrders" class="${st.mode === "orders" ? "on" : ""}">Theo đơn hàng</button>
              <button id="mRows" class="${st.mode === "rows" ? "on" : ""}">Chi tiết từng dòng size</button>
            </div>
            <span class="note">Nguồn: sheet <b>Data — DATA ĐƠN ĐẶT HÀNG GỐC</b> · ${U.fmt(TVS_ORDERS.length)} dòng · ${U.fmt(U.ORDER_INDEX.length)} đơn · ${U.fmt(TVS_META.totalPairs)} đôi</span>
          </div>
          <div id="tblArea"></div>
        </div>`;

      const rerender = () => renderTable(document.getElementById("tblArea"));
      const bind = (id, ev, f) => document.getElementById(id).addEventListener(ev, f);
      bind("fQ", "input", e => { st.q = e.target.value; st.page = 1; rerender(); });
      bind("fCtry", "change", e => { st.ctry = e.target.value; st.page = 1; rerender(); });
      bind("fCol", "change", e => { st.col = e.target.value; st.page = 1; rerender(); });
      bind("fBat", "change", e => { st.bat = e.target.value; st.page = 1; rerender(); });
      bind("fD", "change", e => { st.d = e.target.value; st.page = 1; rerender(); });
      bind("fReset", "click", () => { Object.assign(st, { q: "", ctry: "", col: "", bat: "", d: "", page: 1 });
        this.render(root, {}); });
      bind("mOrders", "click", () => { st.mode = "orders"; this.render(root, {}); });
      bind("mRows", "click", () => { st.mode = "rows"; st.page = 1; this.render(root, {}); });
      bind("oAdd", "click", openAddOrder);
      bind("oTpl", "click", () => { Store.templateOrders(); App.toast("Đã tải file mẫu <b>size hàng ngang</b> — 1 dòng = 1 đơn, điền số đôi vào cột UK 3…UK 9 rồi Import", "ok"); });
      const tl = document.getElementById("oTplLong");
      if (tl) tl.onclick = () => { Store.templateOrdersLong(); App.toast("Đã tải file mẫu dạng size hàng dọc (1 dòng = 1 size)", "ok"); };
      bind("oImp", "click", importOrders);
      const ra = document.getElementById("oRestoreAll");
      if (ra) ra.onclick = () => {
        if (!confirm(`Khôi phục TOÀN BỘ đơn hàng về đúng dữ liệu gốc?\n\n• ${edN} đơn đang khác gốc sẽ được hoàn tác (số lượng / thông tin / đơn đã xoá)\n• Nhật ký chỉnh sửa của ${edLog} đơn sẽ bị xoá sạch`)) return;
        const r = Store.restoreAllOrders();
        if (!r.ok) { App.toast("⚠ " + r.msg, "warn"); return; }
        App.toast(`✓ Đã khôi phục toàn bộ đơn hàng về dữ liệu gốc (${r.n} đơn có chỉnh sửa)`, "ok");
      };
      bind("oExp", "click", () => {
        const rows = applyFilterRows();
        Store.downloadCSV("DON_DAT_HANG_TVS.csv", [
          ["Ngày xuất KD", "Quốc gia", "Đơn hàng", "PO", "Màu", "Size", "Số đôi", "Số thùng", "Đợt đặt hàng"],
          ...rows.map(r => [U.fmtDate(r.d), r.ctry, r.ord, r.po, r.col, r.sz, r.prs, r.ctn, r.bat])]);
        App.toast(`Đã export ${U.fmt(rows.length)} dòng đơn hàng (CSV)`, "ok");
      });
      rerender();
    }
  };

  /* ── NHẬP LIỆU: thêm đơn hàng mới (ma trận size) ── */
  function openAddOrder() {
    const ctries = U.uniq(TVS_ORDERS, r => r.ctry).sort();
    App.openModal(`
      <div class="modal-h"><h3>${App.icon("plus", "ico")} Thêm đơn đặt hàng mới</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="frm grid g-3" style="gap:10px">
          <label>Mã đơn hàng / chỉ thị *<input id="aOrd" placeholder="AE27xxxxx" style="text-transform:uppercase"></label>
          <label>PO khách hàng<input id="aPo" placeholder="09030xxxxx-1"></label>
          <label>Ngày xuất KD *<input id="aD" type="date" value="${TVS_META.today}"></label>
          <label>Quốc gia *<input id="aCtry" list="ctryList" placeholder="JAPAN…" style="text-transform:uppercase">
            <datalist id="ctryList">${ctries.map(c => `<option value="${c}">`).join("")}</datalist></label>
          <label>Mã màu *<select id="aCol">${Object.keys(U.COLOR_HEX).map(c => `<option>${c}</option>`).join("")}</select></label>
          <label>Đợt đặt hàng<select id="aBat"><option>1</option><option>2</option><option selected>3</option></select></label>
        </div>
        <h4 style="margin:14px 0 8px;font-size:13px">Số đôi theo size <span class="note">(bỏ trống size không đặt · thùng = ROUNDUP(đôi ÷ 6))</span></h4>
        <div class="size-matrix">
          ${U.SIZES.map(s => `<div class="sm-cell"><div class="s">${s}</div>
            <input class="cell-in c" type="number" min="0" placeholder="0" data-sz="${s}" style="width:100%;text-align:center;font-weight:800;font-size:15px">
            <div class="m sm-ctn" data-sz="${s}">0 thùng</div></div>`).join("")}
        </div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn primary" id="aSave">Lưu đơn hàng</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          <span class="note" id="aSum" style="margin-left:auto"></span>
        </div>
        <div class="note mt" id="aErr"></div>
      </div>`, true);

    const inputs = [...document.querySelectorAll(".size-matrix input[data-sz]")];
    const recalc = () => {
      let p = 0, c = 0;
      inputs.forEach(i => {
        const q = parseInt(i.value || "0", 10) || 0;
        const ct = q ? Math.ceil(q / TVS_META.packing) : 0;
        i.closest(".sm-cell").querySelector(".sm-ctn").textContent = ct + " thùng";
        p += q; c += ct;
      });
      document.getElementById("aSum").innerHTML = `Tổng: <b>${U.fmt(p)} đôi</b> = <b>${U.fmt(c)} thùng</b>`;
    };
    inputs.forEach(i => i.addEventListener("input", recalc)); recalc();

    document.getElementById("aSave").onclick = () => {
      const err = document.getElementById("aErr");
      const ord = document.getElementById("aOrd").value.trim().toUpperCase();
      const ctry = document.getElementById("aCtry").value.trim().toUpperCase();
      const d = document.getElementById("aD").value;
      const po = document.getElementById("aPo").value.trim();
      const col = document.getElementById("aCol").value;
      const bat = +document.getElementById("aBat").value;
      const bad = m => { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${m}</span>`; };
      if (!ord) return bad("Nhập mã đơn hàng");
      if (!ctry) return bad("Nhập quốc gia");
      if (!d) return bad("Chọn ngày xuất KD");
      const rows = [];
      for (const i of inputs) {
        const q = parseInt(i.value || "0", 10) || 0;
        if (q <= 0) continue;
        const sz = i.dataset.sz;
        if (TVS_ORDERS.some(r => r.ord === ord && r.sz === sz)) return bad(`${ord} đã có size ${sz} trong hệ thống`);
        rows.push({ d, ctry, ord, po, col, sz, prs: q, ctn: Math.ceil(q / TVS_META.packing), bat });
      }
      if (!rows.length) return bad("Nhập số đôi cho ít nhất 1 size");
      Store.addOrders(rows, "manual");
      App.closeModal();
      App.toast(`✓ Đã thêm đơn <b>${ord}</b>: ${U.fmt(U.sum(rows, r => r.prs))} đôi / ${rows.length} size`, "ok");
    };
  }

  /* ── IMPORT đơn hàng: nhận .xlsx/.csv, tự nhận dạng SIZE HÀNG NGANG hay HÀNG DỌC ──
     Dạng ngang (1 dòng = 1 đơn, cột UK 3…UK 9) sẽ được tự chuyển sang dạng dọc. */
  function importOrders() {
    App.pickDataFile(({ rows: fileRows, name, kind }) => {
      const { rows, errs, pivot, warns, format } = Store.importOrdersAuto(fileRows);
      const wide = format === "wide";
      let html = `<div class="modal-h"><h3>Import đơn đặt hàng — ${U.esc(name)}</h3>
        <span class="bdg acc plain">${kind === "xlsx" ? "Excel .xlsx" : "CSV"} · ${wide ? "size HÀNG NGANG → tự chuyển dọc" : "size hàng dọc"}</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div><div class="modal-b">`;
      if (errs.length) html += `<div class="alert" style="margin-bottom:12px"><div class="a-t"><b>${errs.length} dòng lỗi (bị bỏ qua):</b><br>${errs.slice(0, 12).map(U.esc).join("<br>")}${errs.length > 12 ? "<br>…" : ""}</div></div>`;
      if (warns && warns.length) html += `<div class="alert warn" style="margin-bottom:12px"><div class="a-t"><b>Lưu ý:</b><br>${[...new Set(warns)].slice(0, 8).map(U.esc).join("<br>")}</div></div>`;
      if (!rows.length) { html += `<div class="note">Không có dòng hợp lệ. Bấm “File mẫu (size hàng ngang)” để xem đúng định dạng.</div></div>`; App.openModal(html, true); return; }

      /* ① Bảng đọc được từ file — đúng dạng ngang như người dùng nhập */
      if (wide && pivot.length) {
        html += `<h4 style="font-size:13px;margin-bottom:6px">① File đọc được — <b>size hàng ngang</b> (${pivot.length} đơn):</h4>
        <div class="tbl-wrap" style="max-height:24vh;overflow:auto;margin-bottom:14px"><table class="tbl">
          <thead><tr><th>Ngày xuất KD</th><th>Quốc gia</th><th>Đơn hàng</th><th>PO</th><th>Màu</th><th>Tên màu</th><th>Đợt</th>
            ${U.SIZES.map(s => `<th class="num">${s.replace("UK ", "")}</th>`).join("")}<th class="num">Tổng đôi</th></tr></thead>
          <tbody>${pivot.map(p => `<tr><td>${p.dLabel}</td><td>${U.flag(p.ctry)} ${U.esc(p.ctry)}</td><td><b>${p.ord}</b></td>
            <td class="mono">${U.esc(p.po)}</td><td>${p.col}</td><td class="note">${U.esc(p.colVN || U.colorVN(p.col) || "—")}</td><td>Đợt ${p.bat}</td>
            ${U.SIZES.map(s => `<td class="num">${p.sizes[s] ? U.fmt(p.sizes[s]) : ""}</td>`).join("")}
            <td class="num"><b>${U.fmt(p.total)}</b></td></tr>`).join("")}</tbody></table></div>`;
      }

      /* ② Sau khi tự chuyển sang dạng dọc */
      html += `<h4 style="font-size:13px;margin-bottom:6px">${wide ? "② Sau khi tự chuyển sang <b>size hàng dọc</b>" : "Dữ liệu đọc được"}
        (${rows.length} dòng · ${U.fmt(U.sum(rows, r => r.prs))} đôi · ${U.uniq(rows, r => r.ord).length} đơn):</h4>
        <div class="tbl-wrap" style="max-height:30vh;overflow:auto"><table class="tbl">
        <thead><tr><th>Ngày XKD</th><th>Quốc gia</th><th>Đơn</th><th>PO</th><th>Màu</th><th>Tên màu</th><th>Size</th><th class="num">Đôi</th><th class="num">Thùng</th><th>Đợt</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${U.fmtDate(r.d)}</td><td>${U.esc(r.ctry)}</td><td><b>${r.ord}</b></td><td class="mono">${U.esc(r.po)}</td>
          <td>${r.col}</td><td class="note">${U.esc(U.colorVN(r.col) || "—")}</td><td><b>${r.sz}</b></td>
          <td class="num">${U.fmt(r.prs)}</td><td class="num">${r.ctn}</td><td>Đợt ${r.bat}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="7">TỔNG</td><td class="num">${U.fmt(U.sum(rows, r => r.prs))}</td><td class="num">${U.fmt(U.sum(rows, r => r.ctn))}</td><td></td></tr></tfoot>
        </table></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="oiApply">✓ Nhập ${rows.length} dòng vào hệ thống</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div></div>`;
      App.openModal(html, true);
      document.getElementById("oiApply").onclick = () => {
        Store.addOrders(rows, "import");
        App.closeModal();
        App.toast(`✓ Đã import ${U.uniq(rows, r => r.ord).length} đơn = ${rows.length} dòng size${wide ? " (tự chuyển từ hàng ngang sang hàng dọc)" : ""}`, "ok");
      };
    });
  }

  function renderTable(area) {
    if (st.mode === "orders") {
      const list = applyFilterOrders();
      document.getElementById("fCount").textContent =
        `${U.fmt(list.length)} đơn · ${U.fmt(U.sum(list, o => o.prs))} đôi · ${U.fmt(U.sum(list, o => o.ctn))} thùng`;
      area.innerHTML = `<div class="tbl-wrap"><table class="tbl">
        <thead><tr>
          <th>Mã đơn</th><th>Quốc gia</th><th>PO</th><th>Màu</th><th>Tên màu</th><th>Size</th>
          <th class="num">Số đôi</th><th class="num">Số thùng</th>
          <th>Ngày xuất KD</th><th>Đợt</th><th class="num">Đã nhập</th><th>Trạng thái</th>
          <th class="need-edit">Thao tác</th>
        </tr></thead>
        <tbody>${list.map(o => `
          <tr class="clickable" onclick="Views._openOrder('${o.ord}')">
            <td><b>${o.ord}</b> ${editBdg(o.ord)}</td>
            <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
            <td class="mono">${U.esc(o.po)}</td>
            <td><span class="color-dot" style="background:${U.colorHex(o.col.split(",")[0].trim())}"></span>${U.esc(o.col)}</td>
            <td class="note">${U.esc(U.colorVN(o.col.split(",")[0].trim()) || "—")}</td>
            <td class="note">${U.SIZES.filter(s => o.sizes[s]).length} size</td>
            <td class="num">${U.fmt(o.prs)}</td><td class="num">${U.fmt(o.ctn)}</td>
            <td>${U.fmtDate(o.d)}</td><td>Đợt ${o.bat}</td>
            <td class="num">${o.recvPrs ? U.fmt(o.recvPrs) : "—"}</td>
            <td>${statusBdg(o)}</td>
            <td class="act-cell need-edit" onclick="event.stopPropagation()">
              <button class="btn small primary need-edit" title="Sửa đơn hàng này ngay tại đây"
                onclick="Views._ordEdit('${o.ord}')">${App.icon("clip", "ico")} Sửa</button>
              ${Store.orderEditInfo(o.ord)
                ? `<button class="btn small need-edit" title="Xem nhật ký chỉnh sửa" onclick="Views._ordHistory('${o.ord}')">⟲</button>` : ""}
              <button class="btn small danger need-edit" title="Xoá đơn hàng này"
                onclick="Views._ordDelete('${o.ord}')">✕</button>
            </td>
          </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="6">TỔNG (${U.fmt(list.length)} đơn)</td>
          <td class="num">${U.fmt(U.sum(list, o => o.prs))}</td>
          <td class="num">${U.fmt(U.sum(list, o => o.ctn))}</td><td colspan="2"></td>
          <td class="num">${U.fmt(U.sum(list, o => o.recvPrs))}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
      <div class="note" style="padding:10px 18px">Bấm vào từng dòng để xem ma trận size &amp; đối chiếu nhập kho · cột
        <b>Thao tác</b> để sửa / xoá / xem nhật ký ngay tại màn hình này (chỉ hiện với tài khoản nhập liệu).</div>`;
    } else {
      const rows = applyFilterRows();
      document.getElementById("fCount").textContent =
        `${U.fmt(rows.length)} dòng · ${U.fmt(U.sum(rows, r => r.prs))} đôi · ${U.fmt(U.sum(rows, r => r.ctn))} thùng`;
      const pages = Math.max(1, Math.ceil(rows.length / st.per));
      st.page = Math.min(st.page, pages);
      const view = rows.slice((st.page - 1) * st.per, st.page * st.per);
      area.innerHTML = `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Ngày xuất KD</th><th>Quốc gia</th><th>Đơn hàng</th><th>PO</th>
          <th>Màu</th><th>Size</th><th class="num">Số đôi</th><th class="num">Số thùng</th><th>Đợt</th><th>Nguồn</th>
          <th class="need-edit">Sửa nhanh</th></tr></thead>
        <tbody>${view.map((r, i) => {
          const key = r.ord + "|" + r.sz;
          const editing = st.editRow === key;
          if (editing) return `
          <tr class="row-editing">
            <td class="note">${(st.page - 1) * st.per + i + 1}</td>
            <td>${U.fmtDate(r.d)}</td>
            <td>${U.flag(r.ctry)} ${U.esc(r.ctry)}</td>
            <td><b>${r.ord}</b></td><td class="mono">${U.esc(r.po)}</td>
            <td>${U.colorCell(r.col)}</td>
            <td><b>${r.sz}</b></td>
            <td class="num"><input class="cell-in" id="qeQty" type="number" min="0" value="${r.prs}" style="width:86px"></td>
            <td class="num note" id="qeCtn">${U.fmt(r.ctn)}</td>
            <td>Đợt ${r.bat}</td>
            <td colspan="2">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input class="cell-in note-in" id="qeReason" placeholder="Lý do sửa *" style="width:190px">
                <button class="btn small primary" id="qeSave">✓ Lưu</button>
                <button class="btn small" id="qeCancel">✕ Huỷ</button>
                <span class="note" id="qeErr"></span>
              </div>
            </td>
          </tr>`;
          return `
          <tr class="clickable" onclick="Views._openOrder('${r.ord}')">
            <td class="note">${(st.page - 1) * st.per + i + 1}</td>
            <td>${U.fmtDate(r.d)}</td>
            <td>${U.flag(r.ctry)} ${U.esc(r.ctry)}</td>
            <td><b>${r.ord}</b> ${r._edited ? `<span class="bdg acc plain" title="Dòng đã được chỉnh sửa">đã sửa</span>` : ""}</td>
            <td class="mono">${U.esc(r.po)}</td>
            <td>${U.colorCell(r.col)}</td>
            <td>${r.sz}</td><td class="num">${U.fmt(r.prs)}</td>
            <td class="num">${U.fmt(r.ctn)}</td><td>Đợt ${r.bat}</td>
            <td>${r._id
              ? `<span class="bdg acc plain">${r._src === "import" ? "import" : "nhập tay"}</span>
                 <button class="btn small danger need-edit" title="Xoá dòng bổ sung" onclick="event.stopPropagation();if(confirm('Xoá dòng ${r.ord} ${r.sz}?')){Store.removeOrderRow('${r._id}');App.toast('Đã xoá dòng bổ sung','warn')}">✕</button>`
              : `<span class="note">Excel gốc</span>`}</td>
            <td class="act-cell need-edit" onclick="event.stopPropagation()">
              <button class="btn small primary" title="Sửa ngay số đôi của dòng này"
                onclick="Views._rowQuickEdit('${r.ord}','${r.sz}')">✎</button>
              <button class="btn small" title="Sửa cả đơn (thông tin + ma trận size)"
                onclick="Views._ordEdit('${r.ord}')">${App.icon("clip", "ico")}</button>
            </td>
          </tr>`; }).join("")}</tbody></table></div>
        <div class="pager">
          <button class="btn" id="pgPrev" ${st.page <= 1 ? "disabled" : ""}>← Trước</button>
          <button class="btn" id="pgNext" ${st.page >= pages ? "disabled" : ""}>Sau →</button>
          <span class="pg-info">Trang ${st.page}/${pages} · hiển thị ${view.length} / ${U.fmt(rows.length)} dòng</span>
        </div>`;
      const pv = document.getElementById("pgPrev"), nx = document.getElementById("pgNext");
      if (pv) pv.onclick = () => { st.page--; renderTable(area); };
      if (nx) nx.onclick = () => { st.page++; renderTable(area); };
      bindQuickEdit(area);
    }
  }

  /* ═══════ SỬA NHANH SỐ ĐÔI NGAY TRÊN DÒNG (chế độ chi tiết size) ═══════ */
  Views._rowQuickEdit = function (ord, sz) {
    if (!Store.guard()) return;
    st.editRow = ord + "|" + sz;
    renderTable(document.getElementById("tblArea"));
  };

  function bindQuickEdit(area) {
    if (!st.editRow) return;
    const [ord, sz] = st.editRow.split("|");
    const qty = document.getElementById("qeQty");
    if (!qty) return;
    const ctnCell = document.getElementById("qeCtn");
    const err = document.getElementById("qeErr");
    const showErr = m => { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(m)}</span>`; };
    const recalc = () => {
      const q = parseInt(qty.value || "0", 10) || 0;
      ctnCell.textContent = U.fmt(q ? Math.ceil(q / TVS_META.packing) : 0);
    };
    qty.addEventListener("input", recalc);
    qty.focus(); qty.select();

    const save = () => {
      const q = parseInt(qty.value || "0", 10) || 0;
      const reason = document.getElementById("qeReason").value;
      if (q < 0) return showErr("Số đôi không được âm");
      const r = Store.editOrderSize(ord, sz, q, reason);
      if (!r.ok) return showErr(r.msg);
      st.editRow = null;
      App.toast(`✓ Đã sửa <b>${ord}</b> · ${sz} → <b>${U.fmt(q)} đôi</b> (lần sửa ${r.rev}) — đã ghi nhật ký`, "ok");
    };
    document.getElementById("qeSave").onclick = save;
    document.getElementById("qeCancel").onclick = () => { st.editRow = null; renderTable(area); };
    [qty, document.getElementById("qeReason")].forEach(el => el.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.preventDefault(); st.editRow = null; renderTable(area); }
    }));
  }

  /* ═══════════ SỬA TOÀN BỘ 1 ĐƠN HÀNG (thông tin + ma trận size) ═══════════ */
  Views._ordEdit = function (ord) {
    if (!Store.guard()) return;
    const o = U.orderByCode(ord);
    if (!o) { App.toast("Không tìm thấy đơn " + U.esc(ord), "warn"); return; }
    const cur = Store.orderSizes(ord), head = Store.orderHead(ord);
    const info = Store.orderEditInfo(ord);
    const ctries = U.uniq(TVS_ORDERS, r => r.ctry).sort();
    const colors = U.uniq(TVS_ORDERS, r => r.col.split(",")[0].trim())
      .concat(Object.keys(U.COLOR_HEX)).filter((c, i, a) => c && a.indexOf(c) === i).sort();
    const headCol = head.col.split(",")[0].trim();

    App.openModal(`
      <div class="modal-h"><h3>${App.icon("clip", "ico")} Sửa đơn hàng ${ord}</h3>
        ${info ? `<span class="bdg acc plain">đã sửa ${info.rev} lần</span>` : ""}
        ${Store.isOrderSeed(ord) ? `<span class="bdg neu plain">đơn Excel gốc</span>` : `<span class="bdg acc plain">đơn nhập thêm</span>`}
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <h4 style="font-size:13px;margin:0 0 8px">① Thông tin chung</h4>
        <div class="frm grid g-3" style="gap:10px">
          <label>Ngày xuất KD *<input id="eD" type="date" value="${head.d}"></label>
          <label>Quốc gia *<input id="eCtry" list="eCtryList" value="${U.esc(head.ctry)}" style="text-transform:uppercase">
            <datalist id="eCtryList">${ctries.map(c => `<option value="${U.esc(c)}">`).join("")}</datalist></label>
          <label>PO khách hàng<input id="ePo" value="${U.esc(head.po)}"></label>
          <label>Mã màu *<select id="eCol">${colors.map(c => `<option ${c === headCol ? "selected" : ""}>${U.esc(c)}</option>`).join("")}</select></label>
          <label>Đợt đặt hàng<select id="eBat">${[1, 2, 3].map(b => `<option ${head.bat == b ? "selected" : ""} value="${b}">Đợt ${b}</option>`).join("")}</select></label>
          <label>Mã đơn<input value="${U.esc(ord)}" disabled title="Mã đơn là khoá dữ liệu — không sửa được"></label>
        </div>

        <h4 style="font-size:13px;margin:16px 0 8px">② Ma trận size — số đôi đặt hàng
          <span class="note">(thùng = ROUNDUP(đôi ÷ ${TVS_META.packing}) · để 0 nếu bỏ size)</span></h4>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Size</th><th class="num">SL đặt hiện tại</th><th class="num">Đã nhập kho</th><th class="num">Đã xuất kho</th>
            <th class="num" style="min-width:120px">SL đặt sửa thành</th><th class="num">Thùng</th></tr></thead>
          <tbody>${U.SIZES.map(s => {
            const recv = U._recvByOrdSize[ord + "|" + s] || 0, shipd = U._shipByOrdSize[ord + "|" + s] || 0;
            return `<tr>
              <td><b>${s}</b></td>
              <td class="num">${cur[s] ? U.fmt(cur[s]) : "—"}</td>
              <td class="num ${recv ? "" : "note"}">${recv ? U.fmt(recv) : "—"}</td>
              <td class="num ${shipd ? "" : "note"}">${shipd ? U.fmt(shipd) : "—"}</td>
              <td class="num"><input class="cell-in" type="number" min="0" value="${cur[s] || 0}" data-esz="${s}"></td>
              <td class="num note" data-ectn="${s}">${cur[s] ? U.fmt(Math.ceil(cur[s] / TVS_META.packing)) : 0}</td>
            </tr>`; }).join("")}</tbody>
          <tfoot><tr><td colspan="4">TỔNG</td><td class="num" id="eSumPrs">0</td><td class="num" id="eSumCtn">0</td></tr></tfoot>
        </table></div>
        <div id="eWarn" class="mt"></div>

        <div class="frm mt"><label>Lý do sửa <span style="color:var(--bad)">*</span>
          <input id="eReason" placeholder="VD: khách đổi số lượng, sửa sai sót nhập liệu, dời ngày xuất KD…"></label></div>
        <div class="mt" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn primary" id="eSave">Lưu thay đổi &amp; ghi nhật ký</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          ${info ? `<button class="btn" id="eHist">⟲ Xem nhật ký (${info.rev})</button>
                    <button class="btn" id="eRestore">↺ Khôi phục đơn về gốc</button>` : ""}
          <span class="note" id="eErr" style="margin-left:auto"></span>
        </div>
      </div>`, true);

    const inputs = [...document.querySelectorAll("#modalBack input[data-esz]")];
    const recalc = () => {
      let p = 0, c = 0;
      const warns = [];
      inputs.forEach(i => {
        const sz = i.dataset.esz, q = parseInt(i.value || "0", 10) || 0;
        const ct = q ? Math.ceil(q / TVS_META.packing) : 0;
        document.querySelector(`[data-ectn="${sz}"]`).textContent = U.fmt(ct);
        p += q; c += ct;
      });
      document.getElementById("eSumPrs").innerHTML = `<b>${U.fmt(p)}</b> đôi`;
      document.getElementById("eSumCtn").innerHTML = `<b>${U.fmt(c)}</b> thùng`;
      const sizes = {}; inputs.forEach(i => sizes[i.dataset.esz] = parseInt(i.value || "0", 10) || 0);
      const chk = Store.checkOrderSizes(ord, sizes);
      const w = document.getElementById("eWarn");
      w.innerHTML = (chk.blocks.length || chk.warns.length)
        ? `<div class="alert ${chk.blocks.length ? "" : "warn"}"><div class="a-t">
             ${chk.blocks.length ? `<b>⛔ Không lưu được:</b><br>${chk.blocks.map(U.esc).join("<br>")}<br>` : ""}
             ${chk.warns.length ? `<b>⚠ Lưu ý:</b><br>${chk.warns.map(U.esc).join("<br>")}` : ""}
           </div></div>` : "";
    };
    inputs.forEach(i => i.addEventListener("input", recalc)); recalc();

    document.getElementById("eSave").onclick = () => {
      const err = document.getElementById("eErr");
      const sizes = {}; inputs.forEach(i => sizes[i.dataset.esz] = parseInt(i.value || "0", 10) || 0);
      const newHead = {
        d: document.getElementById("eD").value,
        ctry: document.getElementById("eCtry").value,
        po: document.getElementById("ePo").value,
        col: document.getElementById("eCol").value,
        bat: document.getElementById("eBat").value,
      };
      if (!newHead.d) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ Chọn ngày xuất KD</span>`; return; }
      if (!newHead.ctry.trim()) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ Nhập quốc gia</span>`; return; }
      const r = Store.editOrder(ord, newHead, sizes, document.getElementById("eReason").value);
      if (!r.ok) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Đã sửa đơn <b>${ord}</b> — lần sửa thứ ${r.rev}, đã ghi nhật ký`, "ok");
    };
    const hb = document.getElementById("eHist");
    if (hb) hb.onclick = () => Views._ordHistory(ord);
    const rb = document.getElementById("eRestore");
    if (rb) rb.onclick = () => {
      if (!confirm(`Khôi phục đơn ${ord} về đúng dữ liệu gốc?`)) return;
      const r = Store.restoreOrder(ord, "Khôi phục về gốc từ màn hình sửa đơn");
      if (!r.ok) { App.toast("⚠ " + r.msg, "warn"); return; }
      App.closeModal();
      App.toast(`✓ Đã khôi phục đơn <b>${ord}</b> về dữ liệu gốc`, "ok");
    };
  };

  /* ═══════════ XOÁ 1 ĐƠN HÀNG (khôi phục được) ═══════════ */
  Views._ordDelete = function (ord) {
    if (!Store.guard()) return;
    const o = U.orderByCode(ord);
    if (!o) { App.toast("Không tìm thấy đơn " + U.esc(ord), "warn"); return; }
    App.openModal(`
      <div class="modal-h"><h3>Xoá đơn hàng ${ord}</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b" style="max-width:560px">
        <div class="alert" style="margin-bottom:12px"><div class="a-t">
          Xoá toàn bộ đơn <b>${ord}</b> — ${U.flag(o.ctry)} ${U.esc(o.ctry)} ·
          <b>${U.fmt(o.prs)} đôi</b> / ${U.fmt(o.ctn)} thùng · ${U.SIZES.filter(s => o.sizes[s]).length} size ·
          xuất KD ${U.fmtDate(o.d)}.<br>
          Số liệu N-X-T, kế hoạch xuất và bảng điều khiển sẽ tính lại ngay. Thao tác được ghi nhật ký và
          <b>khôi phục được</b> bất cứ lúc nào.
          ${o.recvPrs > 0 ? `<br><b>⚠ Đơn này đã nhập kho ${U.fmt(o.recvPrs)} đôi</b> — số nhập kho sẽ thành hàng không có đơn đặt.` : ""}
          ${o.shipPrs > 0 ? `<br><b>⛔ Đơn đã xuất kho ${U.fmt(o.shipPrs)} đôi</b> — phải huỷ phiếu xuất kho trước.` : ""}
        </div></div>
        <div class="frm"><label>Lý do xoá <span style="color:var(--bad)">*</span>
          <input id="odReason" placeholder="VD: khách huỷ đơn, tạo trùng, nhập nhầm chỉ thị…"></label></div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn danger" id="odGo">Xoá đơn &amp; ghi nhật ký</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          <span class="note" id="odErr" style="margin-left:auto"></span>
        </div>
      </div>`);
    document.getElementById("odGo").onclick = () => {
      const r = Store.deleteOrder(ord, document.getElementById("odReason").value);
      if (!r.ok) { document.getElementById("odErr").innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Đã xoá đơn <b>${ord}</b> — đã ghi nhật ký, khôi phục được`, "warn");
    };
  };

  /* ═══════════ NHẬT KÝ CHỈNH SỬA 1 ĐƠN ═══════════ */
  Views._ordHistory = function (ord) {
    const info = Store.orderEditInfo(ord);
    if (!info) { App.toast("Đơn này chưa có chỉnh sửa", "warn"); return; }
    const szTxt = m => m ? (U.SIZES.filter(s => m[s]).map(s => `${s.replace("UK ", "")}×${U.fmt(m[s])}`).join(" · ") || "—") : "(đã xoá)";
    const hdTxt = h => h ? `${U.fmtDate(h.d)} · ${U.esc(h.ctry)} · ${U.esc(h.po || "—")} · ${U.esc(h.col)} · Đợt ${h.bat}` : "—";
    const rows = info.log.slice().reverse().map(l => `
      <tr>
        <td class="num"><b>${l.rev}</b></td>
        <td>${new Date(l.at).toLocaleString("vi-VN")}</td>
        <td><b>${U.esc(l.by)}</b></td>
        <td>${l.restored ? '<span class="bdg neu plain">khôi phục gốc</span>'
              : (l.after === null ? '<span class="bdg bad plain">xoá đơn</span>' : '<span class="bdg acc plain">sửa đơn</span>')}</td>
        <td class="note">${l.restored ? "—" : szTxt(l.before)}</td>
        <td class="note">${l.restored ? "về gốc" : szTxt(l.after)}</td>
        <td class="note">${l.restored || !l.afterHead ? "—" : hdTxt(l.afterHead)}</td>
        <td>${U.esc(l.reason || "")}</td>
      </tr>`).join("");
    App.openModal(`
      <div class="modal-h"><h3>Nhật ký chỉnh sửa đơn — ${ord}</h3>
        <span class="bdg acc plain">${info.rev} lần sửa</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="note" style="margin-bottom:10px">Mã đơn <b>${ord}</b>${info.deleted ? ' · <span class="bdg bad plain">đang ở trạng thái ĐÃ XOÁ</span>' : ""}</div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Lần</th><th>Thời điểm</th><th>Người sửa</th><th>Loại</th><th>Size trước</th><th>Size sau</th><th>Thông tin chung sau</th><th>Lý do</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn need-edit" id="ohRestore">↺ Khôi phục đơn về gốc</button>
          <button class="btn" onclick="App.closeModal()">Đóng</button>
        </div>
      </div>`, true);
    const rb = document.getElementById("ohRestore");
    if (rb) rb.onclick = () => {
      const r = Store.restoreOrder(ord, "Khôi phục về gốc từ nhật ký");
      if (!r.ok) { App.toast("⚠ " + r.msg, "warn"); return; }
      App.closeModal();
      App.toast(`✓ Đã khôi phục đơn <b>${ord}</b> về dữ liệu gốc`, "ok");
    };
  };
})();
