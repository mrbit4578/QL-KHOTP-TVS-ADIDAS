/* ═══════════════════════════════════════════════════════════════════
   nxt-report.js — BÁO CÁO N-X-T THEO KỲ + XUẤT FILE EXCEL (.xlsx) — v4.9
   Gắn vào màn hình “Tồn kho · N-X-T”.

   Công thức chuẩn kế toán kho (theo từng ĐƠN HÀNG × SIZE):
     • Tồn đầu kỳ   = (nhập kho TRƯỚC “từ ngày”) − (xuất kho TRƯỚC “từ ngày”)
     • Nhập trong kỳ= nhập kho có Ngày NK trong [từ ngày … đến ngày]
     • Xuất trong kỳ= phiếu XK đã xác nhận có Ngày thực xuất trong kỳ
     • Tồn cuối kỳ  = Tồn đầu kỳ + Nhập trong kỳ − Xuất trong kỳ
   Chỉ tính phiếu xuất kho ĐÃ XÁC NHẬN (status = "shipped") và có ngày thực xuất.
   Dòng phiếu MIX SIZE được phân bổ đúng số đôi từng size.

   2 kiểu hiển thị / xuất file:
     ① “Size hàng ngang” — 1 dòng = 1 đơn, 4 khối cột (Tồn đầu · Nhập · Xuất · Tồn cuối) × UK 3→UK 9
     ② “Size theo dòng”  — 1 dòng = 1 đơn × 1 size
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const R = {};
  const SZ = () => U.SIZES;

  /* Trạng thái màn hình (giữ nguyên khi vẽ lại) */
  /* touched = người dùng đã tự chọn kỳ → tôn trọng lựa chọn, không tự đổi nữa.
     Chưa chọn → mỗi lần vẽ lại tự lấy trọn kỳ theo dữ liệu MỚI NHẤT (quan trọng:
     dữ liệu chung tải từ GitHub về SAU khi trang vẽ lần đầu). */
  const st = { from: null, to: null, mode: "wide", showEmpty: false, touched: false };

  /* Ngày đầu / cuối tháng — tính theo UTC để KHÔNG bị lệch 1 ngày ở múi giờ
     Việt Nam (+07): new Date(y, m, 0).toISOString() sẽ trả về ngày hôm trước. */
  const pad = n => String(n).padStart(2, "0");
  const firstDay = (y, m) => `${y}-${pad(m)}-01`;
  const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  /* ── Thu thập mọi biến động kho (nhập & xuất) có ngày ───────── */
  function movements() {
    const mv = [];
    for (const r of (window.TVS_RECEIPTS || [])) {
      if (!r.rd) continue;
      mv.push({ type: "N", d: r.rd, ord: r.ord, sz: r.sz, qty: r.prs, ref: "Nhập kho " + (r.rdLabel || U.fmtDate(r.rd)) });
    }
    for (const s of (window.TVS_SHIPMENTS || [])) {
      if (s.status !== "shipped" || !s.actualDate) continue;
      for (const l of (s.lines || [])) {
        const per = (l.kind === "mix" && l.sizes) ? (l.qty > 0 ? l.sizes : {}) : { [l.sz]: l.qty };
        for (const [sz, q] of Object.entries(per)) {
          if (!q) continue;
          mv.push({ type: "X", d: s.actualDate, ord: l.ord, sz, qty: q, ref: "Phiếu " + (s.code || s.pxk || "—") });
        }
      }
    }
    return mv.sort((a, b) => a.d.localeCompare(b.d) || a.ord.localeCompare(b.ord) || U.sizeIdx(a.sz) - U.sizeIdx(b.sz));
  }

  /* Khoảng ngày mặc định: từ lần nhập kho sớm nhất → hôm nay */
  R.defaultRange = function () {
    const mv = movements();
    const from = mv.length ? mv[0].d : TVS_META.today;
    const last = mv.length ? mv[mv.length - 1].d : TVS_META.today;
    const to = last > TVS_META.today ? last : TVS_META.today;
    return { from, to };
  };

  /* ── TÍNH BÁO CÁO cho kỳ [from … to] ────────────────────────── */
  R.build = function (from, to, showEmpty) {
    const mv = movements();
    const bag = {};   /* "ord|sz" → { open, inQ, outQ, outLog } */
    const touch = k => (bag[k] = bag[k] || { open: 0, inQ: 0, outQ: 0, outLog: [] });

    for (const m of mv) {
      const k = m.ord + "|" + m.sz, b = touch(k);
      if (m.d < from) b.open += (m.type === "N" ? m.qty : -m.qty);
      else if (m.d <= to) {
        if (m.type === "N") b.inQ += m.qty;
        else {
          b.outQ += m.qty;
          /* NGÀY THỰC XUẤT — lấy từ phiếu xuất kho đã xác nhận (màn Lệnh giao hàng) */
          b.outLog.push({ d: m.d, qty: m.qty, ref: m.ref });
        }
      }
      /* biến động SAU “đến ngày” không tính vào kỳ */
    }

    const rows = [];
    for (const o of U.ORDER_INDEX) {
      const sizes = {};
      let any = false, tot = { ordered: 0, open: 0, inQ: 0, outQ: 0, close: 0 };
      for (const sz of SZ()) {
        const b = bag[o.ord + "|" + sz] || { open: 0, inQ: 0, outQ: 0, outLog: [] };
        const ordered = o.sizes[sz] ? o.sizes[sz].ordered : 0;
        const close = b.open + b.inQ - b.outQ;
        if (!ordered && !b.open && !b.inQ && !b.outQ) continue;
        /* Ngày thực xuất của size này trong kỳ (gộp nhiều phiếu, sắp xếp tăng dần) */
        const outLog = (b.outLog || []).slice().sort((x, y) => x.d.localeCompare(y.d));
        const outDates = [...new Set(outLog.map(x => x.d))];
        const cell = { sz, ordered, open: b.open, inQ: b.inQ, outQ: b.outQ, close, outLog, outDates };
        sizes[sz] = cell;
        tot.ordered += ordered; tot.open += b.open; tot.inQ += b.inQ; tot.outQ += b.outQ; tot.close += close;
        if (b.open || b.inQ || b.outQ) any = true;
      }
      if (!any && !showEmpty) continue;
      rows.push({ o, sizes, tot, moved: any });
    }

    /* Tổng hợp theo size (toàn bộ đơn trong báo cáo) */
    const bySize = SZ().map(sz => {
      const t = { sz, ordered: 0, open: 0, inQ: 0, outQ: 0, close: 0 };
      rows.forEach(r => { const c = r.sizes[sz]; if (!c) return;
        t.ordered += c.ordered; t.open += c.open; t.inQ += c.inQ; t.outQ += c.outQ; t.close += c.close; });
      return t;
    });
    const grand = { ordered: 0, open: 0, inQ: 0, outQ: 0, close: 0 };
    rows.forEach(r => { grand.ordered += r.tot.ordered; grand.open += r.tot.open;
      grand.inQ += r.tot.inQ; grand.outQ += r.tot.outQ; grand.close += r.tot.close; });

    const log = mv.filter(m => m.d >= from && m.d <= to);
    return { from, to, rows, bySize, grand, log };
  };

  /* ═════════════════ GIAO DIỆN TRÊN MÀN HÌNH ═════════════════ */
  R.mount = function (host) {
    if (!host) return;
    if (!st.touched || !st.from || !st.to) { const d = R.defaultRange(); st.from = d.from; st.to = d.to; }
    draw(host);
  };

  function draw(host) {
    const rep = R.build(st.from, st.to, st.showEmpty);
    const kpi = (lab, val, note, color) => `
      <div class="card kpi" style="border-top:3px solid ${color};box-shadow:none">
        <div class="k-lab"><span>${lab}</span></div>
        <div class="k-val">${U.fmt(val)} <small>đôi</small></div>
        <div class="k-sub">${note}</div></div>`;

    host.innerHTML = `
      <div class="card mt">
        <div class="card-h">
          <h3>Báo cáo N-X-T theo kỳ — xuất Excel</h3>
          <span class="sub">chọn kỳ báo cáo · chọn kiểu hiển thị size · tải file .xlsx</span>
        </div>

        <div class="filters" style="background:var(--soft)">
          <label class="rp-f">Từ ngày <input class="f-input" type="date" id="rpFrom" value="${st.from}" style="width:160px"></label>
          <label class="rp-f">Đến ngày <input class="f-input" type="date" id="rpTo" value="${st.to}" style="width:160px"></label>
          <button class="btn small" id="rpThisMonth">Tháng này</button>
          <button class="btn small" id="rpThisQuarter">Quý này</button>
          <button class="btn small" id="rpAll">Toàn bộ</button>
          <span class="f-chipcount" id="rpRangeNote"></span>
        </div>

        <div class="filters">
          <div class="seg">
            <button id="rpWide" class="${st.mode === "wide" ? "on" : ""}">Hiển thị hàng ngang theo size</button>
            <button id="rpLong" class="${st.mode === "long" ? "on" : ""}">Hiển thị size theo dòng</button>
          </div>
          <button class="btn" id="rpEmpty">${st.showEmpty ? "✓ Đang hiện đơn không phát sinh" : "Hiện cả đơn không phát sinh"}</button>
          <button class="btn primary" id="rpExport">${App.icon("download", "ico")} Export Excel (.xlsx)</button>
          <span class="f-chipcount">${U.fmt(rep.rows.length)} đơn · ${U.fmt(rep.log.length)} lượt biến động trong kỳ</span>
        </div>

        <div class="card-b">
          <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">
            ${kpi("TỒN ĐẦU KỲ", rep.grand.open, "trước " + U.fmtDate(st.from), "#667085")}
            ${kpi("NHẬP TRONG KỲ (N)", rep.grand.inQ, "từ nhật ký nhập kho", "#12b5a5")}
            ${kpi("XUẤT TRONG KỲ (X)", rep.grand.outQ, "phiếu XK đã xác nhận", "#f2a20c")}
            ${kpi("TỒN CUỐI KỲ", rep.grand.close, "đầu kỳ + nhập − xuất", "#0050d8")}
          </div>
        </div>

        <div id="rpTable"></div>
      </div>`;

    document.getElementById("rpRangeNote").innerHTML =
      `Kỳ báo cáo <b>${U.fmtDate(st.from)} → ${U.fmtDate(st.to)}</b> (${U.daysBetween(st.from, st.to) + 1} ngày)`;
    renderTable(document.getElementById("rpTable"), rep);

    const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
    const setRange = (a, b) => { st.from = a; st.to = b; st.touched = true; draw(host); };
    document.getElementById("rpFrom").onchange = e => { st.from = e.target.value || st.from; if (st.from > st.to) st.to = st.from; st.touched = true; draw(host); };
    document.getElementById("rpTo").onchange = e => { st.to = e.target.value || st.to; if (st.to < st.from) st.from = st.to; st.touched = true; draw(host); };
    on("rpThisMonth", () => { const t = TVS_META.today, y = +t.slice(0, 4), m = +t.slice(5, 7);
      setRange(firstDay(y, m), lastDay(y, m)); });
    on("rpThisQuarter", () => { const t = TVS_META.today, y = +t.slice(0, 4), m = +t.slice(5, 7);
      const q0 = Math.floor((m - 1) / 3) * 3 + 1;
      setRange(firstDay(y, q0), lastDay(y, q0 + 2)); });
    on("rpAll", () => { const d = R.defaultRange(); st.touched = false; setRange(d.from, d.to); st.touched = false; });
    on("rpWide", () => { st.mode = "wide"; draw(host); });
    on("rpLong", () => { st.mode = "long"; draw(host); });
    on("rpEmpty", () => { st.showEmpty = !st.showEmpty; draw(host); });
    on("rpExport", () => R.exportExcel(rep));
  }

  /* ── NGÀY THỰC XUẤT (nạp từ phiếu xuất kho ở màn Lệnh giao hàng) ──
     Chỉ dùng cho báo cáo kiểu “size theo dòng”. */
  R.outDatesText = c => (c.outDates && c.outDates.length)
    ? c.outDates.map(U.fmtDate).join(" · ") : "";
  function outDateCell(c) {
    const t = R.outDatesText(c);
    if (!t) return `<span class="note">—</span>`;
    return `<b>${t}</b>${c.outDates.length > 1 ? ` <span class="bdg neu plain">${c.outDates.length} lần</span>` : ""}`;
  }
  /* Chú thích chi tiết: từng phiếu · số đôi */
  function outTip(c) {
    return (c.outLog || []).map(l => `${U.fmtDate(l.d)}: ${U.fmt(l.qty)} đôi (${l.ref})`).join("\n") || "Chưa xuất kho trong kỳ";
  }

  /* ── Bảng xem trước ngay trên màn hình (đúng kiểu sẽ xuất) ──── */
  function renderTable(area, rep) {
    if (!rep.rows.length) {
      area.innerHTML = `<div class="note" style="padding:16px 18px">Kỳ này chưa có biến động nhập/xuất kho.
        Chọn kỳ khác hoặc bấm <b>Hiện cả đơn không phát sinh</b> để in bảng đầy đủ.</div>`;
      return;
    }
    const sizes = SZ();
    const numCell = (v, neg) => `<td class="num ${neg && v < 0 ? "neg" : ""}">${v ? U.fmt(v) : "—"}</td>`;

    if (st.mode === "wide") {
      const blocks = [["Tồn đầu kỳ", "open"], ["Nhập trong kỳ", "inQ"], ["Xuất trong kỳ", "outQ"], ["Tồn cuối kỳ", "close"]];
      area.innerHTML = `<div class="tbl-wrap"><table class="tbl rp-wide">
        <thead>
          <tr>
            <th rowspan="2">Đơn hàng</th><th rowspan="2">Quốc gia</th><th rowspan="2">Màu</th><th rowspan="2">Xuất KD</th>
            ${blocks.map(b => `<th colspan="${sizes.length + 1}" class="rp-blk">${b[0]}</th>`).join("")}
          </tr>
          <tr>${blocks.map(() => sizes.map(s => `<th class="num">${s.replace("UK ", "")}</th>`).join("") +
                `<th class="num rp-sum">Cộng</th>`).join("")}</tr>
        </thead>
        <tbody>${rep.rows.map(r => `
          <tr class="clickable" onclick="Views._openOrder('${r.o.ord}')">
            <td><b>${r.o.ord}</b></td>
            <td>${U.flag(r.o.ctry)} ${U.esc(r.o.ctry)}</td>
            <td>${U.esc(r.o.col)}</td>
            <td>${U.fmtDate(r.o.d)}</td>
            ${blocks.map(b => sizes.map(s => numCell(r.sizes[s] ? r.sizes[s][b[1]] : 0, true)).join("") +
              `<td class="num rp-sum"><b>${U.fmt(r.tot[b[1]])}</b></td>`).join("")}
          </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4">TỔNG CỘNG (${U.fmt(rep.rows.length)} đơn)</td>
          ${blocks.map(b => sizes.map(s => {
            const t = rep.bySize.find(x => x.sz === s);
            return `<td class="num">${U.fmt(t ? t[b[1]] : 0)}</td>`; }).join("") +
            `<td class="num rp-sum">${U.fmt(rep.grand[b[1]])}</td>`).join("")}
        </tr></tfoot>
      </table></div>
      <div class="note" style="padding:10px 18px">1 dòng = 1 đơn hàng · 4 khối cột theo size UK 3→UK 9. Bấm <b>Export Excel</b> để tải đúng bảng này.</div>`;
    } else {
      const flat = [];
      rep.rows.forEach(r => sizes.forEach(s => { if (r.sizes[s]) flat.push({ r, c: r.sizes[s] }); }));
      area.innerHTML = `<div class="tbl-wrap"><table class="tbl">
        <thead><tr>
          <th>#</th><th>Đơn hàng</th><th>Quốc gia</th><th>Màu</th><th>Xuất KD</th><th>Size</th>
          <th class="num">SL đặt</th><th class="num">Tồn đầu kỳ</th><th class="num">Nhập (N)</th>
          <th class="num">Xuất (X)</th><th>Ngày thực xuất</th><th class="num">Tồn cuối kỳ</th>
        </tr></thead>
        <tbody>${flat.map((x, i) => `
          <tr class="clickable" onclick="Views._openOrder('${x.r.o.ord}')">
            <td class="note">${i + 1}</td>
            <td><b>${x.r.o.ord}</b></td>
            <td>${U.flag(x.r.o.ctry)} ${U.esc(x.r.o.ctry)}</td>
            <td>${U.esc(x.r.o.col)}</td>
            <td>${U.fmtDate(x.r.o.d)}</td>
            <td><b>${x.c.sz}</b></td>
            <td class="num">${U.fmt(x.c.ordered)}</td>
            ${numCell(x.c.open, true)}${numCell(x.c.inQ)}${numCell(x.c.outQ)}
            <td class="note" title="${U.esc(outTip(x.c))}">${outDateCell(x.c)}</td>
            <td class="num"><b>${U.fmt(x.c.close)}</b></td>
          </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="6">TỔNG CỘNG (${U.fmt(flat.length)} dòng)</td>
          <td class="num">${U.fmt(rep.grand.ordered)}</td>
          <td class="num">${U.fmt(rep.grand.open)}</td>
          <td class="num">${U.fmt(rep.grand.inQ)}</td>
          <td class="num">${U.fmt(rep.grand.outQ)}</td>
          <td></td>
          <td class="num">${U.fmt(rep.grand.close)}</td>
        </tr></tfoot>
      </table></div>
      <div class="note" style="padding:10px 18px">1 dòng = 1 đơn hàng × 1 size · cột <b>Ngày thực xuất</b> lấy trực tiếp từ
        <a href="#/delivery">Lệnh giao hàng · PXK</a> (chỉ phiếu đã xác nhận xuất kho) — di chuột vào ô để xem chi tiết từng phiếu.
        Bấm <b>Export Excel</b> để tải đúng bảng này.</div>`;
    }
  }

  /* ═════════════════ XUẤT FILE EXCEL .xlsx ═════════════════ */
  /* Đặt kỳ / kiểu hiển thị từ bên ngoài (dùng cho liên kết nhanh & kiểm thử) */
  R.setState = function (o) { Object.assign(st, o || {}); return Object.assign({}, st); };
  R.state = () => Object.assign({}, st);

  R.exportExcel = function (rep) {
    if (!window.XlsxWrite) { App.toast("⚠ Thiếu assets/js/xlsx-write.js — không xuất được Excel", "warn"); return; }
    if (!rep) {
      if (!st.from || !st.to) { const d = R.defaultRange(); st.from = d.from; st.to = d.to; }
      rep = R.build(st.from, st.to, st.showEmpty);
    }
    const S = XlsxWrite.S, sizes = SZ();
    const who = (window.Auth && Auth.current) ? `${Auth.current.name} (${Auth.current.u})` : "Người xem";
    const period = `${U.fmtDate(rep.from)} → ${U.fmtDate(rep.to)}`;
    const stamp = new Date().toLocaleString("vi-VN");

    /* Khối tiêu đề dùng chung cho mọi sheet */
    const header = (title, nCol) => ({
      rows: [
        [{ v: TVS_META.company + " — Kho thành phẩm " + TVS_META.brand + " · mã hàng " + TVS_META.itemCode, s: S.lab }],
        [{ v: title, s: S.title }],
        [{ v: `Kỳ báo cáo: ${period}  ·  Lập lúc ${stamp}  ·  Người lập: ${who}`, s: S.sub }],
        [],
      ],
      merges: [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: Math.max(1, nCol - 1) } })),
    });

    const sheets = [];

    /* ── Sheet 1: đúng kiểu đang xem ── */
    if (st.mode === "wide") {
      const blocks = [["TỒN ĐẦU KỲ", "open"], ["NHẬP TRONG KỲ (N)", "inQ"], ["XUẤT TRONG KỲ (X)", "outQ"], ["TỒN CUỐI KỲ", "close"]];
      const nCol = 6 + blocks.length * (sizes.length + 1);
      const h = header("BÁO CÁO NHẬP – XUẤT – TỒN THEO ĐƠN HÀNG (size hàng ngang)", nCol);
      const rows = h.rows.slice(), merges = h.merges.slice();
      const hr = rows.length;   /* dòng tiêu đề bảng thứ nhất */

      const r1 = [{ v: "STT", s: S.head }, { v: "Đơn hàng", s: S.head }, { v: "Quốc gia", s: S.head },
                  { v: "PO khách hàng", s: S.head }, { v: "Mã màu", s: S.head }, { v: "Ngày xuất KD", s: S.head }];
      const r2 = [{ v: "", s: S.head }, { v: "", s: S.head }, { v: "", s: S.head },
                  { v: "", s: S.head }, { v: "", s: S.head }, { v: "", s: S.head }];
      for (let i = 0; i < 6; i++) merges.push({ s: { r: hr, c: i }, e: { r: hr + 1, c: i } });
      blocks.forEach((b, bi) => {
        const c0 = 6 + bi * (sizes.length + 1);
        r1.push({ v: b[0], s: S.head });
        for (let k = 1; k <= sizes.length; k++) r1.push({ v: "", s: S.head });
        merges.push({ s: { r: hr, c: c0 }, e: { r: hr, c: c0 + sizes.length } });
        sizes.forEach(s => r2.push({ v: s.replace("UK ", ""), s: S.head2 }));
        r2.push({ v: "Cộng", s: S.head2 });
      });
      rows.push(r1, r2);

      rep.rows.forEach((r, i) => {
        const line = [{ v: i + 1, s: S.txtC }, { v: r.o.ord, s: S.txtB }, { v: r.o.ctry, s: S.txt },
                      { v: r.o.po || "", s: S.txt }, { v: r.o.col, s: S.txt }, { v: U.fmtDate(r.o.d), s: S.txtC }];
        blocks.forEach(b => {
          sizes.forEach(s => line.push({ v: r.sizes[s] ? r.sizes[s][b[1]] : 0, t: "n", s: (r.sizes[s] && r.sizes[s][b[1]] < 0) ? S.numNeg : S.num }));
          line.push({ v: r.tot[b[1]], t: "n", s: S.numB });
        });
        rows.push(line);
      });

      const tot = [{ v: "", s: S.totT }, { v: "TỔNG CỘNG", s: S.totT }, { v: rep.rows.length + " đơn", s: S.totT },
                   { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }];
      blocks.forEach(b => {
        sizes.forEach(s => { const t = rep.bySize.find(x => x.sz === s); tot.push({ v: t ? t[b[1]] : 0, t: "n", s: S.totN }); });
        tot.push({ v: rep.grand[b[1]], t: "n", s: S.totN });
      });
      rows.push(tot);

      sheets.push({
        name: "N-X-T size ngang", rows, merges,
        cols: [{ w: 5 }, { w: 14 }, { w: 18 }, { w: 16 }, { w: 10 }, { w: 13 }]
          .concat(blocks.flatMap(() => sizes.map(() => ({ w: 7 })).concat([{ w: 10 }]))),
        freeze: { r: hr + 2, c: 2 }, rowHeights: { [hr]: 26 },
      });
    } else {
      const nCol = 13;
      const h = header("BÁO CÁO NHẬP – XUẤT – TỒN THEO ĐƠN HÀNG × SIZE (size theo dòng)", nCol);
      const rows = h.rows.slice(), merges = h.merges.slice();
      const hr = rows.length;
      rows.push(["STT", "Đơn hàng", "Quốc gia", "PO khách hàng", "Mã màu", "Ngày xuất KD", "Size",
                 "SL đặt", "Tồn đầu kỳ", "Nhập trong kỳ (N)", "Xuất trong kỳ (X)",
                 "Ngày thực xuất", "Tồn cuối kỳ"]
                 .map(v => ({ v, s: S.head })));
      let i = 0;
      rep.rows.forEach(r => sizes.forEach(s => {
        const c = r.sizes[s]; if (!c) return;
        rows.push([
          { v: ++i, s: S.txtC }, { v: r.o.ord, s: S.txtB }, { v: r.o.ctry, s: S.txt },
          { v: r.o.po || "", s: S.txt }, { v: r.o.col, s: S.txt }, { v: U.fmtDate(r.o.d), s: S.txtC },
          { v: c.sz, s: S.txtC }, { v: c.ordered, t: "n", s: S.num },
          { v: c.open, t: "n", s: c.open < 0 ? S.numNeg : S.num },
          { v: c.inQ, t: "n", s: S.num }, { v: c.outQ, t: "n", s: S.num },
          { v: R.outDatesText(c) || "—", s: S.txtC },
          { v: c.close, t: "n", s: S.numB },
        ]);
      }));
      rows.push([{ v: "", s: S.totT }, { v: "TỔNG CỘNG", s: S.totT }, { v: i + " dòng", s: S.totT },
                 { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT },
                 { v: rep.grand.ordered, t: "n", s: S.totN }, { v: rep.grand.open, t: "n", s: S.totN },
                 { v: rep.grand.inQ, t: "n", s: S.totN }, { v: rep.grand.outQ, t: "n", s: S.totN },
                 { v: "", s: S.totT }, { v: rep.grand.close, t: "n", s: S.totN }]);
      sheets.push({
        name: "N-X-T size theo dong", rows, merges,
        cols: [{ w: 5 }, { w: 14 }, { w: 18 }, { w: 16 }, { w: 10 }, { w: 13 }, { w: 8 },
               { w: 11 }, { w: 13 }, { w: 16 }, { w: 16 }, { w: 22 }, { w: 13 }],
        freeze: { r: hr + 1, c: 2 },
      });
    }

    /* ── Sheet 2: tổng hợp theo size ── */
    {
      const h = header("TỔNG HỢP N-X-T THEO SIZE", 6);
      const rows = h.rows.slice();
      rows.push(["Size", "SL đặt", "Tồn đầu kỳ", "Nhập trong kỳ (N)", "Xuất trong kỳ (X)", "Tồn cuối kỳ"]
        .map(v => ({ v, s: S.head })));
      rep.bySize.forEach(t => rows.push([
        { v: t.sz, s: S.txtB }, { v: t.ordered, t: "n", s: S.num }, { v: t.open, t: "n", s: S.num },
        { v: t.inQ, t: "n", s: S.num }, { v: t.outQ, t: "n", s: S.num }, { v: t.close, t: "n", s: S.numB }]));
      rows.push([{ v: "TỔNG", s: S.totT }, { v: rep.grand.ordered, t: "n", s: S.totN },
                 { v: rep.grand.open, t: "n", s: S.totN }, { v: rep.grand.inQ, t: "n", s: S.totN },
                 { v: rep.grand.outQ, t: "n", s: S.totN }, { v: rep.grand.close, t: "n", s: S.totN }]);
      sheets.push({ name: "Tong hop theo size", rows, merges: h.merges,
        cols: [{ w: 10 }, { w: 12 }, { w: 13 }, { w: 18 }, { w: 18 }, { w: 13 }], landscape: false });
    }

    /* ── Sheet 3: nhật ký biến động trong kỳ ── */
    {
      const h = header("NHẬT KÝ BIẾN ĐỘNG KHO TRONG KỲ", 6);
      const rows = h.rows.slice();
      rows.push(["Ngày", "Loại", "Đơn hàng", "Size", "Số đôi", "Chứng từ"].map(v => ({ v, s: S.head })));
      rep.log.forEach(m => rows.push([
        { v: U.fmtDate(m.d), s: S.txtC },
        { v: m.type === "N" ? "NHẬP KHO" : "XUẤT KHO", s: S.txtC },
        { v: m.ord, s: S.txtB }, { v: m.sz, s: S.txtC },
        { v: m.qty, t: "n", s: S.num }, { v: m.ref, s: S.txt }]));
      rows.push([{ v: "TỔNG", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT },
                 { v: U.sum(rep.log, m => m.qty), t: "n", s: S.totN }, { v: rep.log.length + " lượt", s: S.totT }]);
      sheets.push({ name: "Nhat ky bien dong", rows, merges: h.merges,
        cols: [{ w: 13 }, { w: 13 }, { w: 14 }, { w: 8 }, { w: 11 }, { w: 30 }], landscape: false });
    }

    const fn = `BAO_CAO_N-X-T_${rep.from.replace(/-/g, "")}_${rep.to.replace(/-/g, "")}_${st.mode === "wide" ? "SIZE-NGANG" : "SIZE-DOC"}.xlsx`;
    const bytes = XlsxWrite.download(fn, sheets);
    App.toast(`✓ Đã xuất <b>${U.esc(fn)}</b> — ${U.fmt(rep.rows.length)} đơn · 3 sheet · ${Math.round(bytes / 1024)} KB`, "ok");
  };

  window.NXTReport = R;
})();
