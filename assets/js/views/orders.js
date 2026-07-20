/* ═══════════════════════════════════════════════════════════════════
   views/orders.js — OMS · ĐƠN ĐẶT HÀNG KHÁCH HÀNG (sheet Data)
   549 dòng chi tiết / 95 đơn hàng thật — lọc, tìm kiếm, xem ma trận size
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const st = { q: "", ctry: "", col: "", bat: "", d: "", mode: "orders", page: 1, per: 60 };

  function statusBdg(o) {
    if (o.status === "full") return `<span class="bdg ok">đủ hàng</span>`;
    if (o.status === "partial") return `<span class="bdg warn">đang SX · thiếu ${U.fmt(o.short)}</span>`;
    return `<span class="bdg neu">chưa nhập kho</span>`;
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
        ${statusBdg(o)}
        <button class="modal-x" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-b">
        <div class="grid g-3">
          <div><div class="note">Quốc gia</div><b>${U.esc(o.ctry)} (${U.VN_COUNTRY[o.ctry] || ""})</b></div>
          <div><div class="note">PO khách hàng</div><b class="mono">${U.esc(o.po)}</b></div>
          <div><div class="note">Mã màu</div><b><span class="color-dot" style="background:${U.colorHex(o.col.split(",")[0].trim())}"></span>${U.esc(o.col)}</b></div>
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

      root.innerHTML = `
        <div class="card">
          <div class="filters" style="background:#fafbfc">
            <button class="btn primary need-edit" id="oAdd">${App.icon("plus", "ico")} Thêm đơn hàng</button>
            <button class="btn" id="oTpl">${App.icon("download", "ico")} File mẫu import</button>
            <button class="btn need-edit" id="oImp">${App.icon("upload", "ico")} Import từ file</button>
            <button class="btn" id="oExp">${App.icon("download", "ico")} Export dữ liệu (CSV)</button>
            <span class="f-chipcount">Nhập tay hoặc import CSV theo đúng định dạng file mẫu</span>
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
      bind("oTpl", "click", () => { Store.templateOrders(); App.toast("Đã tải file mẫu MAU_IMPORT_DON_DAT_HANG.csv — điền theo đúng cột rồi Import", "ok"); });
      bind("oImp", "click", importOrders);
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

  /* ── IMPORT đơn hàng từ CSV ── */
  function importOrders() {
    App.pickFile(text => {
      const { rows, errs } = Store.importOrders(text);
      let html = `<div class="modal-h"><h3>Kết quả đọc file import đơn hàng</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div><div class="modal-b">`;
      if (errs.length) html += `<div class="alert" style="margin-bottom:12px"><div class="a-t"><b>${errs.length} dòng lỗi (bị bỏ qua):</b><br>${errs.slice(0, 12).map(U.esc).join("<br>")}${errs.length > 12 ? "<br>…" : ""}</div></div>`;
      if (!rows.length) { html += `<div class="note">Không có dòng hợp lệ. Kiểm tra lại theo file mẫu.</div></div>`; App.openModal(html, true); return; }
      html += `<p style="font-size:13px">Hợp lệ <b>${rows.length} dòng</b> · ${U.fmt(U.sum(rows, r => r.prs))} đôi · ${U.uniq(rows, r => r.ord).length} đơn:</p>
        <div class="tbl-wrap" style="max-height:38vh;overflow:auto"><table class="tbl">
        <thead><tr><th>Ngày XKD</th><th>Quốc gia</th><th>Đơn</th><th>PO</th><th>Màu</th><th>Size</th><th class="num">Đôi</th><th class="num">Thùng</th><th>Đợt</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${U.fmtDate(r.d)}</td><td>${U.esc(r.ctry)}</td><td><b>${r.ord}</b></td><td class="mono">${U.esc(r.po)}</td><td>${r.col}</td><td>${r.sz}</td><td class="num">${U.fmt(r.prs)}</td><td class="num">${r.ctn}</td><td>${r.bat}</td></tr>`).join("")}</tbody></table></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="oiApply">✓ Nhập ${rows.length} dòng vào hệ thống</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div></div>`;
      App.openModal(html, true);
      document.getElementById("oiApply").onclick = () => {
        Store.addOrders(rows, "import");
        App.closeModal();
        App.toast(`✓ Đã import ${rows.length} dòng đơn hàng từ file`, "ok");
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
          <th>Mã đơn</th><th>Quốc gia</th><th>PO</th><th>Màu</th><th>Size</th>
          <th class="num">Số đôi</th><th class="num">Số thùng</th>
          <th>Ngày xuất KD</th><th>Đợt</th><th class="num">Đã nhập</th><th>Trạng thái</th>
        </tr></thead>
        <tbody>${list.map(o => `
          <tr class="clickable" onclick="Views._openOrder('${o.ord}')">
            <td><b>${o.ord}</b></td>
            <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
            <td class="mono">${U.esc(o.po)}</td>
            <td><span class="color-dot" style="background:${U.colorHex(o.col.split(",")[0].trim())}"></span>${U.esc(o.col)}</td>
            <td class="note">${U.SIZES.filter(s => o.sizes[s]).length} size</td>
            <td class="num">${U.fmt(o.prs)}</td><td class="num">${U.fmt(o.ctn)}</td>
            <td>${U.fmtDate(o.d)}</td><td>Đợt ${o.bat}</td>
            <td class="num">${o.recvPrs ? U.fmt(o.recvPrs) : "—"}</td>
            <td>${statusBdg(o)}</td>
          </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="5">TỔNG (${U.fmt(list.length)} đơn)</td>
          <td class="num">${U.fmt(U.sum(list, o => o.prs))}</td>
          <td class="num">${U.fmt(U.sum(list, o => o.ctn))}</td><td colspan="2"></td>
          <td class="num">${U.fmt(U.sum(list, o => o.recvPrs))}</td><td></td></tr></tfoot>
      </table></div>
      <div class="note" style="padding:10px 18px">Bấm vào từng dòng để xem ma trận size & đối chiếu nhập kho.</div>`;
    } else {
      const rows = applyFilterRows();
      document.getElementById("fCount").textContent =
        `${U.fmt(rows.length)} dòng · ${U.fmt(U.sum(rows, r => r.prs))} đôi · ${U.fmt(U.sum(rows, r => r.ctn))} thùng`;
      const pages = Math.max(1, Math.ceil(rows.length / st.per));
      st.page = Math.min(st.page, pages);
      const view = rows.slice((st.page - 1) * st.per, st.page * st.per);
      area.innerHTML = `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Ngày xuất KD</th><th>Quốc gia</th><th>Đơn hàng</th><th>PO</th>
          <th>Màu</th><th>Size</th><th class="num">Số đôi</th><th class="num">Số thùng</th><th>Đợt</th><th>Nguồn</th></tr></thead>
        <tbody>${view.map((r, i) => `
          <tr class="clickable" onclick="Views._openOrder('${r.ord}')">
            <td class="note">${(st.page - 1) * st.per + i + 1}</td>
            <td>${U.fmtDate(r.d)}</td>
            <td>${U.flag(r.ctry)} ${U.esc(r.ctry)}</td>
            <td><b>${r.ord}</b></td><td class="mono">${U.esc(r.po)}</td>
            <td><span class="color-dot" style="background:${U.colorHex(r.col)}"></span>${r.col}</td>
            <td>${r.sz}</td><td class="num">${U.fmt(r.prs)}</td>
            <td class="num">${U.fmt(r.ctn)}</td><td>Đợt ${r.bat}</td>
            <td>${r._id
              ? `<span class="bdg acc plain">${r._src === "import" ? "import" : "nhập tay"}</span>
                 <button class="btn small danger need-edit" title="Xoá dòng bổ sung" onclick="event.stopPropagation();if(confirm('Xoá dòng ${r.ord} ${r.sz}?')){Store.removeOrderRow('${r._id}');App.toast('Đã xoá dòng bổ sung','warn')}">✕</button>`
              : `<span class="note">Excel gốc</span>`}</td>
          </tr>`).join("")}</tbody></table></div>
        <div class="pager">
          <button class="btn" id="pgPrev" ${st.page <= 1 ? "disabled" : ""}>← Trước</button>
          <button class="btn" id="pgNext" ${st.page >= pages ? "disabled" : ""}>Sau →</button>
          <span class="pg-info">Trang ${st.page}/${pages} · hiển thị ${view.length} / ${U.fmt(rows.length)} dòng</span>
        </div>`;
      const pv = document.getElementById("pgPrev"), nx = document.getElementById("pgNext");
      if (pv) pv.onclick = () => { st.page--; renderTable(area); };
      if (nx) nx.onclick = () => { st.page++; renderTable(area); };
    }
  }
})();
