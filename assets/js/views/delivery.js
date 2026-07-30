/* ═══════════════════════════════════════════════════════════════════
   views/delivery.js — LỆNH GIAO HÀNG / PHIẾU XUẤT KHO THÀNH PHẨM
   Theo mẫu Excel "PHIEU XUAT KHO THANH PHAM.xlsx" (Mẫu số 03/XKNB)
   • Chọn NHIỀU chỉ thị (mapping từ đơn đặt hàng)
   • Số thùng tính theo PACKING LIST (CLP): thùng nguyên / thùng lẻ /
     thùng MIX SIZE — dòng mix được GỘP đúng như packing list
   • Xác nhận xuất → ghi NGÀY THỰC XUẤT → TỶ LỆ XUẤT ĐÚNG HẠN (%)
   • In phiếu phân trang: đánh số Trang i/n + khối ký theo mẫu
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const COMPANY = {
    name: "CÔNG TY TNHH GIÀY TUẤN VIỆT",
    addr: "Cụm CN Phú Thạnh, Phường Nhơn Trạch, Thành phố Đồng Nai, Việt Nam",
    addrShort: "Cụm CN Phú Thạnh, Nhơn Trạch, Đồng Nai",
    mst: "3600604792",
  };
  const DEFAULTS = {
    receiver: "CÔNG TY TNHH GIÀY ELITE VIỆT NAM",
    receiverAddr: "Cụm công nghiệp Anova Group, ấp 4, Xã Long Cang, tỉnh Tây Ninh, Việt Nam",
    warehouse: "Tại Kho thành phẩm CTY",
    dept: "Phòng nghiệp vụ kinh doanh TVS",
    reason: "Giao hàng thành phẩm Adidas cho nhà máy nhận hàng",
    condition: "Nguyên carton, thùng kéo băng keo 1/2 phía dưới, mặt trên không kéo băng keo",
  };
  /* Khối ký xác nhận — đúng theo hình mẫu người dùng cung cấp */
  const SIGN_ROLES = ["Người lập phiếu", "Người nhận hàng", "Thủ kho", "Bảo vệ", "Phòng.NVKD", "Ban giám đốc"];

  let wiz = null;

  const stBdg = s => s.status === "shipped"
    ? `<span class="bdg ok">đã xuất kho · ${U.fmtDate(s.actualDate)}</span>`
    : `<span class="bdg warn">nháp · chờ xuất</span>`;
  const onTimeBdg = o => {
    if (o.delayDays === null) return "";
    if (o.delayDays > 0) return `<span class="bdg bad">trễ ${o.delayDays} ngày</span>`;
    if (o.delayDays === 0) return `<span class="bdg ok">đúng ngày</span>`;
    return `<span class="bdg ok">sớm ${-o.delayDays} ngày</span>`;
  };
  const ctnFor = (qty, g) => qty <= 0 ? 0 : (qty >= g.groupPrs ? g.groupCtn : Math.ceil(qty / g.perCtn));
  const mixLabel = l => Object.entries(l.sizes).map(([sz, q]) => `${sz.replace("UK ", "")}×${q}`).join(" · ");
  const sizeCell = l => l.kind === "mix"
    ? `<b>MIX</b> <span class="mix-bd">${mixLabel(l)}</span>`
    : `<b>${l.sz}</b>`;

  /* ═════════ MÀN HÌNH CHÍNH ═════════ */
  window.Views.delivery = {
    title: "Lệnh giao hàng · Phiếu xuất kho",
    render(root) {
      const ships = (window.TVS_SHIPMENTS || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const drafts = ships.filter(s => s.status !== "shipped");
      const done = ships.filter(s => s.status === "shipped");
      const OT = U.ONTIME;

      root.innerHTML = `
        <div class="grid g-kpi">
          <div class="card kpi kpi-acc"><div class="k-lab">${App.icon("doc")}<span>Phiếu xuất kho</span></div>
            <div class="k-val">${ships.length}</div>
            <div class="k-sub">${done.length} đã xuất · ${drafts.length} nháp chờ xuất</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("truck")}<span>Đã thực xuất</span></div>
            <div class="k-val">${U.fmt(U.NXT.xuatPrs)} <small>đôi</small></div>
            <div class="k-sub">${U.fmt(U.NXT.xuatCtn)} thùng carton (theo packing list)</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("layers")}<span>Tồn khả dụng</span></div>
            <div class="k-val">${U.fmt(U.NXT.tonPrs)} <small>đôi</small></div>
            <div class="k-sub">sẵn sàng cho lệnh tiếp theo</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("check")}<span>Đúng hạn theo chỉ thị</span></div>
            <div class="k-val" style="color:${OT.rate === null ? "inherit" : (OT.rate >= 0.8 ? "var(--ok)" : "var(--bad)")}">${OT.rate === null ? "—" : U.fmtPct(OT.rate, 0)}</div>
            <div class="k-sub">${OT.n ? `${OT.onTimeN}/${OT.n} chỉ thị xuất đúng/sớm hạn` : "chưa có chỉ thị nào xuất"}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("gauge")}<span>Đúng hạn theo số đôi</span></div>
            <div class="k-val">${OT.pairsRate === null ? "—" : U.fmtPct(OT.pairsRate, 0)}</div>
            <div class="k-sub">${OT.pairs ? `${U.fmt(OT.pairsOnTime)}/${U.fmt(OT.pairs)} đôi đúng hạn` : "chưa phát sinh xuất"}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("clock")}<span>Chênh lệch bình quân</span></div>
            <div class="k-val">${OT.avgDelay === null ? "—" : (OT.avgDelay > 0 ? "+" : "") + OT.avgDelay.toFixed(1).replace(".", ",")}<small> ngày</small></div>
            <div class="k-sub">so với "Ngày xuất KD" (− là sớm)</div></div>
        </div>

        <div class="card mt">
          <div class="filters">
            <button class="btn primary need-edit" id="btnNew">${App.icon("plus", "ico")} Tạo lệnh giao hàng</button>
            <button class="btn" id="btnTpl">${App.icon("download", "ico")} File mẫu import</button>
            <button class="btn need-edit" id="btnImp">${App.icon("upload", "ico")} Import phiếu từ file</button>
            <button class="btn" id="btnExpAll" ${done.length ? "" : "disabled"}>${App.icon("download", "ico")} Export nhật ký xuất (CSV)</button>
            <span class="f-chipcount">Số thùng & dòng MIX size lấy đúng theo PACKING LIST đợt 1 (${Object.keys(window.TVS_PACKING || {}).length} chỉ thị)</span>
          </div>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Số phiếu</th><th>Lệnh GH số</th><th>Ngày phiếu</th><th>Chỉ thị</th><th>Xuất cho</th>
              <th class="num">Số đôi</th><th class="num">Số thùng</th><th>Trạng thái</th>
              <th style="min-width:158px">Ngày thực xuất</th><th>Hành động</th>
            </tr></thead>
            <tbody>${ships.length ? ships.map(s => `
              <tr>
                <td><b>${U.esc(s.code)}</b></td>
                <td class="mono">${U.esc(s.lgh)}</td>
                <td>${U.fmtDate(s.date)}</td>
                <td>${s.orders.map(c => `<span class="bdg neu plain">${c}</span>`).join(" ")}</td>
                <td class="note" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${U.esc(s.receiver)}</td>
                <td class="num">${U.fmt(U.sum(s.lines, l => l.qty))}</td>
                <td class="num">${U.fmt(U.sum(s.lines, l => l.ctn))}</td>
                <td>${stBdg(s)}</td>
                <td>
                  <input type="date" class="cell-in need-edit" style="width:140px"
                    value="${s.actualDate || ""}" title="Nhập / sửa ngày thực xuất"
                    onchange="Views._setActual('${s.id}', this.value)">
                  <span class="view-only">${s.actualDate ? U.fmtDate(s.actualDate) : "—"}</span>
                </td>
                <td style="white-space:nowrap">
                  <button class="btn small" onclick="Views._pxkView('${s.id}')">${App.icon("print", "ico")} Phiếu</button>
                  ${s.status !== "shipped"
                    ? `<button class="btn small primary need-edit" onclick="Views._pxkConfirm('${s.id}')">Xuất kho</button>
                       <button class="btn small need-edit" onclick="Views._pxkEdit('${s.id}')">Sửa</button>
                       <button class="btn small danger need-edit" onclick="Views._pxkDel('${s.id}')">${App.icon("trash", "ico")}</button>`
                    : `<button class="btn small" onclick="Views._pxkCSV('${s.id}')">CSV</button>
                       <button class="btn small danger need-edit" onclick="Views._pxkRevert('${s.id}')">Hủy xuất</button>`}
                </td>
              </tr>`).join("") : `
              <tr><td colspan="10" style="text-align:center;padding:34px" class="note">
                Chưa có lệnh giao hàng nào. Bấm <b>“Tạo lệnh giao hàng”</b> → chọn các chỉ thị cần xuất —
                hệ thống tải số lượng thực nhập từ kho và tính thùng theo packing list.</td></tr>`}
            </tbody>
          </table></div>
          <div class="note" style="padding:6px 18px 2px">Ô <b>Ngày thực xuất</b> nhập trực tiếp tại đây: phiếu đã xuất → tự cập nhật tỷ lệ đúng hạn; phiếu nháp → điền sẵn cho bước “Xuất kho”.</div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Đối chiếu ngày xuất — tỷ lệ đúng hạn theo chỉ thị</h3>
            <span class="sub">Ngày thực xuất (phiếu XK) ↔ Ngày xuất KD (đơn đặt hàng)</span></div>
          ${OT.n ? `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Chỉ thị</th><th>Quốc gia</th><th>Ngày xuất KD</th><th>Ngày thực xuất</th>
              <th class="num">SL đặt</th><th class="num">Đã xuất</th><th class="num">% xuất</th>
              <th class="num">Chênh (ngày)</th><th>Kết quả</th>
            </tr></thead>
            <tbody>${OT.orders.map(o => `
              <tr>
                <td class="clickable" onclick="Views._openOrder('${o.ord}')"><b>${o.ord}</b></td>
                <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
                <td>${U.fmtDate(o.d)}</td>
                <td><b>${U.fmtDate(o.lastShipDate)}</b></td>
                <td class="num">${U.fmt(o.prs)}</td>
                <td class="num">${U.fmt(o.shipPrs)}</td>
                <td class="num">${U.fmtPct(o.shipPrs / o.prs, 0)}</td>
                <td class="num ${o.delayDays > 0 ? "neg" : "pos"}">${o.delayDays > 0 ? "+" : ""}${o.delayDays}</td>
                <td>${onTimeBdg(o)}${o.shipPrs < o.prs ? ` <span class="bdg neu plain">xuất một phần</span>` : ""}</td>
              </tr>`).join("")}</tbody>
            <tfoot><tr>
              <td colspan="4">TỶ LỆ ĐÚNG HẠN</td>
              <td class="num" colspan="3">${OT.onTimeN}/${OT.n} chỉ thị = <b>${U.fmtPct(OT.rate, 0)}</b></td>
              <td class="num" colspan="2">theo số đôi: <b>${U.fmtPct(OT.pairsRate, 0)}</b></td>
            </tr></tfoot>
          </table></div>`
          : `<div class="card-b note">Chưa có chỉ thị nào ghi nhận ngày thực xuất. Sau khi bấm <b>“Xuất kho”</b> trên phiếu,
             hệ thống ghi ngày thực xuất và tự đối chiếu với "Ngày xuất KD" để tính % đúng hạn tại đây.</div>`}
        </div>`;

      document.getElementById("btnNew").onclick = () => openWizard(null);
      document.getElementById("btnTpl").onclick = () => { Store.templateShipments(); App.toast("Đã tải file mẫu MAU_IMPORT_PHIEU_XUAT_KHO.csv", "ok"); };
      document.getElementById("btnImp").onclick = importShipFile;
      const expAll = document.getElementById("btnExpAll");
      if (expAll) expAll.onclick = exportLog;
    }
  };

  /* ═════════ IMPORT / EXPORT ═════════ */
  function importShipFile() {
    App.pickFile(text => {
      const { groups, errs } = Store.importShipments(text);
      const okLines = U.sum(groups, g => g.lines.length);
      let html = `<div class="modal-h"><h3>Kết quả đọc file phiếu xuất</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div><div class="modal-b">`;
      if (errs.length) html += `<div class="alert" style="margin-bottom:12px"><div class="a-t"><b>${errs.length} dòng lỗi (bị bỏ qua):</b><br>${errs.slice(0, 10).map(U.esc).join("<br>")}${errs.length > 10 ? "<br>…" : ""}</div></div>`;
      if (!okLines) { html += `<div class="note">Không có dòng hợp lệ nào.</div></div>`; App.openModal(html); return; }
      html += `<p style="font-size:13px">Hợp lệ: <b>${okLines} dòng</b> → tạo <b>${groups.length} phiếu nháp</b>:</p>
        ${groups.map(g => `<div class="note" style="margin:4px 0">• ${g.code || "(số phiếu tự sinh)"} — ${U.fmtDate(g.date)} — ${g.lines.length} dòng, ${U.fmt(U.sum(g.lines, l => l.qty))} đôi</div>`).join("")}
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="impApply">Tạo ${groups.length} phiếu nháp</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div></div>`;
      App.openModal(html);
      document.getElementById("impApply").onclick = () => {
        for (const g of groups) {
          const seq = Store.nextSeq();
          Store.saveShipment(Object.assign(newShipment(), {
            code: g.code || seq.pxk, lgh: seq.lgh, pkl: seq.pkl,
            date: g.date, orders: U.uniq(g.lines, l => l.ord), lines: g.lines,
          }));
        }
        App.closeModal();
        App.toast(`Đã tạo ${groups.length} phiếu nháp từ file import`, "ok");
      };
    });
  }

  function exportLog() {
    const rows = [["Số phiếu", "Lệnh GH số", "Ngày phiếu", "Ngày thực xuất", "Chỉ thị", "Quốc gia", "PO", "Style", "Màu", "Size/Quy cách", "Chi tiết mix", "Thùng số", "SL theo PL", "SL thực xuất", "Số carton", "Ngày xuất KD", "Đúng hạn"]];
    for (const s of TVS_SHIPMENTS.filter(x => x.status === "shipped"))
      for (const l of s.lines) {
        const o = U.orderByCode(l.ord);
        rows.push([s.code, s.lgh, U.fmtDate(s.date), U.fmtDate(s.actualDate), l.ord, l.ctry, l.po, l.style, l.col,
          l.kind === "mix" ? "MIX" : l.sz, l.kind === "mix" ? mixLabel(l) : "",
          l.from ? (l.from === l.to ? "#" + l.from : `#${l.from}–${l.to}`) : "",
          l.groupPrs ?? l.req ?? "", l.qty, l.ctn, o ? U.fmtDate(o.d) : "", o && s.actualDate <= o.d ? "Đúng hạn" : "Trễ"]);
      }
    Store.downloadCSV("NHAT_KY_XUAT_KHO_TVS.csv", rows);
    App.toast("Đã xuất nhật ký xuất kho (CSV)", "ok");
  }

  /* ═════════ WIZARD TẠO / SỬA PHIẾU ═════════ */
  function newShipment() {
    return {
      id: null, code: "", lgh: "", pkl: "", qcNo: "",
      date: TVS_META.today, actualDate: null, status: "draft",
      receiver: DEFAULTS.receiver, receiverAddr: DEFAULTS.receiverAddr,
      warehouse: DEFAULTS.warehouse, dept: DEFAULTS.dept, reason: DEFAULTS.reason,
      driver: "", truck: "", seal: "", condition: DEFAULTS.condition, approved: "Đã duyệt",
      orders: [], lines: [],
    };
  }

  function openWizard(shipId) {
    const s = shipId ? JSON.parse(JSON.stringify(Store.getShipment(shipId))) : newShipment();
    if (!s.code) { const q = Store.nextSeq(); s.code = q.pxk; s.lgh = q.lgh; s.pkl = q.pkl; }
    wiz = { s, step: 1, search: "", onlyAvail: true };
    renderWizard();
  }
  window.Views._pxkEdit = openWizard;

  const val = id => (document.getElementById(id) || {}).value?.trim() ?? "";

  /* Sinh dòng phiếu từ PACKING LIST của các chỉ thị đã chọn */
  function buildLines(s) {
    const lines = [];
    for (const ord of s.orders) {
      const o = U.orderByCode(ord); if (!o) continue;
      const rem = {};
      U.SIZES.forEach(sz => { rem[sz] = U.avail(ord, sz); });
      for (const g of Store.packingGroups(ord)) {
        const base = {
          ord, ctry: o.ctry, po: o.po, style: TVS_META.itemCode, col: o.col.split(",")[0].trim(),
          perCtn: g.perCtn, groupPrs: g.prs, groupCtn: g.ctn, from: g.from, to: g.to,
          box: g.box || "", gi: g.gi, synthetic: !!g.synthetic, note: "",
        };
        if (g.mix) {
          const can = Object.entries(g.sizes).every(([sz, q]) => (rem[sz] || 0) >= q);
          if (can) Object.entries(g.sizes).forEach(([sz, q]) => { rem[sz] -= q; });
          lines.push({ ...base, kind: "mix", sizes: { ...g.sizes }, qty: can ? g.prs : 0, ctn: can ? g.ctn : 0, canShip: can });
        } else {
          const sz = Object.keys(g.sizes)[0];
          const take = Math.max(0, Math.min(rem[sz] || 0, g.prs));
          rem[sz] = (rem[sz] || 0) - take;
          lines.push({ ...base, kind: "run", sz, qty: take, ctn: ctnFor(take, base), maxQty: take });
        }
      }
    }
    s.lines = lines;
  }
  window.Views._pxkBuildLines = buildLines;   /* expose cho kiểm thử */

  function renderWizard() {
    const s = wiz.s;
    const stepBar = `
      <div class="steps-bar">
        <span class="stp ${wiz.step === 1 ? "on" : "done"}">1. Thông tin phiếu & chọn chỉ thị</span>
        <span class="stp ${wiz.step === 2 ? "on" : ""}">2. Số lượng thực xuất & thùng theo packing list</span>
      </div>`;

    if (wiz.step === 1) {
      const q = wiz.search.trim().toLowerCase();
      const cands = U.ORDER_INDEX.filter(o =>
        (!wiz.onlyAvail || (o.recvPrs - o.shipPrs) > 0 || s.orders.includes(o.ord)) &&
        (!q || o.ord.toLowerCase().includes(q) || o.ctry.toLowerCase().includes(q) || o.po.toLowerCase().includes(q)));

      App.openModal(`
        <div class="modal-h"><h3>${s.id ? "Sửa" : "Tạo"} lệnh giao hàng — ${U.esc(s.code)}</h3>
          <span class="bdg warn">nháp</span>
          <button class="modal-x" onclick="App.closeModal()">✕</button></div>
        <div class="modal-b">
          ${stepBar}
          <div class="frm grid g-3" style="gap:10px">
            <label>Số phiếu<input id="wCode" value="${U.esc(s.code)}"></label>
            <label>Ngày phiếu<input id="wDate" type="date" value="${s.date}"></label>
            <label>Lệnh giao hàng số<input id="wLgh" value="${U.esc(s.lgh)}"></label>
            <label>Packing List số<input id="wPkl" value="${U.esc(s.pkl)}"></label>
            <label>QC Release số<input id="wQc" value="${U.esc(s.qcNo)}" placeholder="—"></label>
            <label>Người nhận / Tài xế<input id="wDriver" value="${U.esc(s.driver)}" placeholder="Họ tên tài xế"></label>
            <label>Biển số xe<input id="wTruck" value="${U.esc(s.truck)}" placeholder="60C-xxxxx"></label>
            <label>Seal No.<input id="wSeal" value="${U.esc(s.seal)}" placeholder="—"></label>
            <label>Kho xuất<input id="wWh" value="${U.esc(s.warehouse)}"></label>
            <label style="grid-column:span 2">Xuất cho<input id="wRecv" value="${U.esc(s.receiver)}"></label>
            <label>Bộ phận yêu cầu<input id="wDept" value="${U.esc(s.dept)}"></label>
            <label style="grid-column:1/-1">Địa chỉ nhận<input id="wAddr" value="${U.esc(s.receiverAddr)}"></label>
            <label style="grid-column:1/-1">Ghi chú tình trạng hàng<input id="wCond" value="${U.esc(s.condition)}"></label>
          </div>

          <h4 style="margin:16px 0 8px;font-size:13.5px">Chọn chỉ thị cần xuất <span class="note">(chọn được nhiều — mapping từ đơn đặt hàng · 📦 = có packing list)</span></h4>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
            <input class="f-input" id="wSearch" placeholder="Tìm chỉ thị / quốc gia / PO…" value="${U.esc(wiz.search)}">
            <label class="note" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="wOnly" ${wiz.onlyAvail ? "checked" : ""}> Chỉ hiện chỉ thị có tồn khả dụng</label>
            <span class="note" style="margin-left:auto">Đã chọn: <b id="wCount">${s.orders.length}</b> chỉ thị</span>
          </div>
          <div class="chkline chk-head">
            <span style="width:15px"></span>
            <b style="width:96px">Chỉ thị</b><span style="width:20px"></span>
            <span style="width:128px">Quốc gia</span><span style="width:78px">Màu</span>
            <span style="width:104px">Ngày xuất KD</span>
            <span class="num-col">SL đặt hàng KD</span>
            <span class="num-col">SL nhập kho SX</span>
            <span class="num-col">SL thiếu/đủ</span>
            <span class="num-col">Tồn KD</span>
          </div>
          <div class="chk-list" id="wList">
            ${cands.map(o => {
              const avail = o.recvPrs - o.shipPrs;
              const bal = o.recvPrs - o.prs;          /* nhập kho SX so với đặt hàng KD */
              return `<label class="chkline ${s.orders.includes(o.ord) ? "sel" : ""}">
                <input type="checkbox" data-ord="${o.ord}" ${s.orders.includes(o.ord) ? "checked" : ""}>
                <b style="width:96px">${o.ord}</b>
                <span style="width:20px">${Store.hasPacking(o.ord) ? "📦" : ""}</span>
                <span style="width:128px">${U.flag(o.ctry)} ${U.esc(o.ctry)}</span>
                <span class="note" style="width:78px">${o.col}</span>
                <span class="note" style="width:104px">${U.fmtDate(o.d)}</span>
                <span class="num-col">${U.fmt(o.prs)}</span>
                <span class="num-col">${U.fmt(o.recvPrs)}</span>
                <span class="num-col ${bal < 0 ? "neg" : "pos"}">${bal < 0 ? "thiếu " + U.fmt(-bal) : (bal === 0 ? "đủ" : "+" + U.fmt(bal))}</span>
                <span class="num-col ${avail > 0 ? "pos" : "note"}">${U.fmt(avail)}</span>
              </label>`;
            }).join("") || `<div class="note" style="padding:14px">Không có chỉ thị phù hợp — hãy nhập kho trước hoặc bỏ lọc "tồn khả dụng".</div>`}
          </div>
          <div class="note" style="margin-top:6px">Đơn vị: đôi · <b>SL thiếu/đủ</b> = SL nhập kho SX − SL đặt hàng KD · <b>Tồn KD</b> = đã nhập − đã xuất (số còn xuất được)</div>

          <div class="mt" style="display:flex;gap:8px;align-items:center">
            <button class="btn primary" id="wNext">Tải số lượng từ Nhập kho + Packing list →</button>
            <button class="btn" onclick="App.closeModal()">Huỷ</button>
            <span class="note" id="wHint"></span>
          </div>
        </div>`, true);

      const collect = () => {
        s.code = val("wCode"); s.date = val("wDate") || TVS_META.today; s.lgh = val("wLgh");
        s.pkl = val("wPkl"); s.qcNo = val("wQc"); s.driver = val("wDriver"); s.truck = val("wTruck");
        s.seal = val("wSeal"); s.warehouse = val("wWh"); s.receiver = val("wRecv");
        s.dept = val("wDept"); s.receiverAddr = val("wAddr"); s.condition = val("wCond");
      };
      document.getElementById("wSearch").addEventListener("input", e => { collect(); wiz.search = e.target.value; renderWizard(); });
      document.getElementById("wOnly").addEventListener("change", e => { collect(); wiz.onlyAvail = e.target.checked; renderWizard(); });
      document.querySelectorAll("#wList input[type=checkbox]").forEach(c => c.addEventListener("change", () => {
        const ord = c.dataset.ord;
        if (c.checked) { if (!s.orders.includes(ord)) s.orders.push(ord); }
        else s.orders = s.orders.filter(x => x !== ord);
        document.getElementById("wCount").textContent = s.orders.length;
        c.closest(".chkline").classList.toggle("sel", c.checked);
      }));
      document.getElementById("wNext").onclick = () => {
        collect();
        if (!s.orders.length) { document.getElementById("wHint").innerHTML = `<span style="color:var(--bad);font-weight:700">Chọn ít nhất 1 chỉ thị!</span>`; return; }
        App.openModal(`<div class="modal-b" style="text-align:center;padding:56px 20px">
          <div class="spin"></div>
          <div style="font-weight:800;margin-top:16px">Đang tải số lượng thực nhập từ màn hình Nhập kho…</div>
          <div class="note" style="margin-top:6px">Đối chiếu ${s.orders.length} chỉ thị × tồn khả dụng × packing list (thùng nguyên / thùng MIX)</div>
        </div>`);
        setTimeout(() => { buildLines(s); wiz.step = 2; renderWizard(); }, 700);
      };
      return;
    }

    /* ── BƯỚC 2: SL thực xuất theo packing list ── */
    const groups = U.groupBy(s.lines, l => l.ord);
    App.openModal(`
      <div class="modal-h"><h3>${U.esc(s.code)} — số lượng thực xuất</h3>
        <span class="bdg acc plain">${s.orders.length} chỉ thị</span>
        <span class="bdg neu plain">thùng theo packing list</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        ${stepBar}
        <div class="note" style="margin-bottom:10px">Mỗi dòng = 1 nhóm thùng đúng như packing list. Dòng <b>MIX</b> gộp nhiều size trong 1 thùng — xuất nguyên thùng (bật/tắt). SL mặc định = tồn khả dụng.</div>
        <div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="tbl" id="wTbl">
          <thead><tr>
            <th>Chỉ thị</th><th>Size / Quy cách</th><th>Thùng số</th>
            <th class="num">Đôi/thùng</th><th class="num">SL theo PL</th>
            <th class="num">SL đặt hàng KD</th><th class="num">SL nhập kho SX</th><th class="num">SL thiếu / đủ</th>
            <th class="num">Tồn KD</th>
            <th class="num" style="min-width:100px">SL thực xuất</th><th class="num">Carton</th><th>Ghi chú</th>
          </tr></thead>
          <tbody>${[...groups].map(([ord, lines]) => lines.map((l, i) => {
            const o = U.orderByCode(ord);
            const idx = s.lines.indexOf(l);
            const availNow = l.kind === "run" ? U.avail(ord, l.sz) : null;
            /* SL đặt hàng KD & SL nhập kho SX theo size của dòng (dòng MIX = tổng các size trong thùng) */
            const szList = l.kind === "mix" ? Object.keys(l.sizes) : [l.sz];
            const ordQty = U.sum(szList, sz => (o.sizes[sz] ? o.sizes[sz].ordered : 0));
            const recvQty = U.sum(szList, sz => (o.sizes[sz] ? o.sizes[sz].received : 0));
            const bal = recvQty - ordQty;
            return `<tr data-i="${idx}" class="${l.kind === "mix" ? "row-mix" : ""}">
              ${i === 0 ? `<td rowspan="${lines.length}" style="vertical-align:top"><b>${ord}</b> ${Store.hasPacking(ord) ? "📦" : ""}<br>
                <span class="note">${U.flag(l.ctry)} ${U.esc(l.ctry)} · ${l.col}<br>KD ${U.fmtDate(o.d)}</span></td>` : ""}
              <td>${sizeCell(l)}${l.synthetic ? ` <span class="note" title="Đơn chưa có packing list — quy cách chuẩn 6 đôi/thùng">*</span>` : ""}</td>
              <td class="note">${l.from ? (l.from === l.to ? "#" + l.from : `#${l.from}–${l.to}`) : "—"}${l.box ? `<br>${l.box}` : ""}</td>
              <td class="num">${l.perCtn}</td>
              <td class="num">${U.fmt(l.groupPrs)}</td>
              <td class="num">${U.fmt(ordQty)}</td>
              <td class="num">${U.fmt(recvQty)}</td>
              <td class="num ${bal < 0 ? "neg" : "pos"}" title="SL nhập kho SX − SL đặt hàng KD">${bal < 0 ? "−" + U.fmt(-bal) : (bal === 0 ? "đủ" : "+" + U.fmt(bal))}</td>
              <td class="num ${l.kind === "run" ? (availNow > 0 ? "pos" : "") : ""}">${l.kind === "run" ? U.fmt(availNow) : (l.qty > 0 || l.canShip ? `<span class="bdg ok plain">đủ mix</span>` : `<span class="bdg bad plain">thiếu size</span>`)}</td>
              <td class="num">${l.kind === "mix"
                ? `<label style="display:flex;gap:6px;align-items:center;justify-content:flex-end;cursor:pointer">
                     <input type="checkbox" class="mix-cb" ${l.qty > 0 ? "checked" : ""} ${l.qty === 0 && !l.canShip ? "disabled" : ""}>
                     <b class="mix-qty">${U.fmt(l.qty)}</b></label>`
                : `<input class="cell-in" type="number" min="0" max="${l.maxQty}" value="${l.qty}" data-max="${l.maxQty}">`}</td>
              <td class="num ctn-cell">${U.fmt(l.ctn)}</td>
              <td><input class="cell-in note-in" type="text" value="${U.esc(l.note || "")}" placeholder="—"></td>
            </tr>`;
          }).join("")).join("")}</tbody>
          <tfoot><tr>
            ${(() => {
              /* Tổng SL đặt / nhập tính theo từng (chỉ thị + size) DUY NHẤT — tránh
                 đếm trùng khi 1 size nằm ở nhiều nhóm thùng (nguyên / lẻ / mix) */
              const seen = new Set(); let tOrd = 0, tRecv = 0;
              for (const l of s.lines) {
                const o = U.orderByCode(l.ord);
                for (const sz of (l.kind === "mix" ? Object.keys(l.sizes) : [l.sz])) {
                  const k = l.ord + "|" + sz;
                  if (seen.has(k) || !o.sizes[sz]) continue;
                  seen.add(k); tOrd += o.sizes[sz].ordered; tRecv += o.sizes[sz].received;
                }
              }
              const tBal = tRecv - tOrd;
              return `<td colspan="5">TỔNG CỘNG <span class="note">(SL đặt/nhập tính theo size, không trùng lặp)</span></td>
                <td class="num">${U.fmt(tOrd)}</td><td class="num">${U.fmt(tRecv)}</td>
                <td class="num ${tBal < 0 ? "neg" : "pos"}">${tBal < 0 ? "−" + U.fmt(-tBal) : (tBal === 0 ? "đủ" : "+" + U.fmt(tBal))}</td>
                <td></td>`;
            })()}
            <td class="num" id="wSumQty">0</td><td class="num" id="wSumCtn">0</td><td></td>
          </tr></tfoot>
        </table></div>
        <div class="note" style="margin-top:6px">
          <b>SL đặt hàng KD</b> = số đôi khách đặt theo size · <b>SL nhập kho SX</b> = số đôi sản xuất đã nhập kho theo size ·
          <b>SL thiếu / đủ</b> = nhập kho − đặt hàng (số âm = còn thiếu chưa sản xuất đủ) · <b>Tồn KD</b> = đã nhập − đã xuất (số còn xuất được)
        </div>

        <div class="mt" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn" id="wBack">← Quay lại</button>
          <button class="btn" id="wDraft">${App.icon("doc", "ico")} Lưu nháp</button>
          <span style="margin-left:auto;display:flex;gap:8px;align-items:center">
            <label class="note">Ngày thực xuất <input type="date" id="wShipDate" value="${TVS_META.today}" style="margin-left:4px"></label>
            <button class="btn primary" id="wShip">✓ Xác nhận XUẤT KHO</button>
          </span>
        </div>
        <div class="note mt" id="wErr"></div>
      </div>`, true);

    const readLines = () => {
      let bad = null;
      document.querySelectorAll("#wTbl tbody tr").forEach(tr => {
        const l = s.lines[+tr.dataset.i];
        if (!l) return;
        if (l.kind === "mix") {
          const cb = tr.querySelector(".mix-cb");
          l.qty = cb && cb.checked ? l.groupPrs : 0;
          l.ctn = l.qty ? l.groupCtn : 0;
        } else {
          const inp = tr.querySelector("input[type=number]");
          let q = parseInt(inp.value || "0", 10); if (isNaN(q) || q < 0) q = 0;
          const mx = parseInt(inp.dataset.max, 10);
          if (q > mx) bad = `${l.ord} ${l.sz}: thực xuất ${q} vượt tồn khả dụng phân bổ ${mx}`;
          l.qty = q; l.ctn = ctnFor(q, l);
        }
        l.note = tr.querySelector(".note-in").value.trim();
      });
      return { bad };
    };
    const recalc = () => {
      readLines();
      document.getElementById("wSumQty").textContent = U.fmt(U.sum(s.lines, l => l.qty));
      document.getElementById("wSumCtn").textContent = U.fmt(U.sum(s.lines, l => l.ctn));
      document.querySelectorAll("#wTbl tbody tr").forEach(tr => {
        const l = s.lines[+tr.dataset.i]; if (!l) return;
        tr.querySelector(".ctn-cell").textContent = U.fmt(l.ctn);
        const mq = tr.querySelector(".mix-qty"); if (mq) mq.textContent = U.fmt(l.qty);
        const inp = tr.querySelector("input[type=number]");
        if (inp) inp.classList.toggle("bad", (parseInt(inp.value || "0", 10) || 0) > parseInt(inp.dataset.max, 10));
      });
    };
    document.querySelectorAll("#wTbl input").forEach(i => i.addEventListener("input", recalc));
    recalc();

    document.getElementById("wBack").onclick = () => { readLines(); wiz.step = 1; renderWizard(); };
    const save = (thenShip) => {
      const { bad } = readLines();
      const err = document.getElementById("wErr");
      if (bad) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${bad}</span>`; return; }
      const active = s.lines.filter(l => l.qty > 0);
      if (!active.length) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ Chưa có dòng nào có SL thực xuất > 0</span>`; return; }
      const keep = JSON.parse(JSON.stringify(s));
      keep.lines = active;
      keep.orders = U.uniq(active, l => l.ord);
      const saved = Store.saveShipment(keep);
      if (thenShip) {
        const r = Store.confirmShip(saved.id, val("wShipDate") || TVS_META.today);
        if (!r.ok) { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
        App.closeModal();
        App.toast(`✓ Đã xuất kho phiếu <b>${U.esc(keep.code)}</b> — ${U.fmt(U.sum(active, l => l.qty))} đôi = ${U.fmt(U.sum(active, l => l.ctn))} thùng (theo packing list). Ngày thực xuất đã ghi nhận.`, "ok");
      } else {
        App.closeModal();
        App.toast(`Đã lưu phiếu nháp <b>${U.esc(keep.code)}</b>`, "ok");
      }
    };
    document.getElementById("wDraft").onclick = () => save(false);
    document.getElementById("wShip").onclick = () => save(true);
  }

  /* ═════════ HÀNH ĐỘNG TRÊN PHIẾU ═════════ */
  window.Views._pxkConfirm = function (id) {
    const s = Store.getShipment(id); if (!s) return;
    App.openModal(`
      <div class="modal-h"><h3>Xác nhận xuất kho — ${U.esc(s.code)}</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <p style="font-size:13.5px">Xuất <b>${U.fmt(U.sum(s.lines, l => l.qty))} đôi</b> = ${U.fmt(U.sum(s.lines, l => l.ctn))} thùng
        cho <b>${U.esc(s.receiver)}</b> (${s.orders.join(", ")}).</p>
        <div class="frm mt"><label>Ngày thực xuất (ghi nhận đối chiếu đúng hạn)
          <input type="date" id="cShipDate" value="${s.actualDate || TVS_META.today}"></label></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="cGo">✓ Xuất kho & ghi ngày thực xuất</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div><div class="note mt" id="cErr"></div>
      </div>`);
    document.getElementById("cGo").onclick = () => {
      const r = Store.confirmShip(id, val("cShipDate") || TVS_META.today);
      if (!r.ok) { document.getElementById("cErr").innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Phiếu <b>${U.esc(s.code)}</b> đã xuất kho — hệ thống đã ghi ngày thực xuất & cập nhật % đúng hạn`, "ok");
    };
  };
  /* Nhập / sửa NGÀY THỰC XUẤT trực tiếp từ ô trên bảng lệnh giao hàng */
  window.Views._setActual = function (id, iso) {
    const s = Store.getShipment(id); if (!s) return;
    Store.setActualDate(id, iso);
    if (!iso) { App.toast(`Đã xoá ngày thực xuất phiếu <b>${U.esc(s.code)}</b>`, "warn"); return; }
    if (s.status === "shipped")
      App.toast(`✓ Cập nhật ngày thực xuất phiếu <b>${U.esc(s.code)}</b> = ${U.fmtDate(iso)} — đã tính lại tỷ lệ đúng hạn`, "ok");
    else
      App.toast(`Đã lưu ngày thực xuất dự kiến ${U.fmtDate(iso)} cho phiếu nháp <b>${U.esc(s.code)}</b> — bấm “Xuất kho” để ghi nhận chính thức`, "ok");
  };
  window.Views._pxkRevert = function (id) {
    const s = Store.getShipment(id);
    if (s && confirm(`Hủy ghi nhận xuất kho phiếu ${s.code}? Hàng sẽ trả về tồn kho, ngày thực xuất bị xoá.`)) {
      Store.revertShip(id);
      App.toast(`Đã hủy ghi nhận xuất phiếu <b>${U.esc(s.code)}</b> — phiếu về trạng thái nháp`, "warn");
    }
  };
  window.Views._pxkDel = function (id) {
    const s = Store.getShipment(id);
    if (s && confirm(`Xoá phiếu nháp ${s.code}?`)) { Store.deleteShipment(id); App.toast("Đã xoá phiếu nháp", "warn"); }
  };
  window.Views._pxkCSV = function (id) {
    const s = Store.getShipment(id); if (!s) return;
    const rows = [
      ["PHIẾU XUẤT KHO KIÊM LỆNH GIAO HÀNG"],
      ["Số phiếu", s.code, "", "Lệnh GH số", s.lgh, "", "Packing List", s.pkl, "", "Ngày thực xuất", U.fmtDate(s.actualDate)],
      ["Xuất cho", s.receiver, "", "Địa chỉ", s.receiverAddr],
      [],
      ["STT", "Nước xuất", "Chỉ thị Elite/TVS", "PO-Adidas", "Style", "Color", "Size", "Chi tiết mix", "Thùng số", "ĐVT", "SL yêu cầu", "SL thực xuất", "Số carton", "Ghi chú"],
      ...s.lines.map((l, i) => [i + 1, l.ctry, l.ord, l.po, l.style, l.col,
        l.kind === "mix" ? "MIX" : l.sz, l.kind === "mix" ? mixLabel(l) : "",
        l.from ? (l.from === l.to ? "#" + l.from : `#${l.from}–${l.to}`) : "",
        "Đôi", l.groupPrs ?? l.req ?? "", l.qty, l.ctn, l.note || ""]),
      ["TỔNG CỘNG", "", "", "", "", "", "", "", "", "", U.sum(s.lines, l => l.groupPrs ?? l.req ?? 0), U.sum(s.lines, l => l.qty), U.sum(s.lines, l => l.ctn), ""],
    ];
    Store.downloadCSV(s.code + ".csv", rows);
    App.toast("Đã tải phiếu " + s.code + ".csv", "ok");
  };

  /* ═════════ XEM / IN PHIẾU — PHÂN TRANG + Trang i/n ═════════ */
  const info = (l, v) => `<div class="px-row"><div class="px-lab">${l}</div><div class="px-val">${v || "&nbsp;"}</div></div>`;

  function pxkHead(s, cont) {
    return `
      <div class="px-head">
        <div>
          <div class="px-co">${COMPANY.name}</div>
          <div class="px-co-sub">${COMPANY.addrShort}</div>
          <div class="px-co-sub">MST : ${COMPANY.mst}</div>
        </div>
        <div class="px-form-no">
          <b>Mẫu số: 03/XKNB</b><br>
          <span>(Kèm theo Thông tư số 91/2026/TT-BTC ngày 30 tháng 6 năm 2026 của Bộ trưởng Bộ Tài chính)</span>
        </div>
      </div>
      <div class="px-title">PHIẾU XUẤT KHO KIÊM LỆNH GIAO HÀNG${cont ? ` <span style="font-size:12px;font-weight:700">(tiếp theo — ${U.esc(s.code)})</span>` : ""}</div>`;
  }

  function pxkInfoBlock(s) {
    const pos = U.uniq(s.lines, l => l.po).filter(Boolean);
    return `<div class="px-info">
      <div>
        ${info("Công ty/Nhà máy", COMPANY.name)}
        ${info("Địa chỉ", COMPANY.addr)}
        ${info("Mã số thuế", COMPANY.mst)}
        ${info("Số phiếu", `<b>${U.esc(s.code)}</b>`)}
        ${info("Ngày", U.fmtDate(s.date))}
        ${info("Kho xuất", U.esc(s.warehouse))}
        ${info("Bộ phận yêu cầu xuất", U.esc(s.dept))}
        ${info("Lý do xuất", U.esc(s.reason))}
        ${info("Xuất cho", `<b>${U.esc(s.receiver)}</b>`)}
        ${info("Địa chỉ nhận", U.esc(s.receiverAddr))}
      </div>
      <div>
        ${info("Theo lệnh giao hàng số", U.esc(s.lgh))}
        ${info("Theo PO / Work Order", pos.map(U.esc).join("<br>"))}
        ${info("Packing List số", U.esc(s.pkl))}
        ${info("QC Release số", U.esc(s.qcNo))}
        ${info("Thương hiệu", "Adidas")}
        ${info("Trạng thái phiếu", s.status === "shipped" ? "Đã xuất kho" : U.esc(s.approved))}
        ${info("Ngày thực xuất", s.actualDate ? `<b>${U.fmtDate(s.actualDate)}</b>` : "…/…/……")}
        ${info("Người nhận/Tài xế", U.esc(s.driver))}
        ${info("Biển số xe", U.esc(s.truck))}
        ${info("Seal No.", U.esc(s.seal))}
        ${info("Ghi chú tình trạng hàng", U.esc(s.condition))}
      </div>
    </div>`;
  }

  const PX_THEAD = `<thead><tr>
    <th style="width:30px">STT</th><th>Nước xuất</th><th>Chỉ thị Elite/TVS</th><th>PO-Adidas</th>
    <th>Style</th><th>Color</th><th>Size</th><th>ĐVT</th>
    <th>SL yêu cầu</th><th>SL thực xuất</th><th>Số carton</th><th>Ghi chú</th>
  </tr></thead>`;

  function pxkLineRow(l, i) {
    const szTd = l.kind === "mix"
      ? `<td class="c nw"><b>MIX</b><div class="px-mix">${mixLabel(l)}</div></td>`
      : `<td class="c nw">${l.sz}</td>`;
    const noteBits = [];
    if (l.from) noteBits.push(l.from === l.to ? `Thùng #${l.from}` : `Thùng #${l.from}–${l.to}`);
    if (l.kind === "mix") noteBits.push("mix size — nguyên thùng");
    if (l.note) noteBits.push(l.note);
    return `<tr>
      <td class="c">${i + 1}</td><td class="nw">${U.esc(l.ctry)}</td><td class="nw">${l.ord}</td><td class="nw">${U.esc(l.po)}</td>
      <td class="nw">${l.style}</td><td class="nw">${l.col}</td>${szTd}<td class="c nw">Đôi</td>
      <td class="r">${U.fmt(l.groupPrs ?? l.req ?? 0)}</td><td class="r"><b>${U.fmt(l.qty)}</b></td>
      <td class="r">${U.fmt(l.ctn)}</td><td class="nw">${U.esc(noteBits.join(" · "))}</td>
    </tr>`;
  }

  function pxkSignBlock(s) {
    /* Ngày ký tự động = NGÀY THỰC XUẤT của phiếu (nếu đã có) */
    const ngay = s && s.actualDate ? U.fmtDate(s.actualDate) : "…… / …… / ………";
    return `
      <div class="px-sec">XÁC NHẬN</div>
      <table class="px-sign-tbl">
        <tr>${SIGN_ROLES.map(r => `<th>${r}</th>`).join("")}</tr>
        <tr>${SIGN_ROLES.map((r, i) => `<td>
          ${i < SIGN_ROLES.length - 1 ? `<span class="px-ky">(Ký, ghi rõ họ &amp; tên)</span>` : `<span class="px-ky">&nbsp;</span>`}
          <div class="px-sign-space"></div>
          ${i < SIGN_ROLES.length - 1 ? `<i>Ngày: <b>${ngay}</b></i>` : `<i>&nbsp;</i>`}
        </td>`).join("")}</tr>
      </table>`;
  }

  /* ── Hướng giấy in: đứng (portrait) / ngang (landscape) ── */
  function getOrient() {
    try { return localStorage.getItem("TVS_PRINT_ORIENT") === "landscape" ? "landscape" : "portrait"; }
    catch (e) { return "portrait"; }
  }
  function setOrient(o) {
    try { localStorage.setItem("TVS_PRINT_ORIENT", o); } catch (e) {}
  }
  /* Bơm rule @page{size:A4 …} theo lựa chọn — quyết định hướng giấy khi in */
  function applyPageOrient(orient) {
    let st = document.getElementById("pxOrientStyle");
    if (!st) { st = document.createElement("style"); st.id = "pxOrientStyle"; document.head.appendChild(st); }
    st.textContent = `@page{size:A4 ${orient};margin:9mm}`;
  }

  /* Phân trang theo NGÂN SÁCH CHIỀU CAO thật của khổ giấy (mm) — "Trang i/n"
     khớp đúng số tờ máy in báo. Khi trang cuối chỉ còn ít dòng + khối ký mà
     thiếu chỗ → TỰ ĐỘNG CO DÒNG (compact) để vừa đủ trang, không lấn tờ sau. */
  function paginate(rowCount, orient) {
    const H = orient === "landscape" ? 190 : 277;      // vùng in A4 sau lề (trừ hao an toàn)
    const ROW = orient === "landscape" ? 8.5 : 11;     // mm/dòng bình thường
    const ROWC = ROW * 0.72;                            // mm/dòng khi NÉN
    /* Trang 2+ KHÔNG lặp lại header công ty/tiêu đề — chỉ còn dải số phiếu nhỏ */
    const HEAD_FULL = 30, INFO = 78, SEC = 8, THEAD = 8, FOOT = 12, HEAD_CONT = 14;
    const TOTAL = 9, SIGN = 64, TOTALC = 7, SIGNC = 48; // tổng + khối ký (thường / nén) — ô ký to hơn
    const cap1 = H - HEAD_FULL - INFO - SEC - THEAD - FOOT;
    const capN = H - HEAD_CONT - THEAD - FOOT;
    const capOf = i => (i === 0 ? cap1 : capN);
    const max1 = Math.max(1, Math.floor(cap1 / ROW));
    const maxN = Math.max(1, Math.floor(capN / ROW));

    /* 1. Chia thô theo sức chứa từng trang */
    const chunks = [{ s: 0, e: Math.min(rowCount, max1), compact: false }];
    let p = chunks[0].e;
    while (p < rowCount) {
      chunks.push({ s: p, e: Math.min(rowCount, p + maxN), compact: false });
      p = chunks[chunks.length - 1].e;
    }

    /* 2. Trang cuối phải chứa vừa TỔNG + KHỐI KÝ */
    const li = chunks.length - 1;
    const rows = chunks[li].e - chunks[li].s;
    const cap = capOf(li);
    if (rows * ROW + TOTAL + SIGN <= cap) return chunks;                       // vừa ở cỡ thường

    /* 2a. NÉN trang cuối (tự co dòng) */
    if (rows * ROWC + TOTALC + SIGNC <= cap) {
      chunks[li].compact = true;
      return chunks;
    }
    /* 2b. Trang cuối ít dòng → thử GỘP về trang trước rồi nén trang đó */
    if (chunks.length >= 2 && rows <= 6) {
      const prevRows = (chunks[li - 1].e - chunks[li - 1].s) + rows;
      if (prevRows * ROWC + TOTALC + SIGNC <= capOf(li - 1)) {
        chunks[li - 1].e = chunks[li].e;
        chunks[li - 1].compact = true;
        chunks.pop();
        return chunks;
      }
    }
    /* 2c. Bất đắc dĩ: tách trang ký — kéo theo vài dòng cuối để trang ký không trống trơ */
    const moveN = Math.min(4, Math.max(1, rows - 1));
    const cut = chunks[li].e - moveN;
    chunks[li].e = cut;
    chunks.push({ s: cut, e: cut + moveN, compact: false });
    return chunks;
  }

  window.Views._pxkView = function (id, orientArg) {
    const s = Store.getShipment(id); if (!s) return;
    const orient = orientArg || getOrient();
    setOrient(orient); applyPageOrient(orient);

    const totalReq = U.sum(s.lines, l => l.groupPrs ?? l.req ?? 0);
    const totalQty = U.sum(s.lines, l => l.qty), totalCtn = U.sum(s.lines, l => l.ctn);
    const totalRow = `<tr class="px-total"><td colspan="8">TỔNG CỘNG</td>
      <td class="r">${U.fmt(totalReq)}</td><td class="r">${U.fmt(totalQty)}</td>
      <td class="r">${U.fmt(totalCtn)}</td><td></td></tr>`;

    const rowsH = s.lines.map((l, i) => pxkLineRow(l, i));
    const chunks = paginate(rowsH.length, orient);
    const n = chunks.length;
    const hasCompact = chunks.some(c => c.compact);
    const printedAt = U.fmtDate(TVS_META.today);
    const landCls = orient === "landscape" ? " land" : "";

    const pagesHTML = chunks.map((c, pi) => {
      const isFirst = pi === 0, isLast = pi === n - 1;
      const chunk = rowsH.slice(c.s, c.e);
      return `<div class="px-page${landCls}${c.compact ? " compact" : ""}">
        ${isFirst ? pxkHead(s, false) : ""}
        ${isFirst ? pxkInfoBlock(s) : `<div class="px-cont-info">PHIẾU XUẤT KHO <b>${U.esc(s.code)}</b> (tiếp theo — trang ${pi + 1}/${n}) · Lệnh GH: ${U.esc(s.lgh)} · Xuất cho: ${U.esc(s.receiver)}</div>`}
        ${isFirst ? `<div class="px-sec">CHI TIẾT XUẤT KHO</div>` : ""}
        ${(chunk.length || isLast) ? `<table class="px-tbl">${PX_THEAD}<tbody>
          ${chunk.join("")}
          ${isLast ? totalRow : `<tr><td colspan="12" class="px-carry">(còn tiếp trang ${pi + 2}/${n}…)</td></tr>`}
        </tbody></table>` : `<div class="px-carry-d">(chi tiết xuất kho tiếp tục ở trang ${pi + 2}/${n}…)</div>`}
        ${isLast ? pxkSignBlock(s) : ""}
        <div class="px-foot">
          <span>${U.esc(s.code)} · In ngày ${printedAt}</span>
          <span>TVS — hệ thống N-X-T adidas Rubber Boots · A4 ${orient === "landscape" ? "ngang" : "đứng"}</span>
          <span class="px-pageno">Trang ${pi + 1}/${n}</span>
        </div>
      </div>`;
    }).join("");

    App.openModal(`
      <div class="modal-h no-print"><h3>Phiếu xuất kho — ${U.esc(s.code)}</h3>
        ${stBdg(s)}
        <span class="px-orient" title="Chọn hướng giấy in">
          <button class="${orient === "portrait" ? "on" : ""}" onclick="Views._pxkView('${s.id}','portrait')">▯ In đứng</button>
          <button class="${orient === "landscape" ? "on" : ""}" onclick="Views._pxkView('${s.id}','landscape')">▭ In ngang</button>
        </span>
        <span class="bdg neu plain">${n} trang A4 ${orient === "landscape" ? "ngang" : "đứng"}</span>
        ${hasCompact ? `<span class="bdg acc plain" title="Trang cuối ít dòng — hệ thống tự co dòng để vừa đủ trang, không lấn tờ sau">tự co dòng vừa trang</span>` : ""}
        <button class="btn small" style="margin-left:auto" onclick="App.printModal()">${App.icon("print", "ico")} In phiếu (${n} trang)</button>
        <button class="btn small" onclick="Views._pxkCSV('${s.id}')">CSV</button>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b phieu-wrap">${pagesHTML}</div>`, true);
  };
})();
