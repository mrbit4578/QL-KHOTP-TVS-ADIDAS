/* ═══════════════════════════════════════════════════════════════════
   utils.js — Lõi nghiệp vụ N-X-T (Nhập – Xuất – Tồn)
   Chạy trên dữ liệu gộp (gốc Excel + nhập tay/import qua store.js):
   • TVS_ORDERS    : dòng đơn đặt hàng (sheet Data + bổ sung)
   • TVS_RECEIPTS  : dòng nhập kho (sheet ChitietNK + bổ sung)
   • TVS_SHIPMENTS : lệnh giao hàng / phiếu xuất kho (người dùng tạo)
   U.rebuild() được gọi lại sau mỗi thay đổi dữ liệu.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const U = {};

  /* ── Định dạng ─────────────────────────────────────────────── */
  U.fmt = n => (n === null || n === undefined || isNaN(n)) ? "—"
    : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  U.fmtPct = (x, d = 1) => (x * 100).toFixed(d).replace(".", ",") + "%";
  U.fmtDate = iso => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  U.daysFromToday = iso => {
    if (!iso) return null;
    const t = new Date(TVS_META.today + "T00:00:00");
    const d = new Date(iso + "T00:00:00");
    return Math.round((d - t) / 86400000);
  };
  U.daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  U.esc = s => String(s ?? "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Thứ tự size chuẩn UK 3 → UK 9 */
  U.SIZES = ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9"];
  U.sizeIdx = s => U.SIZES.indexOf(s);

  /* Bảng màu hiển thị cho 5 mã màu thật LC1783–LC1787 */
  U.COLOR_HEX = {
    LC1783: "#1a1c20", LC1784: "#2e5d3a", LC1785: "#5b3a24",
    LC1786: "#37507c", LC1787: "#7a1f28",
  };
  U.colorHex = c => U.COLOR_HEX[c] || "#667085";
  /* Tên màu tiếng Việt (từ file cập nhật của phòng KD) */
  U.colorVN = c => ((TVS_META.colorVN || {})[String(c || "").trim()] || "");
  /* Ô hiển thị: chấm màu + mã + tên tiếng Việt */
  U.colorCell = c => {
    const code = String(c || "").split(",")[0].trim();
    const vn = U.colorVN(code);
    return `<span class="color-dot" style="background:${U.colorHex(code)}"></span>${U.esc(c)}` +
           (vn ? `<span class="col-vn">${U.esc(vn)}</span>` : "");
  };

  /* Cờ quốc gia (emoji) */
  U.FLAGS = {
    "ITALY": "🇮🇹", "ARGENTINA": "🇦🇷", "CANADA": "🇨🇦", "CHILE": "🇨🇱",
    "ISRAEL": "🇮🇱", "TURKIYE": "🇹🇷", "GERMANY": "🇩🇪", "UNITED KINGDOM": "🇬🇧",
    "UNITED STATES": "🇺🇸", "UNITED ARAB EMIRATES": "🇦🇪", "COLOMBIA": "🇨🇴",
    "JAPAN": "🇯🇵", "SOUTH AFRICA": "🇿🇦", "MEXICO": "🇲🇽"
  };
  U.flag = c => U.FLAGS[c] || "🌐";
  U.VN_COUNTRY = {
    "ITALY": "Ý", "ARGENTINA": "Argentina", "CANADA": "Canada", "CHILE": "Chile",
    "ISRAEL": "Israel", "TURKIYE": "Thổ Nhĩ Kỳ", "GERMANY": "Đức",
    "UNITED KINGDOM": "Anh", "UNITED STATES": "Mỹ", "UNITED ARAB EMIRATES": "UAE",
    "COLOMBIA": "Colombia", "JAPAN": "Nhật Bản", "SOUTH AFRICA": "Nam Phi", "MEXICO": "Mexico"
  };

  /* ── Gom nhóm & tổng hợp ───────────────────────────────────── */
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  U.groupBy = (arr, keyF) => {
    const m = new Map();
    for (const x of arr) {
      const k = keyF(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  U.uniq = (arr, f) => [...new Set(arr.map(f))];
  U.aggBy = (rows, keyF) => {
    const out = [];
    for (const [k, v] of U.groupBy(rows, keyF)) {
      out.push({ key: k, prs: U.sum(v, r => r.prs), ctn: U.sum(v, r => r.ctn), rows: v });
    }
    return out.sort((a, b) => b.prs - a.prs);
  };

  /* Các dòng xuất kho đã xác nhận (từ lệnh giao hàng) */
  function shippedLines() {
    const out = [];
    for (const s of (window.TVS_SHIPMENTS || []))
      if (s.status === "shipped")
        for (const l of s.lines) out.push({ ...l, actualDate: s.actualDate, shipCode: s.code });
    return out;
  }

  /* ═══════ TÍNH LẠI TOÀN BỘ (gọi sau mỗi thay đổi dữ liệu) ═══════ */
  U.rebuild = function () {

    /* Nhập kho theo đơn+size */
    const recvByOrdSize = {}, recvByOrd = {};
    for (const r of TVS_RECEIPTS) {
      recvByOrdSize[r.ord + "|" + r.sz] = (recvByOrdSize[r.ord + "|" + r.sz] || 0) + r.prs;
      const o = recvByOrd[r.ord] || (recvByOrd[r.ord] = { prs: 0, ctn: 0, dates: new Set(), notes: [] });
      o.prs += r.prs; o.ctn += r.ctn; o.dates.add(r.rdLabel);
      if (r.notProduced) o.notes.push(r.notProduced);
    }

    /* Xuất kho (lệnh đã xác nhận) theo đơn+size — dòng MIX phân bổ theo size */
    const ship = shippedLines();
    const shipByOrdSize = {}, shipByOrd = {};
    for (const l of ship) {
      const perSize = (l.kind === "mix" && l.sizes)
        ? (l.qty > 0 ? l.sizes : {})
        : { [l.sz]: l.qty };
      for (const [sz, q] of Object.entries(perSize))
        shipByOrdSize[l.ord + "|" + sz] = (shipByOrdSize[l.ord + "|" + sz] || 0) + q;
      const o = shipByOrd[l.ord] || (shipByOrd[l.ord] = { prs: 0, ctn: 0, last: null, onTimePrs: 0 });
      o.prs += l.qty; o.ctn += l.ctn;
      if (!o.last || l.actualDate > o.last) o.last = l.actualDate;
    }
    U._recvByOrdSize = recvByOrdSize;
    U._shipByOrdSize = shipByOrdSize;

    /* ── Danh mục đơn hàng (mức ĐƠN / CHỈ THỊ) ── */
    const list = [];
    for (const [ord, rows] of U.groupBy(TVS_ORDERS, r => r.ord)) {
      const rec = recvByOrd[ord], shp = shipByOrd[ord];
      const sizes = {};
      for (const r of rows) {
        sizes[r.sz] = sizes[r.sz] || { ordered: 0, ctn: 0, received: 0, shipped: 0 };
        sizes[r.sz].ordered += r.prs; sizes[r.sz].ctn += r.ctn;
      }
      for (const sz of Object.keys(sizes)) {
        sizes[sz].received = recvByOrdSize[ord + "|" + sz] || 0;
        sizes[sz].shipped = shipByOrdSize[ord + "|" + sz] || 0;
      }
      const prs = U.sum(rows, r => r.prs), ctn = U.sum(rows, r => r.ctn);
      const rPrs = rec ? rec.prs : 0, sPrs = shp ? shp.prs : 0;
      const d = rows[0].d;
      const o = {
        ord, rows, sizes,
        ctry: rows[0].ctry, po: U.uniq(rows, r => r.po).filter(Boolean).join(", "),
        col: U.uniq(rows, r => r.col).join(", "),
        d, bat: rows[0].bat,
        prs, ctn,
        recvPrs: rPrs, recvCtn: rec ? rec.ctn : 0,
        recvDates: rec ? [...rec.dates] : [],
        notes: rec ? rec.notes : [],
        short: prs - rPrs,
        shipPrs: sPrs, shipCtn: shp ? shp.ctn : 0,
        tonPrs: rPrs - sPrs,
        lastShipDate: shp ? shp.last : null,
        onTime: shp ? (shp.last <= d) : null,       // đúng hạn nếu ngày thực xuất cuối ≤ ngày xuất KD
        delayDays: shp ? U.daysBetween(d, shp.last) : null, // >0 = trễ, <0 = sớm
        status: rPrs === 0 ? "pending" : (rPrs >= prs ? "full" : "partial"),
        daysLeft: U.daysFromToday(d),
        isLocal: rows.every(r => r._id),
      };
      list.push(o);
    }
    list.sort((a, b) => a.d.localeCompare(b.d) || a.ord.localeCompare(b.ord));
    U.ORDER_INDEX = list;

    /* ── Khối N-X-T tổng ── */
    const nhapPrs = U.sum(TVS_RECEIPTS, r => r.prs);
    const nhapCtn = U.sum(TVS_RECEIPTS, r => r.ctn);
    const xuatPrs = U.sum(ship, l => l.qty);
    const xuatCtn = U.sum(ship, l => l.ctn);
    const datPrs = U.sum(TVS_ORDERS, r => r.prs);
    const datCtn = U.sum(TVS_ORDERS, r => r.ctn);
    U.NXT = {
      datPrs, datCtn, nhapPrs, nhapCtn, xuatPrs, xuatCtn,
      tonPrs: nhapPrs - xuatPrs, tonCtn: nhapCtn - xuatCtn,
      conSXPrs: datPrs - nhapPrs,
      progress: datPrs ? nhapPrs / datPrs : 0,
    };

    /* ── Thiếu hụt ── */
    const shorts = [];
    for (const r of TVS_RECEIPTS)
      if (r.diff < 0) shorts.push({ type: "thiếu khi nhập", ord: r.ord, ctry: r.ctry, sz: r.sz, qty: -r.diff, note: `Nhập ${r.prs}/${r.ordered} đôi` });
    for (const o of list)
      for (const n of o.notes) {
        const m = n.match(/UK\s*(\d+)\s*=\s*(\d+)/i);
        if (m) shorts.push({ type: "chưa sản xuất", ord: o.ord, ctry: o.ctry, sz: "UK " + m[1], qty: +m[2], note: "Ghi chú nhập kho: " + n });
      }
    U.SHORTAGES = shorts;

    /* ── Kế hoạch xuất theo mốc ngày ── */
    const plan = [];
    for (const [d, rows] of U.groupBy(TVS_ORDERS, r => r.d)) {
      const ords = U.uniq(rows, r => r.ord).map(c => list.find(o => o.ord === c));
      plan.push({
        d, days: U.daysFromToday(d),
        prs: U.sum(rows, r => r.prs), ctn: U.sum(rows, r => r.ctn),
        orders: ords,
        ctries: U.uniq(rows, r => r.ctry),
        ready: U.sum(ords, o => o.recvPrs),
        shipped: U.sum(ords, o => o.shipPrs),
      });
    }
    U.SHIP_PLAN = plan.sort((a, b) => a.d.localeCompare(b.d));

    /* ── Tỷ lệ xuất đúng hạn ── */
    const shippedOrders = list.filter(o => o.shipPrs > 0);
    const onTimeOrders = shippedOrders.filter(o => o.onTime);
    const pairsOnTime = U.sum(ship.filter(l => {
      const o = list.find(x => x.ord === l.ord);
      return o && l.actualDate <= o.d;
    }), l => l.qty);
    U.ONTIME = {
      n: shippedOrders.length,
      onTimeN: onTimeOrders.length,
      rate: shippedOrders.length ? onTimeOrders.length / shippedOrders.length : null,
      pairs: xuatPrs, pairsOnTime,
      pairsRate: xuatPrs ? pairsOnTime / xuatPrs : null,
      avgDelay: shippedOrders.length ? U.sum(shippedOrders, o => o.delayDays) / shippedOrders.length : null,
      orders: shippedOrders,
    };
  };

  U.orderByCode = code => U.ORDER_INDEX.find(o => o.ord === code);
  /* Tồn khả dụng để xuất = đã nhập − đã xuất (theo đơn + size) */
  U.avail = (ord, sz) => (U._recvByOrdSize[ord + "|" + sz] || 0) - (U._shipByOrdSize[ord + "|" + sz] || 0);
  U.availOrd = ord => {
    const o = U.orderByCode(ord);
    return o ? o.recvPrs - o.shipPrs : 0;
  };

  U.rebuild();
  window.U = U;
})();
