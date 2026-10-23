/* ═══════════════════════════════════════════════════════════════════
   views/warehouse.js — WMS · NHẬP KHO THÀNH PHẨM (sheet ChitietNK)
   Từng ngày sản xuất xong → đóng thùng → nhập kho, đối chiếu đơn đặt
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const st = { q: "", rd: "", from: "", to: "", ord: "", po: "", ctry: "", editedOnly: "" };

  function filterReceipts(allRows) {
    const q = st.q.trim().toLowerCase();
    return allRows.filter(r => {
      if (st.rd && r.rd !== st.rd && r.rdLabel !== st.rd) return false;
      if (st.from && r.rd && r.rd < st.from) return false;
      if (st.to && r.rd && r.rd > st.to) return false;
      if (st.ord && r.ord !== st.ord) return false;
      if (st.po && r.po !== st.po) return false;
      if (st.ctry && r.ctry !== st.ctry) return false;
      if (st.editedOnly === "1") {
        const info = Store.receiptEditInfo ? Store.receiptEditInfo(r.rdLabel, r.ord) : null;
        if (!info || !info.rev) return false;
      }
      if (q) {
        const hay = `${r.rdLabel || ""} ${r.rd || ""} ${r.ord || ""} ${r.po || ""} ${r.ctry || ""} ${r.col || ""} ${r.notProduced || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  window.Views.warehouse = {
    title: "Nhập kho thành phẩm · WMS",
    render(root, params) {
      if (params && params.q !== undefined) st.q = params.q;
      const R = TVS_RECEIPTS;
      const totPrs = U.sum(R, r => r.prs), totCtn = U.sum(R, r => r.ctn);
      const shortIn = U.sum(R.filter(r => r.diff < 0), r => -r.diff);
      const notProd = U.SHORTAGES.filter(s => s.type === "chưa sản xuất");
      const notProdQty = U.sum(notProd, s => s.qty);
      const qcDoneCount = R.filter(r => r.qcQty > 0 || r.qcDate).length;
      const qcPendCount = R.length - qcDoneCount;
      const events = [...U.groupBy(R, r => r.rdLabel)].map(([lab, rows]) => {
        const ords = U.uniq(rows, r => r.ord);
        const ctries = U.uniq(rows, r => r.ctry);
        const cols = U.uniq(rows, r => r.col);
        const planExps = U.uniq(rows, r => r.planExp).filter(Boolean).sort();
        return {
          lab, rows, ords, ctries, cols,
          prs: U.sum(rows, r => r.prs), ctn: U.sum(rows, r => r.ctn),
          ord: rows[0].ord, ctry: rows[0].ctry, col: rows[0].col,
          planExp: rows[0].planExp, planExps,
          short: U.sum(rows.filter(r => r.diff < 0), r => -r.diff),
          notes: [...new Set(rows.map(r => r.notProduced).filter(Boolean))],
        };
      });
      const ordList = U.uniq(R, r => r.ord);
      const dateRangeSub = events.length
        ? (events.length === 1 ? events[0].lab : `${events[0].lab} → ${events[events.length - 1].lab}`)
        : "chưa có dữ liệu";

      root.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div class="filters" style="background:var(--soft)">
            <button class="btn primary need-edit" id="rAdd">${App.icon("plus", "ico")} Nhập kho mới</button>
            <button class="btn" id="rTpl">${App.icon("download", "ico")} File mẫu import</button>
            <button class="btn need-edit" id="rImp">${App.icon("upload", "ico")} Import từ file</button>
            <button class="btn" id="rExpX">${App.icon("download", "ico")} Export (.xlsx)</button>
            <button class="btn" id="rExp">${App.icon("download", "ico")} Export (.csv)</button>
            <button class="btn need-edit" id="rBulkQC" title="Xác nhận kiểm đếm QC cho các dòng nhập kho đang hiển thị">✓ Duyệt QC các dòng đang lọc</button>
            <button class="btn" id="rEditLog">⟲ Nhật ký sửa / xóa nhập kho (${Store.receiptEditSummary ? Store.receiptEditSummary().total : 0})</button>
            <span class="f-chipcount">Số thùng tự động mapping từ Packing List (CLP) theo chỉ thị + size</span>
          </div>
          ${(() => {
            const si = Store.seedReceiptInfo();
            const c = Store.counts();
            const es = Store.receiptEditSummary ? Store.receiptEditSummary() : { total: 0, edited: [], deleted: [] };
            return `<div class="filters" style="border-bottom:0;gap:10px;flex-wrap:wrap">
              <span class="bdg ${si.off ? "warn" : "ok"}">Dữ liệu gốc: ${si.off ? "ĐANG TẮT" : "đang dùng"}</span>
              <span class="note">Đang hiệu lực: <b>${U.fmt(R.length)} dòng size · ${U.fmt(totPrs)} đôi · ${U.fmt(totCtn)} thùng (mapping CLP)</b>
                (Gốc: ${si.groups} nhóm / ${U.fmt(si.prs)} đôi · Đã sửa SL: <b>${es.edited.length} nhóm</b> · Đã xóa: <b>${es.deleted.length} nhóm</b>).</span>
              <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
                ${si.off
                  ? `<button class="btn small primary need-edit" id="rSeedOn">↺ Dùng lại dữ liệu gốc</button>`
                  : `<button class="btn small need-edit" id="rSeedOff">Bỏ dùng dữ liệu gốc</button>`}
                <button class="btn small need-edit" id="rResetSeed">↺ Khôi phục gốc ban đầu</button>
                <button class="btn small danger need-edit" id="rClearAll">${App.icon("trash", "ico")} Xoá sạch nhập kho</button>
              </span>
            </div>`;
          })()}
        </div>
        <div class="grid g-kpi">
          <div class="card kpi kpi-acc"><div class="k-lab">${App.icon("box")}<span>Tổng đã nhập kho</span></div>
            <div class="k-val">${U.fmt(totPrs)} <small>đôi</small></div>
            <div class="k-sub">${U.fmt(totCtn)} thùng carton (theo CLP)</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("calendar")}<span>Ngày nhập kho</span></div>
            <div class="k-val">${events.length}</div><div class="k-sub">${U.esc(dateRangeSub)}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("clip")}<span>Đơn hàng đã lên kho</span></div>
            <div class="k-val">${ordList.length} <small>/ ${U.ORDER_INDEX.length} đơn</small></div>
            <div class="k-sub">${ordList.length <= 5 ? ordList.join(" · ") : `${ordList.slice(0, 4).join(" · ")} … (+${ordList.length - 4} đơn)`}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("alert")}<span>Thiếu khi nhập</span></div>
            <div class="k-val" style="color:${shortIn ? "var(--bad)" : "var(--ok)"}">${shortIn ? "−" + U.fmt(shortIn) : "0"} <small>đôi</small></div>
            <div class="k-sub">trên các size đã nhập kho</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("gear")}<span>Chưa sản xuất</span></div>
            <div class="k-val" style="color:${notProdQty ? "var(--warn)" : "var(--ok)"}">${U.fmt(notProdQty)} <small>đôi</small></div>
            <div class="k-sub">${notProd.length ? notProd.slice(0, 4).map(s => s.ord + ": " + s.sz + "=" + s.qty).join(" · ") + (notProd.length > 4 ? ` (+${notProd.length - 4})` : "") : "Tất cả size đã lên kho"}</div></div>
          <div class="card kpi"><div class="k-lab">${App.icon("check")}<span>Kiểm đếm QC</span></div>
            <div class="k-val" style="color:${qcPendCount ? "var(--txt)" : "var(--ok)"}">${U.fmt(qcDoneCount)}/${U.fmt(R.length)}</div>
            <div class="k-sub">${qcPendCount ? `${U.fmt(qcPendCount)} dòng chờ kiểm · bấm “✓ Duyệt QC” để xác nhận` : "✓ Đã kiểm đếm QC 100% dòng nhập kho"}</div></div>
        </div>

        <div class="grid g-32 mt">
          <div class="card">
            <div class="card-h"><h3>Nhật ký nhập kho theo ngày (${events.length} mốc ngày)</h3><span class="sub">timeline sản xuất → đóng thùng → nhập</span></div>
            <div class="card-b" style="max-height:360px;overflow:auto"><div class="tl">
              ${events.map(ev => `
                <div class="tl-item ${ev.short ? "late" : "done"}">
                  <div class="tl-dot"></div>
                  <div class="tl-date">${U.esc(ev.lab)}</div>
                  <div class="tl-main">
                    ${ev.ords.length === 1
                      ? `<b>${U.flag(ev.ctry)} ${ev.ord}</b> · ${U.esc(ev.ctry)} · màu ${ev.col}`
                      : `<b>${ev.ords.length} chỉ thị:</b> ${ev.ords.map(code => `<span class="clickable" onclick="Views._openOrder('${code}')"><b>${code}</b></span>`).join(", ")} · ${ev.ctries.map(c => U.flag(c) + " " + U.esc(c)).join(", ")}`}<br>
                    Nhập <b>${U.fmt(ev.prs)} đôi</b> = <b>${U.fmt(ev.ctn)} thùng</b> ·
                    xuất KD ${ev.planExps.length <= 1 ? U.fmtDate(ev.planExp) : `${U.fmtDate(ev.planExps[0])} → ${U.fmtDate(ev.planExps[ev.planExps.length - 1])}`}
                    <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">
                      ${ev.short ? `<span class="bdg bad">thiếu khi nhập −${U.fmt(ev.short)} đôi</span>` : `<span class="bdg ok">đủ theo size đã nhập</span>`}
                      ${ev.notes.map(n => `<span class="bdg warn">chưa SX: ${U.esc(n)}</span>`).join("")}
                    </div>
                  </div>
                </div>`).join("")}
            </div></div>
          </div>

          <div class="card">
            <div class="card-h"><h3>Quy cách đóng thùng (Mapping CLP) & mã hàng</h3></div>
            <div class="card-b">
              <div class="grid g-2">
                <div class="card" style="box-shadow:none">
                  <div class="card-b" style="padding:14px">
                    <div class="note">MÃ HÀNG (ARTICLE)</div>
                    <div style="font-size:22px;font-weight:800;font-family:var(--mono)">${TVS_META.itemCode}</div>
                    <div class="note">adidas Rubber Boots — thành phẩm</div>
                  </div>
                </div>
                <div class="card" style="box-shadow:none">
                  <div class="card-b" style="padding:14px">
                    <div class="note">MAPPING THÙNG TỪ PACKING LIST (CLP)</div>
                    <div style="font-size:20px;font-weight:800">Tự động theo CLP</div>
                    <div class="note">Tham chiếu trực tiếp từ <b>Packing List (CLP)</b> theo từng chỉ thị + size (5–6 đôi/thùng + thùng lẻ + thùng MIX SIZE)</div>
                  </div>
                </div>
              </div>
              <div class="mt legend">
                <span class="l-i"><span class="sw" style="background:var(--ok)"></span>Nhập đủ so với đặt</span>
                <span class="l-i"><span class="sw" style="background:var(--bad)"></span>Thiếu khi nhập (tổng đã nhập của size &lt; SL đặt)</span>
                <span class="l-i"><span class="sw" style="background:var(--warn)"></span>Size chưa sản xuất (cột SL thiếu chưa sx)</span>
              </div>
              <div class="note mt">Đầu vào nhập kho không cần cột số thùng — hệ thống tự động mapping chính xác số thùng của từng chỉ thị &amp; từng size từ trang <b>Packing List · CLP</b>. Các lần sửa/xóa số lượng nhập kho đều đã được cập nhật trực tiếp vào tổng N-X-T và lưu đầy đủ trong <b>Nhật ký sửa / xóa nhập kho</b>.</div>
            </div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Ma trận nhập kho theo ngày</h3>
            <span class="sub">hiển thị đúng định dạng file mẫu "chi tiet nhap kho theo ngay.xlsx" — 1 dòng = 1 ngày × 1 chỉ thị</span></div>
          ${(() => {
            const dates = [...new Map(R.map(r => [r.rd || r.rdLabel, { rd: r.rd || r.rdLabel, label: r.rdLabel }])).values()]
              .sort((a, b) => String(a.rd).localeCompare(String(b.rd)));
            const ords = U.uniq(R, r => r.ord).sort();
            const pos = U.uniq(R, r => r.po).filter(Boolean).sort();
            const ctries = U.uniq(R, r => r.ctry).sort();
            return `<div class="filters" style="gap:8px;flex-wrap:wrap">
              <input class="f-input" id="wQ" placeholder="Tìm chỉ thị, PO, ngày NK, quốc gia…" value="${U.esc(st.q)}" style="width:230px">
              <select class="f-select" id="wDate" title="Lọc theo ngày nhập kho">
                <option value="">Tất cả ngày NK (${dates.length})</option>
                ${dates.map(d => `<option value="${U.esc(d.rd)}" ${st.rd === d.rd ? "selected" : ""}>Ngày ${U.esc(d.label)}</option>`).join("")}
              </select>
              <label class="rp-f" style="font-size:12px">Từ <input class="f-input" type="date" id="wFrom" value="${U.esc(st.from)}" style="width:138px;padding:6px 8px"></label>
              <label class="rp-f" style="font-size:12px">Đến <input class="f-input" type="date" id="wTo" value="${U.esc(st.to)}" style="width:138px;padding:6px 8px"></label>
              <select class="f-select" id="wOrd" title="Lọc theo mã chỉ thị / đơn hàng">
                <option value="">Tất cả chỉ thị (${ords.length})</option>
                ${ords.map(o => `<option value="${U.esc(o)}" ${st.ord === o ? "selected" : ""}>${U.esc(o)}</option>`).join("")}
              </select>
              <select class="f-select" id="wPo" title="Lọc theo số PO">
                <option value="">Tất cả PO (${pos.length})</option>
                ${pos.map(p => `<option value="${U.esc(p)}" ${st.po === p ? "selected" : ""}>PO ${U.esc(p)}</option>`).join("")}
              </select>
              <select class="f-select" id="wCtry" title="Lọc theo quốc gia">
                <option value="">Tất cả quốc gia (${ctries.length})</option>
                ${ctries.map(c => `<option value="${U.esc(c)}" ${st.ctry === c ? "selected" : ""}>${U.flag(c)} ${U.esc(c)}</option>`).join("")}
              </select>
              <select class="f-select" id="wEd" title="Lọc dòng đã chỉnh sửa">
                <option value="">Mọi trạng thái</option>
                <option value="1" ${st.editedOnly === "1" ? "selected" : ""}>✎ Chỉ dòng đã sửa SL</option>
              </select>
              <button class="btn" id="wReset">Xoá lọc</button>
              <span class="f-chipcount" id="wCount"></span>
            </div>`;
          })()}
          <div id="wMtxArea"></div>
          <div class="note" style="padding:10px 18px">Import file .xlsx/.csv theo đúng mẫu này — hệ thống tự unpivot từng size thành dòng chi tiết bên dưới và mapping PO/màu/SL đặt/đợt/ngày xuất KD từ đơn hàng. Mỗi dòng có thể <b>Sửa số lượng</b> hoặc <b>Xóa</b> — mỗi lần sửa hệ thống ghi lại số lần sửa &amp; lý do (bấm “Lịch sử”).</div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>Chi tiết thành phẩm nhập kho — đủ 17 cột theo file gốc</h3>
            <span class="sub" id="wDtlSub">CHI TIẾT THÀNH PHẨM ADIDAS NHẬP KHO</span></div>
          <div id="wDtlArea"></div>
        </div>`;

      const renderTables = () => {
        const FR = filterReceipts(R);
        const fPrs = U.sum(FR, r => r.prs), fCtn = U.sum(FR, r => r.ctn);
        const fShortIn = U.sum(FR.filter(r => r.diff < 0), r => -r.diff);
        const days = [...U.groupBy(FR, r => r.rdLabel + "|" + r.ord)];
        Views._mtx = days.map(([k, rows]) => ({ rdLabel: rows[0].rdLabel, ord: rows[0].ord }));

        const cntEl = document.getElementById("wCount");
        if (cntEl) {
          cntEl.innerHTML = `<b>${U.fmt(days.length)}</b> dòng ma trận (${U.fmt(FR.length)} dòng size) · <b>${U.fmt(fPrs)} đôi</b> · <b>${U.fmt(fCtn)} thùng</b>`;
        }
        const dtlSub = document.getElementById("wDtlSub");
        if (dtlSub) {
          dtlSub.textContent = `CHI TIẾT THÀNH PHẨM ADIDAS NHẬP KHO — ${U.fmt(FR.length)} dòng · ${U.fmt(fPrs)} đôi · ${U.fmt(fCtn)} thùng`;
        }

        const mtxArea = document.getElementById("wMtxArea");
        if (mtxArea) {
          mtxArea.innerHTML = `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Ngày Nhập Kho</th><th>Ghi chú</th><th>Quốc gia</th><th>Chỉ thị</th><th>PO</th>
              <th>Mã hàng</th><th>Màu sắc</th>
              ${U.SIZES.map(s => `<th class="num">${s.replace("UK ", "")}</th>`).join("")}
              <th class="num">Tổng đôi</th><th class="num">Thùng</th><th>QC kiểm</th><th>Lần sửa</th><th>Thao tác</th>
            </tr></thead>
            <tbody>${!days.length
              ? `<tr><td colspan="${12 + U.SIZES.length}" class="note" style="text-align:center;padding:18px">Không tìm thấy dòng nhập kho nào khớp bộ lọc hiện tại.</td></tr>`
              : days.map(([k, rows], gi) => {
                const r0 = rows[0];
                const bySz = {};
                rows.forEach(r => bySz[r.sz] = (bySz[r.sz] || 0) + r.prs);
                const notes = [...new Set(rows.map(r => r.notProduced).filter(Boolean))];
                const info = Store.receiptEditInfo ? Store.receiptEditInfo(r0.rdLabel, r0.ord) : null;
                const rev = info ? info.rev : 0;
                const lastLog = info && info.log && info.log.length ? info.log[info.log.length - 1] : null;
                const qcDate = r0.qcDate || (info && info.qcDate) || null;
                return `<tr${rev ? ' class="row-edited"' : ''}>
                  <td><b>${U.esc(r0.rdLabel)}</b></td>
                  <td>${notes.length ? `<span class="bdg warn plain">${notes.map(U.esc).join("; ")}</span>` : "—"}</td>
                  <td>${U.flag(r0.ctry)} ${U.esc(r0.ctry)}</td>
                  <td class="clickable" onclick="Views._openOrder('${r0.ord}')"><b>${r0.ord}</b></td>
                  <td class="mono">${U.esc(r0.po)}</td>
                  <td class="mono">${r0.item}</td>
                  <td>${U.colorCell(r0.col)}</td>
                  ${U.SIZES.map(s => `<td class="num">${bySz[s] ? U.fmt(bySz[s]) : ""}</td>`).join("")}
                  <td class="num"><b>${U.fmt(U.sum(rows, r => r.prs))}</b></td>
                  <td class="num">${U.fmt(U.sum(rows, r => r.ctn))}</td>
                  <td>${qcDate
                    ? `<span class="bdg ok plain clickable" title="Đã kiểm QC ngày ${U.fmtDate(qcDate)} — bấm để đổi/hủy" onclick="Views._mtxToggleQC(${gi})">✓ ${U.fmtDate(qcDate)}</span>`
                    : `<button class="btn small need-edit" title="Xác nhận đã kiểm đếm QC dòng này" onclick="Views._mtxToggleQC(${gi})">✓ QC</button>`}</td>
                  <td>${rev
                    ? `<span class="bdg acc plain clickable" title="${lastLog ? U.esc("Lần " + rev + " · " + lastLog.by + " · " + lastLog.reason) : ""}" onclick="Views._mtxHistory(${gi})">✎ ${rev} lần</span>`
                    : `<span class="note">—</span>`}</td>
                  <td style="white-space:nowrap">
                    <button class="btn small need-edit" onclick="Views._mtxEdit(${gi})">${App.icon("gear", "ico")} Sửa</button>
                    <button class="btn small danger need-edit" onclick="Views._mtxDelete(${gi})">${App.icon("trash", "ico")}</button>
                    ${rev ? `<button class="btn small" onclick="Views._mtxHistory(${gi})">Lịch sử</button>` : ""}
                  </td>
                </tr>`;
              }).join("")}</tbody>
            <tfoot><tr>
              <td colspan="7">TỔNG CỘNG (${U.fmt(days.length)} dòng)</td>
              ${U.SIZES.map(s => `<td class="num">${U.fmt(U.sum(FR.filter(r => r.sz === s), r => r.prs)) === "0" ? "" : U.fmt(U.sum(FR.filter(r => r.sz === s), r => r.prs))}</td>`).join("")}
              <td class="num">${U.fmt(fPrs)}</td><td class="num">${U.fmt(fCtn)}</td><td colspan="3"></td>
            </tr></tfoot>
          </table></div>`;
        }

        const dtlArea = document.getElementById("wDtlArea");
        if (dtlArea) {
          dtlArea.innerHTML = `<div class="tbl-wrap"><table class="tbl">
            <thead><tr>
              <th>Ngày NK</th><th>Quốc gia</th><th>Đơn hàng</th><th>PO</th><th>Mã hàng</th>
              <th>Màu</th><th>Size</th><th class="num">Số đôi</th><th class="num">Số thùng</th>
              <th class="num">SL kiểm</th><th>Ngày kiểm</th><th class="num">SL đơn đặt</th>
              <th class="num">Thiếu/Đủ</th><th>Đợt</th><th>Ngày thực xuất</th><th>Ngày xuất KD</th><th>SL thiếu chưa SX</th><th>Nguồn</th>
            </tr></thead>
            <tbody>${!FR.length
              ? `<tr><td colspan="18" class="note" style="text-align:center;padding:18px">Không có dòng chi tiết nào khớp bộ lọc.</td></tr>`
              : FR.map(r => `
              <tr${r._edited ? ' class="row-edited"' : ''}>
                <td><b>${U.esc(r.rdLabel)}</b></td>
                <td>${U.flag(r.ctry)} ${U.esc(r.ctry)}</td>
                <td class="clickable" onclick="Views._openOrder('${r.ord}')"><b>${r.ord}</b></td>
                <td class="mono">${U.esc(r.po)}</td>
                <td class="mono">${r.item}</td>
                <td>${U.colorCell(r.col)}</td>
                <td><b>${r.sz}</b></td>
                <td class="num">${U.fmt(r.prs)}</td>
                <td class="num">${U.fmt(r.ctn)}</td>
                <td class="num ${r.qcQty ? "pos" : "note"}">${r.qcQty ? U.fmt(r.qcQty) : "chờ kiểm"}</td>
                <td class="${r.qcDate ? "" : "note"}">${r.qcDate ? U.fmtDate(r.qcDate) : "—"}</td>
                <td class="num">${U.fmt(r.ordered)}</td>
                <td class="num ${r.diff < 0 ? "neg" : "pos"}">${r.diff > 0 ? "+" : ""}${U.fmt(r.diff)}</td>
                <td>Đợt ${r.bat}</td>
                <td class="note">${(() => { const o = U.orderByCode(r.ord); return o && o.lastShipDate ? "<b>" + U.fmtDate(o.lastShipDate) + "</b>" : "chưa xuất"; })()}</td>
                <td>${U.fmtDate(r.planExp)}</td>
                <td>${r.notProduced ? `<span class="bdg warn">${U.esc(r.notProduced)}</span>` : "—"}</td>
                <td>${r._edited ? `<span class="bdg acc plain">đã sửa (${r._rev}×)</span> ` : ""}${r._id
                  ? `<span class="bdg acc plain">${r._src === "import" ? "import" : "nhập tay"}</span>
                     <button class="btn small danger need-edit" title="Xoá dòng" onclick="if(confirm('Xoá dòng nhập kho ${r.ord} ${r.sz}?')){Store.removeReceiptRow('${r._id}');App.toast('Đã xoá dòng nhập kho bổ sung','warn')}">✕</button>`
                  : `<span class="note">Excel gốc</span>`}</td>
              </tr>`).join("")}</tbody>
            <tfoot><tr>
              <td colspan="7">TỔNG NHẬP KHO (${U.fmt(FR.length)} dòng)</td>
              <td class="num">${U.fmt(fPrs)}</td><td class="num">${U.fmt(fCtn)}</td>
              <td colspan="2"></td>
              <td class="num">${U.fmt(U.sum(FR, r => r.ordered))}</td>
              <td class="num neg">${fShortIn ? "−" + U.fmt(fShortIn) : "0"}</td>
              <td colspan="5"></td>
            </tr></tfoot>
          </table></div>`;
        }
      };

      const bindEv = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
      bindEv("wQ", "input", e => { st.q = e.target.value; renderTables(); });
      bindEv("wDate", "change", e => { st.rd = e.target.value; renderTables(); });
      bindEv("wFrom", "change", e => { st.from = e.target.value; renderTables(); });
      bindEv("wTo", "change", e => { st.to = e.target.value; renderTables(); });
      bindEv("wOrd", "change", e => { st.ord = e.target.value; renderTables(); });
      bindEv("wPo", "change", e => { st.po = e.target.value; renderTables(); });
      bindEv("wCtry", "change", e => { st.ctry = e.target.value; renderTables(); });
      bindEv("wEd", "change", e => { st.editedOnly = e.target.value; renderTables(); });
      bindEv("wReset", "click", () => {
        Object.assign(st, { q: "", rd: "", from: "", to: "", ord: "", po: "", ctry: "", editedOnly: "" });
        this.render(root, {});
      });
      renderTables();

      const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
      bind("rSeedOff", () => {
        if (confirm("Bỏ dùng dữ liệu nhập kho GỐC?\n\nSố liệu gốc sẽ được ẩn khỏi hệ thống (chỉ còn dữ liệu bạn nhập/import). Có thể bật lại bất cứ lúc nào."))
        { Store.setSeedReceipts(false); App.toast("Đã bỏ dùng dữ liệu gốc — hệ thống chỉ dùng dữ liệu bạn nhập/import", "warn"); }
      });
      bind("rSeedOn", () => { Store.setSeedReceipts(true); App.toast("✓ Đã dùng lại dữ liệu nhập kho gốc", "ok"); });
      bind("rResetSeed", () => {
        if (confirm("Khôi phục dữ liệu nhập kho về GỐC BAN ĐẦU?\n\nSẽ xoá toàn bộ dòng bạn đã nhập/import và mọi chỉnh sửa/xoá đã ghi."))
        { Store.resetReceiptsToSeed(); App.toast("✓ Đã khôi phục dữ liệu nhập kho gốc ban đầu", "ok"); }
      });
      bind("rClearAll", () => {
        if (confirm("XOÁ SẠCH toàn bộ dữ liệu nhập kho (kể cả dữ liệu gốc)?\n\nDùng khi bạn muốn nạp lại một bộ dữ liệu mới hoàn toàn từ file. Có thể khôi phục gốc lại sau."))
        { Store.clearAllReceipts(); App.toast("Đã xoá sạch dữ liệu nhập kho — hãy Import file để nạp bộ dữ liệu mới", "warn"); }
      });
      bind("rEditLog", () => Views._whEditLogModal());
      bind("rBulkQC", () => {
        const groups = Views._mtx || [];
        if (!groups.length) { App.toast("Không có dòng nhập kho nào đang hiển thị để duyệt QC", "warn"); return; }
        const iso = prompt(`Xác nhận đã kiểm đếm QC (SL kiểm = SL nhập) cho ${groups.length} nhóm dòng đang lọc.\nNhập ngày kiểm QC (YYYY-MM-DD, để trống để xóa trạng thái QC):`, U.todayISO ? U.todayISO() : TVS_META.today);
        if (iso === null) return;
        const r = Store.setBulkReceiptsQC(groups, iso.trim() || null);
        if (r && r.ok) App.toast(iso.trim() ? `✓ Đã xác nhận kiểm đếm QC cho ${r.count} nhóm dòng (ngày ${U.fmtDate(iso.trim())})` : `Đã xoá trạng thái QC của ${r.count} nhóm dòng`, "ok");
      });
      document.getElementById("rAdd").onclick = openAddReceipt;
      document.getElementById("rTpl").onclick = () => { Store.templateReceipts(); App.toast("Đã tải file mẫu theo ngày (cột size 3→10). Hệ thống nhận cả file .xlsx gốc lẫn .csv theo mẫu này", "ok"); };
      document.getElementById("rImp").onclick = importReceipts;
      bind("rExpX", () => {
        const expRows = filterReceipts(TVS_RECEIPTS);
        Store.exportReceiptsXLSX(expRows, "CHI_TIET_NHAP_KHO_TVS.xlsx");
        App.toast(`Đã export ${U.fmt(expRows.length)} dòng nhập kho (.xlsx — 2 sheet)`, "ok");
      });
      document.getElementById("rExp").onclick = () => {
        const expRows = filterReceipts(TVS_RECEIPTS);
        Store.downloadCSV("NHAP_KHO_TVS.csv", [
          ["Ngày NK", "Quốc gia", "Đơn hàng", "PO", "Mã hàng", "Màu", "Size", "Số đôi", "Số thùng", "SL kiểm", "Ngày kiểm", "SL đơn đặt", "Thiếu/Đủ", "Đợt", "Ngày xuất KD", "Ghi chú chưa SX"],
          ...expRows.map(r => [r.rdLabel, r.ctry, r.ord, r.po, r.item, r.col, r.sz, r.prs, r.ctn,
            r.qcQty ?? "", r.qcDate ? U.fmtDate(r.qcDate) : "", r.ordered, r.diff, r.bat, U.fmtDate(r.planExp), r.notProduced || ""])]);
        App.toast(`Đã export ${expRows.length} dòng nhập kho (CSV)`, "ok");
      };
    }
  };

  /* ── NHẬP LIỆU: phiếu nhập kho mới theo chỉ thị ── */
  function openAddReceipt() {
    const cands = U.ORDER_INDEX.filter(o => o.recvPrs < o.prs);
    App.openModal(`
      <div class="modal-h"><h3>${App.icon("plus", "ico")} Nhập kho thành phẩm — sản xuất xong, đóng thùng</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="frm grid g-3" style="gap:10px">
          <label>Chỉ thị / Đơn hàng *
            <select id="nOrd"><option value="">— chọn chỉ thị —</option>
              ${cands.map(o => `<option value="${o.ord}">${o.ord} · ${o.ctry} · còn thiếu ${U.fmt(o.short)} đôi</option>`).join("")}
              <optgroup label="Đơn đã đủ hàng">${U.ORDER_INDEX.filter(o => o.recvPrs >= o.prs).map(o => `<option value="${o.ord}">${o.ord} · ${o.ctry} · đã đủ</option>`).join("")}</optgroup>
            </select></label>
          <label>Ngày nhập kho *<input id="nD" type="date" value="${U.todayISO()}"></label>
          <label>Ghi chú size chưa SX<input id="nNote" placeholder="VD: UK 9 = 11"></label>
        </div>
        <div id="nGrid" class="mt"><div class="note">Chọn chỉ thị để hệ thống đối chiếu SL đặt hàng & còn thiếu theo từng size.</div></div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn primary" id="nSave" disabled>Ghi nhận nhập kho</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          <span class="note" id="nSum" style="margin-left:auto"></span>
        </div>
        <div class="note mt" id="nErr"></div>
      </div>`, true);

    const grid = document.getElementById("nGrid");
    const selOrd = document.getElementById("nOrd");
    selOrd.addEventListener("change", () => {
      const o = U.orderByCode(selOrd.value);
      if (!o) { grid.innerHTML = `<div class="note">Chọn chỉ thị…</div>`; document.getElementById("nSave").disabled = true; return; }
      grid.innerHTML = `
        <div class="note" style="margin-bottom:6px">${U.flag(o.ctry)} <b>${o.ord}</b> · ${o.ctry} · màu ${o.col} · PO ${o.po} · xuất KD ${U.fmtDate(o.d)}</div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Size</th><th class="num">SL đặt</th><th class="num">Đã nhập</th><th class="num">Còn thiếu</th>
            <th class="num" style="min-width:110px">Nhập kho lần này</th><th class="num">Thùng</th></tr></thead>
          <tbody>${U.SIZES.filter(s => o.sizes[s]).map(s => {
            const c = o.sizes[s], remain = Math.max(0, c.ordered - c.received);
            return `<tr>
              <td><b>${s}</b></td><td class="num">${U.fmt(c.ordered)}</td>
              <td class="num">${U.fmt(c.received)}</td>
              <td class="num ${remain ? "neg" : "pos"}">${U.fmt(remain)}</td>
              <td class="num"><input class="cell-in" type="number" min="0" placeholder="0" data-sz="${s}"></td>
              <td class="num nk-ctn">0</td></tr>`;
          }).join("")}</tbody>
        </table></div>`;
      document.getElementById("nSave").disabled = false;
      grid.querySelectorAll("input[data-sz]").forEach(i => i.addEventListener("input", () => {
        let p = 0, ct = 0;
        grid.querySelectorAll("input[data-sz]").forEach(x => {
          const q = parseInt(x.value || "0", 10) || 0;
          const perCtn = Store.clpPerCtn(o.ord, x.dataset.sz);
          const c = q ? Math.ceil(q / perCtn) : 0;
          x.closest("tr").querySelector(".nk-ctn").textContent = U.fmt(c);
          p += q; ct += c;
        });
        document.getElementById("nSum").innerHTML = `Lần nhập này: <b>${U.fmt(p)} đôi</b> = <b>${U.fmt(ct)} thùng</b>`;
      }));
    });

    document.getElementById("nSave").onclick = () => {
      const err = document.getElementById("nErr");
      const bad = m => { err.innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${m}</span>`; };
      const o = U.orderByCode(selOrd.value);
      const rd = document.getElementById("nD").value;
      if (!o) return bad("Chọn chỉ thị");
      if (!rd) return bad("Chọn ngày nhập kho");
      const note = document.getElementById("nNote").value.trim();
      const rows = [];
      let first = true;
      grid.querySelectorAll("input[data-sz]").forEach(i => {
        const q = parseInt(i.value || "0", 10) || 0;
        if (q <= 0) return;
        const sz = i.dataset.sz, c = o.sizes[sz];
        const perCtn = Store.clpPerCtn(o.ord, sz);
        rows.push({
          rd, rdLabel: U.fmtDate(rd), ctry: o.ctry, ord: o.ord, po: o.po, item: TVS_META.itemCode,
          col: o.col.split(",")[0].trim(), sz, prs: q, ctn: Math.ceil(q / perCtn),
          qcQty: null, qcDate: null, ordered: c.ordered, diff: (c.received + q) - c.ordered,
          bat: o.bat, actualExp: null, planExp: o.d, notProduced: first ? (note || null) : null,
        });
        first = false;
      });
      if (!rows.length) return bad("Nhập số đôi cho ít nhất 1 size");
      Store.addReceipts(rows, "manual");
      App.closeModal();
      App.toast(`✓ Đã nhập kho <b>${o.ord}</b>: ${U.fmt(U.sum(rows, r => r.prs))} đôi = ${U.fmt(U.sum(rows, r => r.ctn))} thùng (${U.fmtDate(rd)})`, "ok");
    };
  }

  /* ── IMPORT nhập kho: nhận .xlsx hoặc .csv theo mẫu pivot theo ngày ── */
  function importReceipts() {
    App.pickDataFile(({ rows: fileRows, name, kind }) => {
      const { rows, errs, pivot, format, warns } = Store.importReceiptsAuto(fileRows);
      let html = `<div class="modal-h"><h3>Import nhập kho — ${U.esc(name)}</h3>
        <span class="bdg acc plain">${kind === "xlsx" ? "Excel .xlsx" : "CSV"} · định dạng ${format === "daily" ? "theo ngày (pivot size)" : "đơn giản"}</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div><div class="modal-b">`;
      if (errs.length) html += `<div class="alert" style="margin-bottom:12px"><div class="a-t"><b>${errs.length} dòng lỗi (bị bỏ qua):</b><br>${errs.slice(0, 12).map(U.esc).join("<br>")}${errs.length > 12 ? "<br>…" : ""}</div></div>`;
      if (warns && warns.length) html += `<div class="alert warn" style="margin-bottom:12px"><div class="a-t"><b>Lưu ý trùng lặp:</b><br>${warns.slice(0, 8).map(U.esc).join("<br>")}</div></div>`;
      if (!rows.length) { html += `<div class="note">Không có dòng hợp lệ. Kiểm tra file theo đúng mẫu (bấm “File mẫu import”).</div></div>`; App.openModal(html, true); return; }

      /* Bảng xem trước 1: đúng dạng pivot của file mẫu */
      if (pivot && pivot.length) {
        html += `<h4 style="font-size:13px;margin-bottom:6px">① File đọc được (dạng theo ngày như mẫu):</h4>
        <div class="tbl-wrap" style="max-height:24vh;overflow:auto;margin-bottom:14px"><table class="tbl">
          <thead><tr><th>Ngày NK</th><th>Chỉ thị</th><th>Quốc gia</th><th>Màu</th>
            ${U.SIZES.map(s => `<th class="num">${s.replace("UK ", "")}</th>`).join("")}<th class="num">Tổng đôi</th></tr></thead>
          <tbody>${pivot.map(p => `<tr><td><b>${p.rdLabel}</b></td><td><b>${p.ord}</b></td><td>${U.flag(p.ctry)} ${U.esc(p.ctry)}</td><td>${p.col}</td>
            ${U.SIZES.map(s => `<td class="num">${p.sizes[s] ? U.fmt(p.sizes[s]) : ""}</td>`).join("")}
            <td class="num"><b>${U.fmt(p.total)}</b></td></tr>`).join("")}</tbody></table></div>`;
      }

      /* Bảng xem trước 2: đã convert & mapping vào hệ thống */
      html += `<h4 style="font-size:13px;margin-bottom:6px">② Sau khi convert & mapping tự động vào hệ thống (${rows.length} dòng · ${U.fmt(U.sum(rows, r => r.prs))} đôi = ${U.fmt(U.sum(rows, r => r.ctn))} thùng):</h4>
        <div class="tbl-wrap" style="max-height:26vh;overflow:auto"><table class="tbl">
        <thead><tr><th>Ngày NK</th><th>Chỉ thị</th><th>Quốc gia</th><th>PO</th><th>Mã hàng</th><th>Màu</th><th>Size</th>
          <th class="num">Đôi</th><th class="num">Thùng</th><th class="num">SL đặt</th><th class="num">Thiếu/Đủ</th><th>Ngày xuất KD</th><th>Ghi chú</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.rdLabel}</td><td><b>${r.ord}</b></td><td>${U.esc(r.ctry)}</td><td class="mono">${U.esc(r.po)}</td><td class="mono">${r.item}</td><td>${r.col}</td><td><b>${r.sz}</b></td>
          <td class="num">${U.fmt(r.prs)}</td><td class="num">${r.ctn}</td><td class="num">${U.fmt(r.ordered)}</td>
          <td class="num ${r.diff < 0 ? "neg" : "pos"}">${r.diff > 0 ? "+" : ""}${r.diff}</td>
          <td>${U.fmtDate(r.planExp)}</td><td class="note">${r.notProduced ? U.esc(r.notProduced) : ""}</td></tr>`).join("")}</tbody></table></div>
        <div class="mt" style="border:1px solid var(--line);border-radius:8px;padding:10px 12px">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:6px">Cách nạp dữ liệu:</div>
          <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:12.5px;margin-bottom:6px">
            <input type="radio" name="riMode" value="add" checked>
            <span><b>Thêm vào</b> dữ liệu hiện có <span class="note">— cộng dồn với số liệu đang có trong kho</span></span></label>
          <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:12.5px">
            <input type="radio" name="riMode" value="replace">
            <span><b>Thay thế toàn bộ</b> dữ liệu nhập kho <span class="note">— xoá sạch số liệu nhập kho hiện có (kể cả dữ liệu gốc &amp; các chỉnh sửa) rồi nạp file này làm dữ liệu duy nhất</span></span></label>
        </div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn primary" id="riApply">✓ Nhập ${rows.length} dòng vào kho</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
        </div></div>`;
      App.openModal(html, true);
      document.getElementById("riApply").onclick = () => {
        const mode = (document.querySelector('input[name="riMode"]:checked') || {}).value || "add";
        if (mode === "replace" && !confirm("Thay thế TOÀN BỘ dữ liệu nhập kho bằng file này?\n\nSố liệu nhập kho hiện có (kể cả dữ liệu gốc và các chỉnh sửa) sẽ bị xoá.")) return;
        Store.addReceipts(rows, "import", { replaceAll: mode === "replace" });
        App.closeModal();
        App.toast(`✓ Đã import ${rows.length} dòng nhập kho (${mode === "replace" ? "thay thế toàn bộ" : "thêm vào"}) — PO/màu/SL đặt/đợt đã mapping tự động`, "ok");
      };
    });
  }

  /* ═════════ SỬA / XÓA / LỊCH SỬ 1 DÒNG MA TRẬN NHẬP KHO ═════════ */
  Views._mtx = [];
  const grp = gi => Views._mtx[gi];

  /* Sửa số lượng theo size + bắt buộc nhập lý do */
  Views._mtxEdit = function (gi) {
    const g = grp(gi); if (!g) return;
    const o = U.orderByCode(g.ord);
    const cur = Store.receiptGroupSizes(g.rdLabel, g.ord);
    const info = Store.receiptEditInfo(g.rdLabel, g.ord);
    App.openModal(`
      <div class="modal-h"><h3>Sửa số lượng nhập kho</h3>
        ${info ? `<span class="bdg acc plain">đã sửa ${info.rev} lần</span>` : ""}
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="note" style="margin-bottom:10px">Ngày NK <b>${U.esc(g.rdLabel)}</b> · Chỉ thị <b>${g.ord}</b>${o ? ` · ${U.flag(o.ctry)} ${U.esc(o.ctry)} · màu ${o.col} · xuất KD ${U.fmtDate(o.d)}` : ""}</div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Size</th>${o ? `<th class="num">SL đặt</th>` : ""}<th class="num">SL hiện tại</th><th class="num" style="min-width:120px">SL sửa thành</th></tr></thead>
          <tbody>${U.SIZES.filter(s => cur[s] != null || (o && o.sizes[s])).map(s => `
            <tr>
              <td><b>${s}</b></td>
              ${o ? `<td class="num">${o.sizes[s] ? U.fmt(o.sizes[s].ordered) : "—"}</td>` : ""}
              <td class="num">${cur[s] != null ? U.fmt(cur[s]) : "—"}</td>
              <td class="num"><input class="cell-in" type="number" min="0" value="${cur[s] != null ? cur[s] : 0}" data-sz="${s}"></td>
            </tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="${o ? 3 : 2}">TỔNG</td><td class="num" id="meSum">0</td></tr></tfoot>
        </table></div>
        <div class="frm mt"><label>Lý do sửa <span style="color:var(--bad)">*</span>
          <input id="meReason" placeholder="VD: đếm lại thực tế, sửa sai sót nhập liệu, QC trả về…"></label></div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn primary" id="meSave">Lưu thay đổi & ghi nhật ký</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          <span class="note" id="meErr" style="margin-left:auto"></span>
        </div>
      </div>`, true);
    const inputs = [...document.querySelectorAll("#modalBack input[data-sz]")];
    const recalc = () => document.getElementById("meSum").textContent =
      U.fmt(inputs.reduce((a, i) => a + (parseInt(i.value || "0", 10) || 0), 0));
    inputs.forEach(i => i.addEventListener("input", recalc)); recalc();
    document.getElementById("meSave").onclick = () => {
      const sizes = {}; inputs.forEach(i => sizes[i.dataset.sz] = parseInt(i.value || "0", 10) || 0);
      const r = Store.editReceiptGroup(g.rdLabel, g.ord, sizes, document.getElementById("meReason").value);
      if (!r.ok) { document.getElementById("meErr").innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Đã sửa dòng <b>${g.ord}</b> (${U.esc(g.rdLabel)}) — lần sửa thứ ${r.rev}, đã ghi nhật ký`, "ok");
    };
  };

  /* Xóa cả dòng ma trận + bắt buộc lý do */
  Views._mtxDelete = function (gi) {
    const g = grp(gi); if (!g) return;
    const cur = Store.receiptGroupSizes(g.rdLabel, g.ord);
    const tot = Object.values(cur).reduce((a, b) => a + b, 0);
    App.openModal(`
      <div class="modal-h"><h3>Xóa dòng nhập kho</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b" style="max-width:520px">
        <div class="alert" style="margin-bottom:12px"><div class="a-t">Xóa toàn bộ lần nhập <b>${U.esc(g.rdLabel)}</b> của chỉ thị <b>${g.ord}</b>
          (<b>${U.fmt(tot)} đôi</b>). Số liệu N-X-T & tồn kho sẽ trừ lại tương ứng. Thao tác được ghi vào nhật ký và có thể khôi phục.</div></div>
        <div class="frm"><label>Lý do xóa <span style="color:var(--bad)">*</span>
          <input id="mdReason" placeholder="VD: nhập nhầm chỉ thị, trùng lặp, hủy lô…"></label></div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn danger" id="mdGo">Xóa dòng & ghi nhật ký</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          <span class="note" id="mdErr" style="margin-left:auto"></span>
        </div>
      </div>`);
    document.getElementById("mdGo").onclick = () => {
      const r = Store.deleteReceiptGroup(g.rdLabel, g.ord, document.getElementById("mdReason").value);
      if (!r.ok) { document.getElementById("mdErr").innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${U.esc(r.msg)}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Đã xóa dòng <b>${g.ord}</b> (${U.esc(g.rdLabel)}) — đã ghi nhật ký`, "warn");
    };
  };

  /* Xem NHẬT KÝ chỉnh sửa của 1 dòng */
  Views._mtxHistory = function (gi) {
    const g = grp(gi); if (!g) return;
    const info = Store.receiptEditInfo(g.rdLabel, g.ord);
    if (!info) { App.toast("Dòng này chưa có chỉnh sửa", "warn"); return; }
    const szTxt = m => m ? U.SIZES.filter(s => m[s]).map(s => `${s.replace("UK ", "")}×${m[s]}`).join(" · ") || "—" : "(đã xóa)";
    const rows = info.log.slice().reverse().map(l => `
      <tr>
        <td class="num"><b>${l.rev}</b></td>
        <td>${new Date(l.at).toLocaleString("vi-VN")}</td>
        <td><b>${U.esc(l.by)}</b></td>
        <td>${l.restored ? '<span class="bdg neu plain">khôi phục gốc</span>' : (l.after === null ? '<span class="bdg bad plain">xóa dòng</span>' : '<span class="bdg acc plain">sửa số lượng</span>')}</td>
        <td class="note">${l.restored ? "—" : szTxt(l.before)}</td>
        <td class="note">${l.restored ? "về gốc" : szTxt(l.after)}</td>
        <td>${U.esc(l.reason || "")}</td>
      </tr>`).join("");
    App.openModal(`
      <div class="modal-h"><h3>Nhật ký chỉnh sửa — ${g.ord}</h3>
        <span class="bdg acc plain">${info.rev} lần sửa</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="note" style="margin-bottom:10px">Ngày NK <b>${U.esc(g.rdLabel)}</b> · Chỉ thị <b>${g.ord}</b>${info.deleted ? ' · <span class="bdg bad plain">đang ở trạng thái ĐÃ XÓA</span>' : ""}</div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Lần</th><th>Thời điểm</th><th>Người sửa</th><th>Loại</th><th>Trước</th><th>Sau</th><th>Lý do</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="mt" style="display:flex;gap:8px">
          <button class="btn need-edit" id="mhRestore">↺ Khôi phục về gốc</button>
          <button class="btn" onclick="App.closeModal()">Đóng</button>
        </div>
      </div>`, true);
    const rb = document.getElementById("mhRestore");
    if (rb) rb.onclick = () => {
      const r = Store.restoreReceiptGroup(g.rdLabel, g.ord, "Khôi phục về gốc từ nhật ký");
      if (!r.ok) { App.toast("⚠ " + r.msg, "warn"); return; }
      App.closeModal();
      App.toast(`✓ Đã khôi phục dòng <b>${g.ord}</b> (${U.esc(g.rdLabel)}) về số liệu gốc`, "ok");
    };
  };

  /* ═════════ TỔNG HỢP NHẬT KÝ SỬA / XÓA NHẬP KHO (HIỂN THỊ CẢ DÒNG ĐÃ XÓA) ═════════ */
  Views._whEditLogModal = function () {
    const es = Store.receiptEditSummary ? Store.receiptEditSummary() : { total: 0, edited: [], deleted: [], restored: [], all: [] };
    const szTxt = m => m ? U.SIZES.filter(s => m[s]).map(s => `${s.replace("UK ", "")}×${U.fmt(m[s])}`).join(" · ") || "0" : "(đã xóa)";
    const sumMap = m => m ? Object.values(m).reduce((a, b) => a + (+b || 0), 0) : 0;
    const renderRows = list => list.map(item => {
      const last = item.lastLog || {};
      const befSum = sumMap(last.before);
      const aftSum = item.deleted ? 0 : sumMap(item.sizes || last.after);
      const delta = aftSum - befSum;
      return `<tr>
        <td><b>${U.esc(item.rdLabel)}</b></td>
        <td><b class="clickable" onclick="App.closeModal();Views._openOrder('${item.ord}')">${U.esc(item.ord)}</b></td>
        <td class="num"><b>${item.rev}</b></td>
        <td>${item.deleted
          ? '<span class="bdg bad plain">ĐÃ XÓA</span>'
          : (item.sizes ? '<span class="bdg acc plain">ĐÃ SỬA SL</span>' : '<span class="bdg neu plain">KHÔI PHỤC GỐC</span>')}</td>
        <td class="note">${szTxt(last.before)} ${befSum ? `<b>(${U.fmt(befSum)} đôi)</b>` : ""}</td>
        <td class="note">${item.deleted ? '<span style="color:var(--bad);font-weight:700">0 đôi (đã xóa khỏi kho)</span>' : `${szTxt(item.sizes || last.after)} <b>(${U.fmt(aftSum)} đôi)</b>`}</td>
        <td class="num ${delta < 0 ? "neg" : "pos"}"><b>${delta > 0 ? "+" : ""}${U.fmt(delta)}</b></td>
        <td><b>${U.esc(last.by || "—")}</b><br><span class="note">${last.at ? new Date(last.at).toLocaleString("vi-VN") : "—"}</span></td>
        <td>${U.esc(last.reason || "—")}</td>
        <td style="white-space:nowrap">
          <button class="btn small need-edit" onclick="Views._whRestoreGroup('${U.esc(item.rdLabel)}','${U.esc(item.ord)}')">↺ Khôi phục gốc</button>
        </td>
      </tr>`;
    }).join("");

    App.openModal(`
      <div class="modal-h">
        <h3>⟲ Nhật ký sửa / xóa số lượng nhập kho (${es.total} nhóm)</h3>
        <span class="bdg acc plain">Đã sửa SL: ${es.edited.length} · Đã xóa: ${es.deleted.length}</span>
        <button class="modal-x" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-b">
        <div class="alert ok" style="margin-bottom:12px"><div class="a-t">
          <b>✓ Trạng thái áp dụng:</b> Tất cả <b>${es.edited.length} nhóm sửa số lượng</b> và <b>${es.deleted.length} nhóm đã xóa</b> dưới đây đều <b>đã được trừ/cập nhật trực tiếp</b> vào tổng Nhập – Xuất – Tồn (Hiện tại: <b>${U.fmt(U.NXT.nhapPrs)} đôi · ${U.fmt(U.NXT.nhapCtn)} thùng</b>).
        </div></div>
        ${!es.all.length ? `<div class="note">Chưa có lịch sử sửa/xóa nhập kho nào.</div>` : `
        <div class="tbl-wrap" style="max-height:58vh;overflow:auto"><table class="tbl">
          <thead><tr>
            <th>Ngày NK</th><th>Chỉ thị</th><th class="num">Lần sửa</th><th>Trạng thái</th>
            <th>Số lượng trước sửa/xóa</th><th>Số lượng sau sửa (hiện hành)</th><th class="num">Chênh lệch</th>
            <th>Người sửa / Thời điểm</th><th>Lý do ghi nhận</th><th>Thao tác</th>
          </tr></thead>
          <tbody>${renderRows(es.all)}</tbody>
        </table></div>`}
        <div class="mt" style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="App.closeModal()">Đóng</button>
        </div>
      </div>`, true);
  };

  Views._whRestoreGroup = function (rdLabel, ord) {
    if (!confirm(`Khôi phục lần nhập kho ngày ${rdLabel} của chỉ thị ${ord} về số liệu gốc trước khi sửa/xóa?`)) return;
    const r = Store.restoreReceiptGroup(rdLabel, ord, "Khôi phục từ bảng tổng hợp nhật ký sửa/xóa");
    if (!r.ok) { App.toast("⚠ " + r.msg, "warn"); return; }
    App.toast(`✓ Đã khôi phục ${ord} (${rdLabel}) về số liệu gốc`, "ok");
    Views._whEditLogModal();
  };

  Views._mtxToggleQC = function (gi) {
    const g = (Views._mtx || [])[gi];
    if (!g) return;
    const info = Store.receiptEditInfo ? Store.receiptEditInfo(g.rdLabel, g.ord) : null;
    const curQC = info && info.qcDate ? info.qcDate : "";
    const defDate = curQC || (U.todayISO ? U.todayISO() : TVS_META.today);
    const iso = prompt(`Ghi nhận ngày kiểm đếm QC cho chỉ thị ${g.ord} (nhập kho ngày ${g.rdLabel}):\n• Nhập YYYY-MM-DD để xác nhận đã kiểm QC\n• Xoá trắng rồi bấm OK để hủy xác nhận QC`, defDate);
    if (iso === null) return;
    const r = Store.setReceiptGroupQC(g.rdLabel, g.ord, iso.trim() || null);
    if (r && r.ok) {
      App.toast(r.qcDate ? `✓ Đã ghi nhận kiểm QC ${g.ord} (${g.rdLabel}) ngày ${U.fmtDate(r.qcDate)}` : `Đã hủy trạng thái kiểm QC ${g.ord} (${g.rdLabel})`, "ok");
    }
  };
})();
