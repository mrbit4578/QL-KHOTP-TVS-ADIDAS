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
  const flt = { q: "", date: "", from: "", to: "", ord: "", po: "", ctry: "", status: "" };

  function shipPOs(s) {
    const pos = U.uniq((s.lines || []).map(l => l.po || (U.orderByCode(l.ord) || {}).po).filter(Boolean), x => x);
    if (pos.length) return pos;
    return U.uniq((s.orders || []).map(c => (U.orderByCode(c) || {}).po).filter(Boolean), x => x);
  }
  function shipCtries(s) {
    const cs = U.uniq((s.lines || []).map(l => l.ctry || (U.orderByCode(l.ord) || {}).ctry).filter(Boolean), x => x);
    if (cs.length) return cs;
    return U.uniq((s.orders || []).map(c => (U.orderByCode(c) || {}).ctry).filter(Boolean), x => x);
  }
  function filterShipments(ships) {
    const q = flt.q.trim().toLowerCase();
    return ships.filter(s => {
      const effDate = s.actualDate || s.date || "";
      const pos = shipPOs(s);
      const ctries = shipCtries(s);
      const ords = s.orders || [];
      if (flt.date && s.actualDate !== flt.date && s.date !== flt.date) return false;
      if (flt.from && effDate && effDate < flt.from) return false;
      if (flt.to && effDate && effDate > flt.to) return false;
      if (flt.ord && !ords.includes(flt.ord)) return false;
      if (flt.po && !pos.some(p => p.includes(flt.po))) return false;
      if (flt.ctry && !ctries.includes(flt.ctry)) return false;
      if (flt.status === "shipped" && s.status !== "shipped") return false;
      if (flt.status === "draft" && s.status === "shipped") return false;
      if (flt.status === "ontime" || flt.status === "late") {
        if (s.status !== "shipped") return false;
        const anyLate = ords.some(c => { const o = U.orderByCode(c); return o && o.delayDays > 0; });
        if (flt.status === "ontime" && anyLate) return false;
        if (flt.status === "late" && !anyLate) return false;
      }
      if (q) {
        const hay = [
          s.code, s.lgh, s.pkl, s.date, U.fmtDate(s.date), s.actualDate, U.fmtDate(s.actualDate),
          s.receiver, ...ords, ...pos, ...ctries
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

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
    render(root, params) {
      if (params && params.q !== undefined) flt.q = params.q;
      const ships = (window.TVS_SHIPMENTS || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const drafts = ships.filter(s => s.status !== "shipped");
      const done = ships.filter(s => s.status === "shipped");
      const OT = U.ONTIME;
      const PKS = Store.packingStats();

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
          <div class="filters" style="background:var(--soft)">
            <button class="btn primary need-edit" id="btnNew">${App.icon("plus", "ico")} Tạo lệnh giao hàng</button>
            <button class="btn" id="btnTpl">${App.icon("download", "ico")} File mẫu import</button>
            <button class="btn need-edit" id="btnImp">${App.icon("upload", "ico")} Import phiếu từ file</button>
            <button class="btn" id="btnExpAllX" ${done.length ? "" : "disabled"}>${App.icon("download", "ico")} Export nhật ký (.xlsx)</button>
            <button class="btn" id="btnExpAll" ${done.length ? "" : "disabled"}>${App.icon("download", "ico")} Export nhật ký (.csv)</button>
            <button class="btn need-edit" id="btnImpPk" data-testid="pxk-import-packing">${App.icon("upload", "ico")} Import packing list</button>
            <button class="btn" id="btnGoPk" data-testid="pxk-goto-packing">${App.icon("box", "ico")} Màn hình Packing List</button>
            <span class="f-chipcount">Số thùng & dòng MIX size lấy đúng theo <b>PACKING LIST (CLP)</b>:
              ${U.fmt(PKS.orders)} chỉ thị · ${U.fmt(PKS.ctn)} thùng · ${U.fmt(PKS.mix)} nhóm MIX
              (${Object.keys(PKS.byBat).sort().map(b => "đợt " + b).join(" · ")}${PKS.imported ? ` · ${PKS.imported} chỉ thị import` : ""})
              ${PKS.without ? ` · <b>${PKS.without}</b> chỉ thị chưa có packing (tạm tính ${TVS_META.packing} đôi/thùng)` : ""}</span>
          </div>
          ${(() => {
            const allDates = U.uniq(ships.flatMap(s => [s.actualDate, s.date]).filter(Boolean), d => d).sort();
            const allOrds = U.uniq(ships.flatMap(s => s.orders || []), o => o).sort();
            const allPOs = U.uniq(ships.flatMap(s => shipPOs(s)), p => p).sort();
            const allCtries = U.uniq(ships.flatMap(s => shipCtries(s)), c => c).sort();
            return `<div class="filters" style="gap:8px;flex-wrap:wrap">
              <input class="f-input" id="dQ" placeholder="Tìm số phiếu, LGH, chỉ thị, PO, ngày xuất…" value="${U.esc(flt.q)}" style="width:245px">
              <select class="f-select" id="dDate" title="Lọc theo ngày thực xuất / ngày phiếu">
                <option value="">Tất cả ngày xuất (${allDates.length})</option>
                ${allDates.map(d => `<option value="${U.esc(d)}" ${flt.date === d ? "selected" : ""}>Ngày ${U.fmtDate(d)}</option>`).join("")}
              </select>
              <label class="rp-f" style="font-size:12px">Từ <input class="f-input" type="date" id="dFrom" value="${U.esc(flt.from)}" style="width:138px;padding:6px 8px"></label>
              <label class="rp-f" style="font-size:12px">Đến <input class="f-input" type="date" id="dTo" value="${U.esc(flt.to)}" style="width:138px;padding:6px 8px"></label>
              <select class="f-select" id="dOrd" title="Lọc theo mã chỉ thị">
                <option value="">Tất cả chỉ thị (${allOrds.length})</option>
                ${allOrds.map(o => `<option value="${U.esc(o)}" ${flt.ord === o ? "selected" : ""}>${U.esc(o)}</option>`).join("")}
              </select>
              <select class="f-select" id="dPo" title="Lọc theo số PO">
                <option value="">Tất cả PO (${allPOs.length})</option>
                ${allPOs.map(p => `<option value="${U.esc(p)}" ${flt.po === p ? "selected" : ""}>PO ${U.esc(p)}</option>`).join("")}
              </select>
              <select class="f-select" id="dCtry" title="Lọc theo quốc gia">
                <option value="">Tất cả quốc gia (${allCtries.length})</option>
                ${allCtries.map(c => `<option value="${U.esc(c)}" ${flt.ctry === c ? "selected" : ""}>${U.flag(c)} ${U.esc(c)}</option>`).join("")}
              </select>
              <select class="f-select" id="dStatus" title="Lọc theo trạng thái xuất kho">
                <option value="">Mọi trạng thái</option>
                <option value="shipped" ${flt.status === "shipped" ? "selected" : ""}>✓ Đã xuất kho</option>
                <option value="draft" ${flt.status === "draft" ? "selected" : ""}>⏳ Nháp · chờ xuất</option>
                <option value="ontime" ${flt.status === "ontime" ? "selected" : ""}>Đúng / sớm hạn</option>
                <option value="late" ${flt.status === "late" ? "selected" : ""}>Trễ hạn</option>
              </select>
              <button class="btn" id="dReset">Xoá lọc</button>
              <span class="f-chipcount" id="dCount"></span>
            </div>`;
          })()}
          <div id="dShipArea"></div>
          <div class="note" style="padding:6px 18px 8px">Ô <b>Ngày thực xuất</b> nhập trực tiếp tại đây: phiếu đã xuất → tự cập nhật tỷ lệ đúng hạn; phiếu nháp → điền sẵn cho bước “Xuất kho”.</div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Đối chiếu ngày xuất — tỷ lệ đúng hạn theo chỉ thị</h3>
            <span class="sub" id="dOtSub">Ngày thực xuất (phiếu XK) ↔ Ngày xuất KD (đơn đặt hàng)</span></div>
          <div id="dOtArea"></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Nguồn tính số thùng — Packing List (CLP)</h3>
            <span class="sub">đợt 1–3 nhúng sẵn · các đợt 4, 5, 6… chỉ cần import theo mẫu là tự mapping</span></div>
          <div class="tbl-wrap"><table class="tbl" data-testid="pxk-packing-table">
            <thead><tr><th>Đợt đặt hàng</th><th class="num">Chỉ thị có PL</th><th class="num">Số đôi</th>
              <th class="num">Số thùng</th><th class="num">Nhóm thùng</th><th class="num">Nhóm MIX</th><th>Nguồn</th></tr></thead>
            <tbody>${Object.keys(PKS.byBat).map(Number).sort((a, b) => a - b).map(b => {
              const x = PKS.byBat[b];
              return `<tr>
                <td><b>${b ? "đợt " + b : "—"}</b></td>
                <td class="num">${U.fmt(x.orders)}</td>
                <td class="num">${U.fmt(x.prs)}</td>
                <td class="num">${U.fmt(x.ctn)}</td>
                <td class="num">${U.fmt(x.groups)}</td>
                <td class="num">${x.mix ? U.fmt(x.mix) : "—"}</td>
                <td>${x.seed ? `<span class="bdg neu plain">${x.seed} gốc</span> ` : ""}${x.imported ? `<span class="bdg acc plain">${x.imported} import</span>` : ""}</td>
              </tr>`;
            }).join("")}</tbody>
            <tfoot><tr><td>TỔNG</td><td class="num">${U.fmt(PKS.orders)}</td><td class="num">${U.fmt(PKS.prs)}</td>
              <td class="num">${U.fmt(PKS.ctn)}</td><td class="num">${U.fmt(PKS.groups)}</td>
              <td class="num">${U.fmt(PKS.mix)}</td><td></td></tr></tfoot>
          </table></div>
          <div class="note" style="padding:10px 18px">Bấm <b>“Import packing list”</b> trên thanh công cụ để nạp packing list đợt mới
            (.xlsx sheet CLP hoặc .csv theo mẫu) — hệ thống tự tách thùng nguyên / thùng lẻ / thùng MIX SIZE và dùng ngay cho phiếu xuất kho.
            ${PKS.without ? `Hiện còn <b>${PKS.without}</b> chỉ thị chưa có packing list — tạm tính ${TVS_META.packing} đôi/thùng (đánh dấu * trên phiếu).` : ""}</div>
        </div>`;

      const renderDeliveryTables = () => {
        const FS = filterShipments(ships);
        const totPrs = U.sum(FS, s => U.sum(s.lines, l => l.qty));
        const totCtn = U.sum(FS, s => U.sum(s.lines, l => l.ctn));
        const cntEl = document.getElementById("dCount");
        if (cntEl) {
          cntEl.innerHTML = `<b>${U.fmt(FS.length)}</b> / ${U.fmt(ships.length)} phiếu · <b>${U.fmt(totPrs)} đôi</b> · <b>${U.fmt(totCtn)} thùng</b>`;
        }
        const shipArea = document.getElementById("dShipArea");
        if (shipArea) {
          shipArea.innerHTML = `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Số phiếu</th><th>Lệnh GH số</th><th>Ngày phiếu</th><th>Chỉ thị</th><th>PO</th><th>Xuất cho</th>
              <th class="num">Số đôi</th><th class="num">Số thùng</th><th>Trạng thái</th>
              <th style="min-width:158px">Ngày thực xuất</th><th>Hành động</th>
            </tr></thead>
            <tbody>${FS.length ? FS.map(s => {
              const pos = shipPOs(s);
              const ctries = shipCtries(s);
              return `<tr>
                <td><b>${U.esc(s.code)}</b></td>
                <td class="mono">${U.esc(s.lgh)}</td>
                <td>${U.fmtDate(s.date)}</td>
                <td>${s.orders.map(c => {
                  const o = U.orderByCode(c);
                  return `<span class="bdg neu plain clickable" onclick="Views._openOrder('${c}')" title="${o ? U.esc(o.ctry + " · PO " + o.po) : ""}">${o ? U.flag(o.ctry) + " " : ""}${c}</span>`;
                }).join(" ")}</td>
                <td class="mono">${pos.length ? pos.map(U.esc).join(", ") : "—"}</td>
                <td class="note" style="max-width:190px;overflow:hidden;text-overflow:ellipsis" title="${U.esc(s.receiver)}">${ctries.map(c => U.flag(c)).join(" ")} ${U.esc(s.receiver)}</td>
                <td class="num"><b>${U.fmt(U.sum(s.lines, l => l.qty))}</b></td>
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
                    : `<button class="btn small need-edit" onclick="Views._pxkEditInfo('${s.id}')" title="Sửa thông tin vận chuyển: Tài xế, Biển số, Seal, QC Release, Số phiếu…">Sửa TT</button>
                       <button class="btn small" onclick="Views._pxkCSV('${s.id}')">CSV</button>
                       <button class="btn small danger need-edit" onclick="Views._pxkRevert('${s.id}')">Hủy xuất</button>`}
                </td>
              </tr>`;
            }).join("") : `
              <tr><td colspan="11" style="text-align:center;padding:28px" class="note">
                ${ships.length ? "Không có phiếu xuất kho nào khớp bộ lọc hiện tại." : "Chưa có lệnh giao hàng nào. Bấm <b>“Tạo lệnh giao hàng”</b> → chọn các chỉ thị cần xuất."}</td></tr>`}
            </tbody>
            <tfoot><tr>
              <td colspan="6">TỔNG CỘNG (${U.fmt(FS.length)} phiếu)</td>
              <td class="num">${U.fmt(totPrs)}</td>
              <td class="num">${U.fmt(totCtn)}</td>
              <td colspan="3"></td>
            </tr></tfoot>
          </table></div>`;
        }

        const otArea = document.getElementById("dOtArea");
        if (otArea) {
          if (!OT.n) {
            otArea.innerHTML = `<div class="card-b note">Chưa có chỉ thị nào ghi nhận ngày thực xuất. Sau khi bấm <b>“Xuất kho”</b> trên phiếu, hệ thống ghi ngày thực xuất và tự đối chiếu với "Ngày xuất KD" để tính % đúng hạn tại đây.</div>`;
          } else {
            const matchedOrds = new Set(FS.flatMap(s => s.orders || []));
            const otOrders = OT.orders.filter(o => matchedOrds.has(o.ord));
            const onTimeN = otOrders.filter(o => o.onTime).length;
            const rate = otOrders.length ? onTimeN / otOrders.length : 0;
            const otSub = document.getElementById("dOtSub");
            if (otSub) otSub.textContent = `Ngày thực xuất (phiếu XK) ↔ Ngày xuất KD (đơn đặt hàng) — ${otOrders.length} chỉ thị`;
            otArea.innerHTML = `<div class="tbl-wrap"><table class="tbl">
              <thead><tr>
                <th>Chỉ thị</th><th>PO</th><th>Quốc gia</th><th>Ngày xuất KD</th><th>Ngày thực xuất</th>
                <th class="num">SL đặt</th><th class="num">Đã xuất</th><th class="num">% xuất</th>
                <th class="num">Chênh (ngày)</th><th>Kết quả</th>
              </tr></thead>
              <tbody>${otOrders.length ? otOrders.map(o => `
                <tr>
                  <td class="clickable" onclick="Views._openOrder('${o.ord}')"><b>${o.ord}</b></td>
                  <td class="mono">${U.esc(o.po || "—")}</td>
                  <td>${U.flag(o.ctry)} ${U.esc(o.ctry)}</td>
                  <td>${U.fmtDate(o.d)}</td>
                  <td><b>${U.fmtDate(o.lastShipDate)}</b></td>
                  <td class="num">${U.fmt(o.prs)}</td>
                  <td class="num">${U.fmt(o.shipPrs)}</td>
                  <td class="num">${U.fmtPct(o.shipPrs / o.prs, 0)}</td>
                  <td class="num ${o.delayDays > 0 ? "neg" : "pos"}">${o.delayDays > 0 ? "+" : ""}${o.delayDays}</td>
                  <td>${onTimeBdg(o)}${o.shipPrs < o.prs ? ` <span class="bdg neu plain">xuất một phần</span>` : ""}</td>
                </tr>`).join("") : `<tr><td colspan="10" class="note" style="text-align:center;padding:18px">Không có chỉ thị đã xuất nào khớp bộ lọc.</td></tr>`}</tbody>
              <tfoot><tr>
                <td colspan="5">TỶ LỆ ĐÚNG HẠN (${otOrders.length} chỉ thị)</td>
                <td class="num">${U.fmt(U.sum(otOrders, o => o.prs))}</td>
                <td class="num">${U.fmt(U.sum(otOrders, o => o.shipPrs))}</td>
                <td class="num" colspan="3">${onTimeN}/${otOrders.length} chỉ thị = <b>${otOrders.length ? U.fmtPct(rate, 0) : "—"}</b></td>
              </tr></tfoot>
            </table></div>`;
          }
        }
      };

      const bindEv = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
      bindEv("dQ", "input", e => { flt.q = e.target.value; renderDeliveryTables(); });
      bindEv("dDate", "change", e => { flt.date = e.target.value; renderDeliveryTables(); });
      bindEv("dFrom", "change", e => { flt.from = e.target.value; renderDeliveryTables(); });
      bindEv("dTo", "change", e => { flt.to = e.target.value; renderDeliveryTables(); });
      bindEv("dOrd", "change", e => { flt.ord = e.target.value; renderDeliveryTables(); });
      bindEv("dPo", "change", e => { flt.po = e.target.value; renderDeliveryTables(); });
      bindEv("dCtry", "change", e => { flt.ctry = e.target.value; renderDeliveryTables(); });
      bindEv("dStatus", "change", e => { flt.status = e.target.value; renderDeliveryTables(); });
      bindEv("dReset", "click", () => {
        Object.assign(flt, { q: "", date: "", from: "", to: "", ord: "", po: "", ctry: "", status: "" });
        this.render(root);
      });
      renderDeliveryTables();

      document.getElementById("btnNew").onclick = () => openWizard(null);
      document.getElementById("btnTpl").onclick = () => { Store.templateShipments(); App.toast("Đã tải file mẫu MAU_IMPORT_PHIEU_XUAT_KHO.csv", "ok"); };
      document.getElementById("btnImp").onclick = importShipFile;
      document.getElementById("btnImpPk").onclick = () => Views._packingImport();
      document.getElementById("btnGoPk").onclick = () => { location.hash = "#/packing"; };
      const expAllX = document.getElementById("btnExpAllX");
      if (expAllX) expAllX.onclick = () => {
        const expShips = filterShipments(TVS_SHIPMENTS.filter(x => x.status === "shipped"));
        Store.exportShipmentsXLSX(expShips, "NHAT_KY_XUAT_KHO_TVS.xlsx");
        App.toast(`Đã xuất nhật ký xuất kho (${expShips.length} phiếu · .xlsx)`, "ok");
      };
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
    const expShips = filterShipments(TVS_SHIPMENTS.filter(x => x.status === "shipped"));
    for (const s of expShips)
      for (const l of s.lines) {
        const o = U.orderByCode(l.ord);
        rows.push([s.code, s.lgh, U.fmtDate(s.date), U.fmtDate(s.actualDate), l.ord, l.ctry, l.po, l.style, l.col,
          l.kind === "mix" ? "MIX" : l.sz, l.kind === "mix" ? mixLabel(l) : "",
          l.from ? (l.from === l.to ? "#" + l.from : `#${l.from}–${l.to}`) : "",
          l.groupPrs ?? l.req ?? "", l.qty, l.ctn, o ? U.fmtDate(o.d) : "", o && s.actualDate <= o.d ? "Đúng hạn" : "Trễ"]);
      }
    Store.downloadCSV("NHAT_KY_XUAT_KHO_TVS.csv", rows);
    App.toast(`Đã xuất nhật ký xuất kho (${expShips.length} phiếu · CSV)`, "ok");
  }

  /* ═════════ WIZARD TẠO / SỬA PHIẾU ═════════ */
  function newShipment() {
    return {
      id: null, code: "", lgh: "", pkl: "", qcNo: "",
      date: U.todayISO ? U.todayISO() : TVS_META.today, actualDate: null, status: "draft",
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

  /* Sinh dòng phiếu từ PACKING LIST của các chỉ thị đã chọn.
     Bảo toàn SL tùy chỉnh (qty) và ghi chú (note) của các dòng đã lưu khi sửa phiếu nháp. */
  function buildLines(s) {
    const prevLines = Array.isArray(s.lines) ? s.lines.slice() : [];
    const prevOrds = new Set(prevLines.map(p => p.ord));
    const usedPrev = new Set();
    const findPrev = (ord, g, sz) => {
      const kind = g.mix ? "mix" : "run";
      let m = prevLines.find(p => !usedPrev.has(p) && p.ord === ord && p.kind === kind && p.gi !== undefined && p.gi === g.gi);
      if (!m) {
        m = prevLines.find(p => !usedPrev.has(p) && p.ord === ord && p.kind === kind &&
          (g.mix || p.sz === sz) && (p.from || null) === (g.from || null) && (p.to || null) === (g.to || null));
      }
      if (!m && !g.mix) {
        m = prevLines.find(p => !usedPrev.has(p) && p.ord === ord && p.kind === "run" && p.sz === sz);
      }
      if (m) usedPrev.add(m);
      return m;
    };

    const lines = [];
    for (const ord of s.orders) {
      const o = U.orderByCode(ord); if (!o) continue;
      const hadOrdBefore = prevOrds.has(ord);
      const rem = {};
      U.SIZES.forEach(sz => { rem[sz] = U.avail(ord, sz); });
      for (const g of Store.packingGroups(ord)) {
        const base = {
          ord, ctry: o.ctry, po: o.po, style: TVS_META.itemCode, col: o.col.split(",")[0].trim(),
          perCtn: g.perCtn, groupPrs: g.prs, groupCtn: g.ctn, from: g.from, to: g.to,
          box: g.box || "", gi: g.gi, synthetic: !!g.synthetic, note: "",
        };
        if (g.mix) {
          const prev = findPrev(ord, g, null);
          const can = Object.entries(g.sizes).every(([sz, q]) => (rem[sz] || 0) >= q);
          const wantShip = prev ? (prev.qty > 0 && can) : (hadOrdBefore ? false : can);
          if (wantShip) Object.entries(g.sizes).forEach(([sz, q]) => { rem[sz] -= q; });
          lines.push({
            ...base, note: (prev && prev.note) || "",
            kind: "mix", sizes: { ...g.sizes },
            qty: wantShip ? g.prs : 0, ctn: wantShip ? g.ctn : 0, canShip: can,
          });
        } else {
          const sz = Object.keys(g.sizes)[0];
          const prev = findPrev(ord, g, sz);
          const maxTake = Math.max(0, Math.min(rem[sz] || 0, g.prs));
          const take = prev
            ? Math.max(0, Math.min(typeof prev.qty === "number" ? prev.qty : maxTake, maxTake))
            : (hadOrdBefore ? 0 : maxTake);
          rem[sz] = (rem[sz] || 0) - take;
          lines.push({
            ...base, note: (prev && prev.note) || "",
            kind: "run", sz, qty: take, ctn: ctnFor(take, base), maxQty: maxTake,
          });
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
          <div class="chk-list" id="wList"></div>
          <div class="note" style="margin-top:6px">Đơn vị: đôi · <b>SL thiếu/đủ</b> = SL nhập kho SX − SL đặt hàng KD · <b>Tồn KD</b> = đã nhập − đã xuất (số còn xuất được)</div>

          <div class="mt" style="display:flex;gap:8px;align-items:center">
            <button class="btn primary" id="wNext">${s.lines && s.lines.length ? "Tiếp tục chỉnh số lượng thực xuất →" : "Tải số lượng từ Nhập kho + Packing list →"}</button>
            <button class="btn" onclick="App.closeModal()">Huỷ</button>
            <span class="note" id="wHint"></span>
          </div>
        </div>`, true);

      const collect = () => {
        s.code = val("wCode"); s.date = val("wDate") || (U.todayISO ? U.todayISO() : TVS_META.today); s.lgh = val("wLgh");
        s.pkl = val("wPkl"); s.qcNo = val("wQc"); s.driver = val("wDriver"); s.truck = val("wTruck");
        s.seal = val("wSeal"); s.warehouse = val("wWh"); s.receiver = val("wRecv");
        s.dept = val("wDept"); s.receiverAddr = val("wAddr"); s.condition = val("wCond");
      };
      const renderCandList = () => {
        const q = wiz.search.trim().toLowerCase();
        const cands = U.ORDER_INDEX.filter(o =>
          (!wiz.onlyAvail || (o.recvPrs - o.shipPrs) > 0 || s.orders.includes(o.ord)) &&
          (!q || o.ord.toLowerCase().includes(q) || o.ctry.toLowerCase().includes(q) || (o.po || "").toLowerCase().includes(q)));
        const listEl = document.getElementById("wList");
        if (!listEl) return;
        listEl.innerHTML = cands.map(o => {
          const avail = o.recvPrs - o.shipPrs;
          const bal = o.recvPrs - o.prs;
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
        }).join("") || `<div class="note" style="padding:14px">Không có chỉ thị phù hợp — hãy nhập kho trước hoặc bỏ lọc "tồn khả dụng".</div>`;
        listEl.querySelectorAll("input[type=checkbox]").forEach(c => c.addEventListener("change", () => {
          const ord = c.dataset.ord;
          if (c.checked) { if (!s.orders.includes(ord)) s.orders.push(ord); }
          else s.orders = s.orders.filter(x => x !== ord);
          const cnt = document.getElementById("wCount");
          if (cnt) cnt.textContent = s.orders.length;
          c.closest(".chkline").classList.toggle("sel", c.checked);
        }));
      };
      renderCandList();
      document.getElementById("wSearch").addEventListener("input", e => { wiz.search = e.target.value; renderCandList(); });
      document.getElementById("wOnly").addEventListener("change", e => { wiz.onlyAvail = e.target.checked; renderCandList(); });
      document.getElementById("wNext").onclick = () => {
        collect();
        if (!s.orders.length) { document.getElementById("wHint").innerHTML = `<span style="color:var(--bad);font-weight:700">Chọn ít nhất 1 chỉ thị!</span>`; return; }
        if (s.lines && s.lines.length) {
          buildLines(s); wiz.step = 2; renderWizard();
          return;
        }
        App.openModal(`<div class="modal-b" style="text-align:center;padding:56px 20px">
          <div class="spin"></div>
          <div style="font-weight:800;margin-top:16px">Đang tải số lượng thực nhập từ màn hình Nhập kho…</div>
          <div class="note" style="margin-top:6px">Đối chiếu ${s.orders.length} chỉ thị × tồn khả dụng × packing list (thùng nguyên / thùng MIX)</div>
        </div>`);
        setTimeout(() => { buildLines(s); wiz.step = 2; renderWizard(); }, 350);
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
            <label class="note">Ngày thực xuất <input type="date" id="wShipDate" value="${s.actualDate || (U.todayISO ? U.todayISO() : TVS_META.today)}" style="margin-left:4px"></label>
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
  /* Sửa nhanh thông tin hành chính / vận chuyển của phiếu (Tài xế, Biển số, Seal, QC Release, Số phiếu…)
     mà không cần hủy xuất kho hay tạo lại dòng hàng */
  window.Views._pxkEditInfo = function (id, fromPreview) {
    const s = Store.getShipment(id); if (!s) return;
    App.openModal(`
      <div class="modal-h"><h3>Sửa thông tin vận chuyển & phiếu — ${U.esc(s.code)}</h3>
        ${stBdg(s)}
        <button class="modal-x" onclick="${fromPreview ? `Views._pxkView('${s.id}')` : `App.closeModal()`}">✕</button></div>
      <div class="modal-b">
        <div class="note" style="margin-bottom:12px">Cập nhật thông tin hành chính, tài xế, biển số xe, số Seal, QC Release… mà <b>không làm thay đổi số lượng hàng hóa</b> hay trạng thái xuất kho của phiếu.</div>
        <div class="frm grid g-3" style="gap:10px">
          <label>Số phiếu<input id="eiCode" value="${U.esc(s.code)}"></label>
          <label>Ngày phiếu<input id="eiDate" type="date" value="${s.date || ""}"></label>
          <label>Ngày thực xuất<input id="eiActual" type="date" value="${s.actualDate || ""}"></label>
          <label>Lệnh giao hàng số<input id="eiLgh" value="${U.esc(s.lgh)}"></label>
          <label>Packing List số<input id="eiPkl" value="${U.esc(s.pkl)}"></label>
          <label>QC Release số<input id="eiQc" value="${U.esc(s.qcNo)}" placeholder="—"></label>
          <label>Người nhận / Tài xế<input id="eiDriver" value="${U.esc(s.driver)}" placeholder="Họ tên tài xế"></label>
          <label>Biển số xe<input id="eiTruck" value="${U.esc(s.truck)}" placeholder="60C-xxxxx"></label>
          <label>Seal No.<input id="eiSeal" value="${U.esc(s.seal)}" placeholder="—"></label>
          <label>Kho xuất<input id="eiWh" value="${U.esc(s.warehouse)}"></label>
          <label style="grid-column:span 2">Xuất cho<input id="eiRecv" value="${U.esc(s.receiver)}"></label>
          <label>Bộ phận yêu cầu<input id="eiDept" value="${U.esc(s.dept)}"></label>
          <label style="grid-column:1/-1">Địa chỉ nhận<input id="eiAddr" value="${U.esc(s.receiverAddr)}"></label>
          <label style="grid-column:1/-1">Ghi chú tình trạng hàng<input id="eiCond" value="${U.esc(s.condition)}"></label>
        </div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn primary" id="eiSave">✓ Lưu thông tin phiếu</button>
          <button class="btn" onclick="${fromPreview ? `Views._pxkView('${s.id}')` : `App.closeModal()`}">Huỷ</button>
        </div>
      </div>`);
    document.getElementById("eiSave").onclick = () => {
      const r = Store.updateShipmentMeta(id, {
        code: val("eiCode") || s.code,
        date: val("eiDate") || s.date,
        actualDate: val("eiActual") || null,
        lgh: val("eiLgh"),
        pkl: val("eiPkl"),
        qcNo: val("eiQc"),
        driver: val("eiDriver"),
        truck: val("eiTruck"),
        seal: val("eiSeal"),
        warehouse: val("eiWh"),
        receiver: val("eiRecv"),
        dept: val("eiDept"),
        receiverAddr: val("eiAddr"),
        condition: val("eiCond"),
      });
      if (!r || !r.ok) return;
      App.toast(`✓ Đã cập nhật thông tin phiếu <b>${U.esc(r.s.code)}</b>`, "ok");
      if (fromPreview) Views._pxkView(id);
      else App.closeModal();
    };
  };

  window.Views._pxkConfirm = function (id) {
    const s = Store.getShipment(id); if (!s) return;
    const defDate = s.actualDate || (U.todayISO ? U.todayISO() : TVS_META.today);
    App.openModal(`
      <div class="modal-h"><h3>Xác nhận xuất kho — ${U.esc(s.code)}</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <p style="font-size:13.5px">Xuất <b>${U.fmt(U.sum(s.lines, l => l.qty))} đôi</b> = ${U.fmt(U.sum(s.lines, l => l.ctn))} thùng
        cho <b>${U.esc(s.receiver)}</b> (${s.orders.join(", ")}).</p>
        <div class="frm mt"><label>Ngày thực xuất (ghi nhận đối chiếu đúng hạn)
          <input type="date" id="cShipDate" value="${defDate}"></label></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="cGo">✓ Xuất kho & ghi ngày thực xuất</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div><div class="note mt" id="cErr"></div>
      </div>`);
    document.getElementById("cGo").onclick = () => {
      const r = Store.confirmShip(id, val("cShipDate") || defDate);
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
        ${info("Theo PO / Work Order", pos.map(U.esc).join(", "))}
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

  /* Phân trang ĐO DOM THẬT theo đúng kích thước vùng in A4 (mm → px):
     - Đo chiều cao thực tế của khối thông tin đầu trang 1 (.px-info có thể giãn
       khi nhiều PO / địa chỉ dài) → không bao giờ bị tràn hoặc mất dòng cuối trang 1.
     - Đo chiều cao thực tế từng dòng bảng (dòng thường ~6.1mm, dòng MIX 2 dòng ~9.6mm)
       bằng tổng vi sai toạ độ (telescopic sum) → lấp đầy trang 2, 3… sát chân trang,
       triệt tiêu khoảng trắng thừa.
     - Trang cuối tự kiểm tra vừa TỔNG CỘNG + XÁC NHẬN ở chế độ thường / nén (compact)
       hoặc tách trang hợp lý. */
  const PROBE_CSS = `
    #pxmPage,#pxmPage *{box-sizing:border-box;margin:0;padding:0}
    #pxmPage{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111;font-size:12px;line-height:1.45;background:#fff}
    #pxmPage .px-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
    #pxmPage .px-co{font-weight:800;font-size:13px}
    #pxmPage .px-co-sub{font-size:11px;color:#333}
    #pxmPage .px-form-no{text-align:right;font-size:10.2px;max-width:330px;color:#333}
    #pxmPage .px-title{text-align:center;font-size:19px;font-weight:800;letter-spacing:.02em;margin:14px 0 12px}
    #pxmPage .px-title span{font-size:12px;font-weight:700}
    #pxmPage .px-info{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
    #pxmPage .px-row{display:flex;border-bottom:1px dotted #c9ced6;padding:3.5px 0;gap:8px}
    #pxmPage .px-lab{width:158px;flex-shrink:0;font-weight:700;color:#333;font-size:11.2px}
    #pxmPage .px-val{flex:1;font-size:11.8px}
    #pxmPage .px-cont-info{font-size:11.5px;color:#333;border:1px dotted #c9ced6;border-radius:6px;padding:6px 10px;margin-bottom:8px}
    #pxmPage .px-sec{font-weight:800;font-size:12.5px;margin:14px 0 6px;letter-spacing:.04em}
    #pxmPage .px-tbl{width:100%;border-collapse:collapse;font-size:11px}
    #pxmPage .px-tbl th,#pxmPage .px-tbl td{border:1px solid #6b7280;padding:3.5px 5px;text-align:left}
    #pxmPage .px-tbl th{background:#f1f3f6;font-size:10px;text-transform:uppercase;letter-spacing:.02em;text-align:center}
    #pxmPage .px-tbl .c{text-align:center}#pxmPage .px-tbl .r{text-align:right;font-variant-numeric:tabular-nums}
    #pxmPage .px-tbl .nw{white-space:nowrap}
    #pxmPage .px-tbl .px-total td{font-weight:800;background:#f7f8fa}
    #pxmPage .px-carry td{text-align:right!important;color:#667085;font-style:italic}
    #pxmPage .px-mix{font-size:9.6px;font-weight:600;color:#333;white-space:nowrap}
    #pxmPage .px-sign-tbl{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
    #pxmPage .px-sign-tbl th{background:#1f4e79;color:#fff;font-size:10.8px;font-weight:800;letter-spacing:.02em;border:1px solid #16385a;padding:5px 4px;text-align:left}
    #pxmPage .px-sign-tbl td{border:1px solid #9aa3b2;border-top:0;vertical-align:top;padding:7px 8px 6px;font-size:10.6px}
    #pxmPage .px-sign-tbl .px-ky{color:#555;font-style:italic}
    #pxmPage .px-sign-tbl .px-sign-space{height:92px}
    #pxmPage .px-sign-tbl i{font-style:normal;color:#111;display:block;border-top:1px dotted #c9ced6;padding-top:4px}
    #pxmPage .px-foot{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #c9ced6;padding-top:6px;font-size:10.2px;color:#555}
    #pxmPage.compact .px-tbl th{padding:2.5px 4px;font-size:9.4px}
    #pxmPage.compact .px-tbl td{padding:2px 4px;font-size:10px}
    #pxmPage.compact .px-mix{font-size:8.8px}
    #pxmPage.compact .px-sign-tbl th{padding:3.5px 4px;font-size:10px}
    #pxmPage.compact .px-sign-tbl td{padding:3px 5px;font-size:9.6px}
    #pxmPage.compact .px-sign-tbl .px-sign-space{height:64px}
    #pxmPage.compact .px-sec{margin:8px 0 4px}
    #pxmPage.compact .px-cont-info{padding:4px 8px;margin-bottom:5px}
  `;

  function paginateByDOM(s, rowsH, totalRow, orient) {
    const rowCount = rowsH.length;
    if (!rowCount) return [{ s: 0, e: 0, compact: false }];

    const land = orient === "landscape";
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;left:-10000px;top:0;width:${land ? "279mm" : "192mm"};visibility:hidden;pointer-events:none;z-index:-1`;
    probe.innerHTML = `<style>${PROBE_CSS}</style>
      <div id="pxmRef" style="height:${land ? "189mm" : "276mm"}"></div>
      <div id="pxmPage">
        <div id="pxmTop1" style="display:flex;flex-direction:column">${pxkHead(s, false)}${pxkInfoBlock(s)}<div class="px-sec">CHI TIẾT XUẤT KHO</div></div>
        <div id="pxmTopN" style="display:flex;flex-direction:column"><div class="px-cont-info">PHIẾU XUẤT KHO <b>${U.esc(s.code)}</b> (tiếp theo — trang 9/9) · Lệnh GH: ${U.esc(s.lgh)} · Xuất cho: ${U.esc(s.receiver)}</div></div>
        <table class="px-tbl" id="pxmTbl">${PX_THEAD}<tbody>${rowsH.join("")}${totalRow}<tr id="pxmCarry" class="px-carry"><td colspan="12">(còn tiếp trang 9/9…)</td></tr></tbody></table>
        <div id="pxmSign" style="display:flex;flex-direction:column">${pxkSignBlock(s)}</div>
        <div class="px-foot" id="pxmFoot">
          <span>${U.esc(s.code)} · In ngày 01/01/2026</span>
          <span>TVS — hệ thống N-X-T adidas Rubber Boots · A4 ${land ? "ngang" : "đứng"}</span>
          <span class="px-pageno">Trang 9/9</span>
        </div>
      </div>`;
    document.body.appendChild(probe);

    const pageEl = probe.querySelector("#pxmPage");
    const pageH = probe.querySelector("#pxmRef").getBoundingClientRect().height;
    const top1El = probe.querySelector("#pxmTop1");
    const topNEl = probe.querySelector("#pxmTopN");
    const tblEl = probe.querySelector("#pxmTbl");
    const signEl = probe.querySelector("#pxmSign");
    const footEl = probe.querySelector("#pxmFoot");

    function measure(compact) {
      pageEl.classList.toggle("compact", !!compact);
      const footH = footEl.getBoundingClientRect().height;
      const top1H = top1El.getBoundingClientRect().height;
      const topNH = topNEl.getBoundingClientRect().height;
      const signH = signEl.getBoundingClientRect().height;
      const tRect = tblEl.getBoundingClientRect();
      const trs = tblEl.tBodies[0].rows;
      const theadH = trs.length ? (trs[0].getBoundingClientRect().top - tRect.top) : tblEl.tHead.getBoundingClientRect().height;
      const rowH = new Float64Array(rowCount);
      for (let i = 0; i < rowCount; i++) {
        rowH[i] = trs[i + 1].getBoundingClientRect().top - trs[i].getBoundingClientRect().top;
      }
      const totalH = (trs[rowCount + 1].getBoundingClientRect().top - trs[rowCount].getBoundingClientRect().top) + 1;
      const cRect = trs[rowCount + 1].getBoundingClientRect();
      const carryH = cRect.bottom - cRect.top;
      /* Trừ 8px khoảng đệm trên footer + 6px dự phòng sai số làm tròn khi in */
      const usableH = pageH - footH - 14;
      return { usableH, top1H, topNH, theadH, rowH, totalH, carryH, signH };
    }

    const M = measure(false);
    const MC = measure(true);
    probe.remove();

    const pref = new Float64Array(rowCount + 1);
    const prefC = new Float64Array(rowCount + 1);
    for (let i = 0; i < rowCount; i++) {
      pref[i + 1] = pref[i] + M.rowH[i];
      prefC[i + 1] = prefC[i] + MC.rowH[i];
    }
    const sumR = (m, sIdx, eIdx) => (m === MC ? prefC[eIdx] - prefC[sIdx] : pref[eIdx] - pref[sIdx]);
    const bodyCap = (m, pi) => m.usableH - (pi === 0 ? m.top1H : m.topNH) - m.theadH;

    /* 1. Chia dòng tuần tự theo chiều cao đo thật của từng trang */
    const chunks = [];
    let p = 0;
    while (p < rowCount) {
      const pi = chunks.length;
      const cap = bodyCap(M, pi);
      if (sumR(M, p, rowCount) + M.totalH <= cap) {
        chunks.push({ s: p, e: rowCount, compact: false });
        break;
      }
      const maxDataH = cap - M.carryH;
      let e = p;
      while (e < rowCount && sumR(M, p, e + 1) <= maxDataH) e++;
      if (e === p) e = p + 1;
      chunks.push({ s: p, e, compact: false });
      p = e;
    }

    /* 2. Kiểm tra trang cuối chứa TỔNG CỘNG + KHỐI KÝ XÁC NHẬN */
    const li = chunks.length - 1;
    const sIdx = chunks[li].s, eIdx = chunks[li].e;
    const rows = eIdx - sIdx;

    /* 2a. Nếu trang cuối chỉ lẻ vài dòng (<= 5), ưu tiên thử gộp về trang trước ở chế độ nén */
    if (chunks.length >= 2 && rows <= 5) {
      const prevS = chunks[li - 1].s;
      if (sumR(MC, prevS, eIdx) + MC.totalH + MC.signH <= bodyCap(MC, li - 1)) {
        chunks[li - 1].e = eIdx;
        chunks[li - 1].compact = true;
        chunks.pop();
        return chunks;
      }
    }

    /* 2b. Trang cuối vừa ở cỡ thường */
    if (sumR(M, sIdx, eIdx) + M.totalH + M.signH <= bodyCap(M, li)) return chunks;

    /* 2c. Trang cuối vừa khi bật chế độ nén (compact) */
    if (sumR(MC, sIdx, eIdx) + MC.totalH + MC.signH <= bodyCap(MC, li)) {
      chunks[li].compact = true;
      return chunks;
    }

    /* 2d. Không đủ chỗ cho khối ký → giữ tối đa dòng ở trang hiện tại + đẩy vài dòng cuối sang trang ký */
    const minMove = Math.min(3, Math.max(1, rows - 1));
    const maxKeepEnd = eIdx - minMove;
    const maxDataH = bodyCap(M, li) - M.carryH;
    let cut = sIdx;
    while (cut < maxKeepEnd && sumR(M, sIdx, cut + 1) <= maxDataH) cut++;
    if (cut === sIdx) cut = Math.min(eIdx - 1, sIdx + 1);
    chunks[li].e = cut;
    const needCompactLast = (sumR(M, cut, eIdx) + M.totalH + M.signH > bodyCap(M, li + 1)) &&
                            (sumR(MC, cut, eIdx) + MC.totalH + MC.signH <= bodyCap(MC, li + 1));
    chunks.push({ s: cut, e: eIdx, compact: needCompactLast });
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
    const chunks = paginateByDOM(s, rowsH, totalRow, orient);
    const n = chunks.length;
    const hasCompact = chunks.some(c => c.compact);
    const printedAt = U.fmtDate(U.todayISO ? U.todayISO() : TVS_META.today);
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
          ${isLast ? totalRow : `<tr class="px-carry"><td colspan="12" class="px-carry">(còn tiếp trang ${pi + 2}/${n}…)</td></tr>`}
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
        <button class="btn small need-edit" style="margin-left:auto" onclick="Views._pxkEditInfo('${s.id}', true)" title="Sửa thông tin phiếu, tài xế, biển số xe, seal…">✎ Sửa TT</button>
        <button class="btn small primary" onclick="App.printModal()">${App.icon("print", "ico")} In phiếu (${n} trang)</button>
        <button class="btn small" onclick="Views._pxkCSV('${s.id}')">CSV</button>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b phieu-wrap">${pagesHTML}</div>`, true);
  };
})();
