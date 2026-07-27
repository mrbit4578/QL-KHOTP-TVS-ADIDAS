/* ═══════════════════════════════════════════════════════════════════
   store.js — LỚP DỮ LIỆU ĐỘNG (localStorage)
   • Dữ liệu gốc Excel (data.js) = bất biến, chỉ đọc
   • Dữ liệu nhập tay / import / lệnh giao hàng = lưu localStorage,
     phủ lên dữ liệu gốc mỗi lần tải trang
   • Kèm bộ công cụ CSV: xuất file mẫu, xuất dữ liệu, đọc & kiểm tra file import
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const KEY = "TVS_STORE_V1";
  const Store = {};

  /* ── Giữ bản gốc & nạp overlay ─────────────────────────────── */
  const SEED_ORDERS = window.TVS_ORDERS.slice();
  const SEED_RECEIPTS = window.TVS_RECEIPTS.slice();

  function blank() {
    return { ordersAdded: [], receiptsAdded: [], shipments: [], seq: 0 };
  }
  /* Kiểm tra localStorage có khả dụng không (một số môi trường nhúng chặn) */
  Store.persistent = (function () {
    try { localStorage.setItem("__tvs_t", "1"); localStorage.removeItem("__tvs_t"); return true; }
    catch (e) { return false; }
  })();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      return Object.assign(blank(), d);
    } catch (e) { return blank(); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(Store.local)); } catch (e) { /* chế độ nhớ tạm */ }
  }
  Store.local = load();

  /* Gộp gốc + overlay vào biến toàn cục cho utils.js dùng */
  Store.merge = function () {
    window.TVS_ORDERS = SEED_ORDERS.concat(Store.local.ordersAdded);
    window.TVS_RECEIPTS = SEED_RECEIPTS.concat(Store.local.receiptsAdded);
    window.TVS_SHIPMENTS = Store.local.shipments;
  };
  Store.merge();

  /* Sau mỗi thay đổi: lưu + gộp + tính lại + vẽ lại + xếp hàng đồng bộ GitHub */
  function commit() {
    persist();
    Store.merge();
    if (window.U && U.rebuild) U.rebuild();
    if (window.App && App.refresh) App.refresh();
    if (window.Sync && Sync.queue) Sync.queue();
  }
  const uid = () => "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ── PHÂN QUYỀN: chỉ tài khoản nhập liệu (editor) được thay đổi dữ liệu ── */
  Store.guard = function () {
    if (window.Auth && !Auth.canEdit()) {
      if (window.App && App.toast)
        App.toast("⛔ Bạn đang ở chế độ CHỈ XEM — đăng nhập tài khoản nhập liệu để thao tác", "warn");
      return false;
    }
    return true;
  };

  /* Nhận dữ liệu chung tải từ GitHub (không kích hoạt ghi ngược) */
  Store.replaceLocal = function (data) {
    Store.local = Object.assign(blank(), {
      ordersAdded: data.ordersAdded || [],
      receiptsAdded: data.receiptsAdded || [],
      shipments: data.shipments || [],
      seq: data.seq || 0,
    });
    persist();
    Store.merge();
    if (window.U && U.rebuild) U.rebuild();
    if (window.App && App.refresh) App.refresh();
  };

  /* ── Số phiếu tự tăng theo mẫu PXK-ADI-2026-0001 ───────────── */
  Store.nextSeq = function () {
    const n = Store.local.seq + 1;
    const p = String(n).padStart(4, "0");
    return { n, pxk: `PXK-ADI-2026-${p}`, lgh: `TVS-ADI-2026-${p}`, pkl: `TVS-PKL-2026-${p}` };
  };

  /* ── CRUD: Đơn đặt hàng & Nhập kho ─────────────────────────── */
  Store.addOrders = function (rows, src) {
    if (!Store.guard()) return;
    rows.forEach(r => { r._id = uid(); r._src = src || "manual"; });
    Store.local.ordersAdded.push(...rows);
    commit();
  };
  Store.addReceipts = function (rows, src) {
    if (!Store.guard()) return;
    rows.forEach(r => { r._id = uid(); r._src = src || "manual"; });
    Store.local.receiptsAdded.push(...rows);
    commit();
  };
  Store.removeOrderRow = function (id) {
    if (!Store.guard()) return;
    Store.local.ordersAdded = Store.local.ordersAdded.filter(r => r._id !== id);
    commit();
  };
  Store.removeReceiptRow = function (id) {
    if (!Store.guard()) return;
    Store.local.receiptsAdded = Store.local.receiptsAdded.filter(r => r._id !== id);
    commit();
  };

  /* ── CRUD: Lệnh giao hàng / Phiếu xuất kho ─────────────────── */
  Store.saveShipment = function (s) {
    if (!Store.guard()) return s;
    if (!s.id) { s.id = uid(); Store.local.seq += 1; Store.local.shipments.push(s); }
    else {
      const i = Store.local.shipments.findIndex(x => x.id === s.id);
      if (i >= 0) Store.local.shipments[i] = s; else Store.local.shipments.push(s);
    }
    commit(); return s;
  };
  Store.getShipment = id => Store.local.shipments.find(s => s.id === id);
  /* Nhu cầu xuất theo từng size của 1 dòng phiếu (hỗ trợ cả dòng MIX) */
  Store.lineNeeds = function (l) {
    if (l.kind === "mix" && l.sizes) return l.qty > 0 ? { ...l.sizes } : {};
    return l.qty > 0 ? { [l.sz]: l.qty } : {};
  };
  Store.confirmShip = function (id, actualDate) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    const s = Store.getShipment(id); if (!s) return { ok: false, msg: "Không tìm thấy phiếu" };
    /* Gộp nhu cầu theo đơn+size (nhiều dòng có thể chung size) rồi so với tồn khả dụng */
    const need = {};
    for (const l of s.lines)
      for (const [sz, q] of Object.entries(Store.lineNeeds(l)))
        need[l.ord + "|" + sz] = (need[l.ord + "|" + sz] || 0) + q;
    for (const [key, q] of Object.entries(need)) {
      const [ord, sz] = key.split("|");
      const avail = U.avail(ord, sz);
      if (q > avail) return { ok: false, msg: `${ord} ${sz}: cần xuất ${q} > tồn khả dụng ${avail} đôi` };
    }
    s.status = "shipped"; s.actualDate = actualDate;
    commit(); return { ok: true };
  };

  /* ── PACKING LIST: nhóm thùng theo chỉ thị (nguồn CLP) ─────── */
  /* Trả về các nhóm dòng đúng như packing list (thùng nguyên / thùng lẻ /
     thùng MIX size). Đơn không có trong packing → sinh nhóm chuẩn 6 đôi/thùng. */
  Store.packingGroups = function (ord) {
    const p = (window.TVS_PACKING || {})[ord];
    if (p) return p.groups.map((g, i) => ({ ...g, sizes: { ...g.sizes }, gi: i, synthetic: false }));
    const o = U.orderByCode(ord);
    if (!o) return [];
    return U.SIZES.filter(s => o.sizes[s]).map((s, i) => ({
      sizes: { [s]: o.sizes[s].ordered }, prs: o.sizes[s].ordered,
      perCtn: TVS_META.packing, ctn: Math.ceil(o.sizes[s].ordered / TVS_META.packing),
      from: null, to: null, box: "", mix: false, gi: i, synthetic: true,
    }));
  };
  Store.hasPacking = ord => !!(window.TVS_PACKING || {})[ord];
  Store.revertShip = function (id) {
    if (!Store.guard()) return;
    const s = Store.getShipment(id); if (!s) return;
    s.status = "draft"; s.actualDate = null;
    commit();
  };
  Store.deleteShipment = function (id) {
    if (!Store.guard()) return;
    Store.local.shipments = Store.local.shipments.filter(s => s.id !== id);
    commit();
  };
  /* Nhập/sửa NGÀY THỰC XUẤT trực tiếp trên màn hình lệnh giao hàng.
     • Phiếu đã xuất: cập nhật ngày → tự tính lại tỷ lệ đúng hạn
     • Phiếu nháp: lưu ngày dự kiến để lần "Xuất kho" điền sẵn */
  Store.setActualDate = function (id, iso) {
    if (!Store.guard()) return;
    const s = Store.getShipment(id); if (!s) return;
    s.actualDate = iso || null;
    commit();
  };

  Store.counts = () => ({
    orders: Store.local.ordersAdded.length,
    receipts: Store.local.receiptsAdded.length,
    shipments: Store.local.shipments.length,
  });
  Store.resetAll = function () {
    if (!Store.guard()) return;
    Store.local = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
    commit();
  };

  /* ═══════════════ CSV: tải xuống / file mẫu / import ═══════════════ */
  const esc = v => {
    v = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  Store.downloadCSV = function (filename, rows) {
    const body = rows.map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  };

  /* Đọc CSV: tự nhận dấu phân cách , ; hoặc tab — hỗ trợ ô có ngoặc kép */
  Store.parseCSV = function (text) {
    text = text.replace(/^﻿/, "");
    const firstLine = (text.split(/\r?\n/)[0] || "");
    const delim = [",", ";", "\t"].map(d => [d, firstLine.split(d).length])
      .sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let cur = [""], inQ = false, ci = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur[ci] += '"'; i++; } else inQ = false; }
        else cur[ci] += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { cur.push(""); ci++; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        rows.push(cur); cur = [""]; ci = 0;
      } else cur[ci] += ch;
    }
    if (cur.length > 1 || cur[0] !== "") rows.push(cur);
    return rows.filter(r => r.some(c => String(c).trim() !== ""));
  };

  /* Ngày: nhận dd/mm/yyyy hoặc yyyy-mm-dd → ISO */
  Store.parseDate = function (s) {
    s = String(s || "").trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
  };
  const normSize = s => {
    const m = String(s || "").toUpperCase().replace(/\s+/g, " ").trim().match(/^(?:UK\s*)?([3-9])$/);
    return m ? "UK " + m[1] : null;
  };
  const toInt = v => {
    const n = parseInt(String(v).replace(/[.\s]/g, "").replace(",", "."), 10);
    return isNaN(n) ? null : n;
  };

  /* ── File mẫu ──────────────────────────────────────────────── */
  Store.templateOrders = function () {
    Store.downloadCSV("MAU_IMPORT_DON_DAT_HANG.csv", [
      ["Ngày xuất KD", "Quốc gia", "Đơn hàng", "PO", "Màu", "Size", "Số đôi", "Số thùng", "Đợt đặt hàng"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "UK 4", "120", "", "3"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "UK 5", "240", "", "3"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "UK 6", "240", "40", "3"],
    ]);
  };
  Store.templateReceipts = function () {
    /* Mẫu ĐÚNG theo file "chi tiet nhap kho theo ngay.xlsx" — 1 dòng/ngày/chỉ thị,
       cột size 3→10. Hệ thống nhận cả file .xlsx gốc lẫn .csv theo mẫu này. */
    Store.downloadCSV("MAU_IMPORT_NHAP_KHO_THEO_NGAY.csv", [
      ["Ngày Nhập Kho", "Ghi chú", "Đơn Hàng OK", "Quốc gia", "Chỉ thị", "PO", "Mã hàng", "Màu sắc", "3", "4", "5", "6", "7", "8", "9", "10", "Tổng dôi"],
      ["18/07/2026", "", "", "CANADA", "AE2607171", "0903083861-1", "NVQ89", "LC1783", "", "22", "71", "116", "", "", "", "", "209"],
      ["19/07/2026", "UK 9 = 23", "", "CANADA", "AE2607171", "0903083861-1", "NVQ89", "LC1783", "", "", "", "", "110", "60", "", "", "170"],
    ]);
  };
  Store.templateShipments = function () {
    Store.downloadCSV("MAU_IMPORT_PHIEU_XUAT_KHO.csv", [
      ["Số phiếu", "Ngày phiếu", "Chỉ thị", "Size", "SL thực xuất", "Ghi chú"],
      ["", "20/07/2026", "AE2607131", "UK 4", "60", ""],
      ["", "20/07/2026", "AE2607131", "UK 5", "65", ""],
      ["", "20/07/2026", "AE2607172", "UK 5", "103", ""],
    ]);
  };

  /* ── Import ĐƠN ĐẶT HÀNG ───────────────────────────────────── */
  Store.importOrders = function (text) {
    const rows = Store.parseCSV(text); const out = [], errs = [];
    const start = rows.length && /ngày|ngay/i.test(rows[0][0]) ? 1 : 0;
    const existsSize = (ord, sz) => TVS_ORDERS.some(r => r.ord === ord && r.sz === sz)
      || out.some(r => r.ord === ord && r.sz === sz);
    for (let i = start; i < rows.length; i++) {
      const [d0, ctry, ord0, po, col0, sz0, prs0, ctn0, bat0] = rows[i].map(c => String(c).trim());
      const line = i + 1;
      if (!ord0) continue;
      const ord = ord0.toUpperCase(), d = Store.parseDate(d0), sz = normSize(sz0),
        prs = toInt(prs0), bat = toInt(bat0) || 1, col = (col0 || "").toUpperCase();
      if (!d) { errs.push(`Dòng ${line}: ngày xuất KD "${d0}" sai (cần dd/mm/yyyy)`); continue; }
      if (!sz) { errs.push(`Dòng ${line}: size "${sz0}" không hợp lệ (UK 3–UK 9)`); continue; }
      if (!prs || prs <= 0) { errs.push(`Dòng ${line}: số đôi "${prs0}" phải > 0`); continue; }
      if (!ctry) { errs.push(`Dòng ${line}: thiếu quốc gia`); continue; }
      if (existsSize(ord, sz)) { errs.push(`Dòng ${line}: ${ord} đã có size ${sz} trong hệ thống`); continue; }
      out.push({ d, ctry: ctry.toUpperCase(), ord, po: po || "", col: col || "LC1783", sz,
        prs, ctn: toInt(ctn0) || Math.ceil(prs / TVS_META.packing), bat });
    }
    return { rows: out, errs };
  };

  /* ── Import NHẬP KHO (mapping tự động từ đơn đặt hàng) ─────── */
  Store.importReceipts = function (text) {
    const rows = Store.parseCSV(text); const out = [], errs = [];
    const start = rows.length && /ngày|ngay/i.test(rows[0][0]) ? 1 : 0;
    for (let i = start; i < rows.length; i++) {
      const [d0, ord0, sz0, prs0, qc0, qcd0, note0] = rows[i].map(c => String(c).trim());
      const line = i + 1;
      if (!ord0) continue;
      const ord = ord0.toUpperCase(), rd = Store.parseDate(d0), sz = normSize(sz0), prs = toInt(prs0);
      const o = U.orderByCode(ord);
      if (!o) { errs.push(`Dòng ${line}: chỉ thị "${ord}" không có trong đơn đặt hàng`); continue; }
      if (!rd) { errs.push(`Dòng ${line}: ngày NK "${d0}" sai (cần dd/mm/yyyy)`); continue; }
      if (!sz || !o.sizes[sz]) { errs.push(`Dòng ${line}: ${ord} không đặt size "${sz0}"`); continue; }
      if (!prs || prs <= 0) { errs.push(`Dòng ${line}: số đôi "${prs0}" phải > 0`); continue; }
      const ordered = o.sizes[sz].ordered, recvBefore = o.sizes[sz].received;
      out.push({
        rd, rdLabel: U.fmtDate(rd), ctry: o.ctry, ord, po: o.po, item: TVS_META.itemCode,
        col: o.col.split(",")[0].trim(), sz, prs, ctn: Math.ceil(prs / TVS_META.packing),
        qcQty: toInt(qc0), qcDate: Store.parseDate(qcd0), ordered,
        diff: (recvBefore + prs) - ordered, bat: o.bat, actualExp: null, planExp: o.d,
        notProduced: note0 || null,
      });
    }
    return { rows: out, errs };
  };

  /* ── Import NHẬP KHO THEO NGÀY (mẫu pivot — đúng file gốc) ──── */
  /* Nhận mảng 2 chiều (từ .xlsx qua XlsxLite hoặc .csv qua parseCSV).
     Tự tìm dòng tiêu đề, unpivot cột size 3→10 thành từng dòng nhập kho,
     mapping tự động Quốc gia/PO/Mã hàng/Màu/SL đặt/Đợt/Ngày xuất KD từ đơn hàng. */
  const normTxt = s => String(s ?? "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

  Store.importReceiptsDaily = function (rows) {
    const errs = [], out = [], pivot = [], warns = [];
    const warnedOrds = new Set();
    /* 1. Tìm dòng tiêu đề */
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cs = (rows[i] || []).map(normTxt);
      if (cs.some(c => c.includes("chi thi")) && cs.some(c => c.includes("ngay"))) { hi = i; break; }
    }
    if (hi < 0) return { rows: [], errs: ["Không tìm thấy dòng tiêu đề — cần các cột 'Ngày Nhập Kho' và 'Chỉ thị' như file mẫu"], pivot };
    const H = (rows[hi] || []).map(normTxt);
    const ix = {
      date: H.findIndex(c => c.includes("ngay")),
      note: H.findIndex(c => c.includes("ghi chu")),
      ctry: H.findIndex(c => c.includes("quoc gia")),
      ord: H.findIndex(c => c.includes("chi thi")),
    };
    const sizeCols = [];
    H.forEach((h, i) => {
      const m = h.match(/^(?:uk\s*)?([1-9]|10)$/);
      if (m) sizeCols.push({ idx: i, n: +m[1], sz: "UK " + m[1] });
    });
    if (!sizeCols.length) return { rows: [], errs: ["Không thấy cột size (3, 4, 5… hoặc UK 3…) trên dòng tiêu đề"], pivot };

    /* 2. Đọc từng dòng dữ liệu, cộng dồn để tính thiếu/đủ tuần tự */
    const addedSoFar = {};
    const readDate = v => {
      if (typeof v === "number" && window.XlsxLite) { const d = XlsxLite.serialToISO(v); if (d) return d; }
      return Store.parseDate(v);
    };
    for (let i = hi + 1; i < rows.length; i++) {
      const R = rows[i] || [];
      const line = i + 1;
      const ordRaw = String(R[ix.ord] ?? "").trim();
      if (!ordRaw) continue;
      const ord = ordRaw.toUpperCase();
      const o = U.orderByCode(ord);
      if (!o) { errs.push(`Dòng ${line}: chỉ thị "${ordRaw}" không có trong đơn đặt hàng`); continue; }
      if (!warnedOrds.has(ord) && o.recvPrs > 0) {
        warnedOrds.add(ord);
        warns.push(`${ord} đã có ${o.recvPrs} đôi nhập kho trong hệ thống — import sẽ CỘNG THÊM, kiểm tra tránh trùng lặp dữ liệu`);
      }
      const rd = readDate(R[ix.date]);
      if (!rd) { errs.push(`Dòng ${line}: ngày nhập kho "${R[ix.date] ?? ""}" không hợp lệ (dd/mm/yyyy)`); continue; }
      const note = ix.note >= 0 ? String(R[ix.note] ?? "").trim() : "";
      const pv = { rd, rdLabel: U.fmtDate(rd), ord, ctry: o.ctry, col: o.col.split(",")[0].trim(), po: o.po, sizes: {}, total: 0 };
      let first = true;
      for (const sc of sizeCols) {
        const q = parseInt(String(R[sc.idx] ?? "").replace(/[.\s]/g, ""), 10);
        if (!q || q <= 0) continue;
        if (!o.sizes[sc.sz]) { errs.push(`Dòng ${line}: ${ord} không đặt size ${sc.sz} (SL ${q} bị bỏ qua)`); continue; }
        const key = ord + "|" + sc.sz;
        const before = (o.sizes[sc.sz].received || 0) + (addedSoFar[key] || 0);
        out.push({
          rd, rdLabel: U.fmtDate(rd), ctry: o.ctry, ord, po: o.po, item: TVS_META.itemCode,
          col: o.col.split(",")[0].trim(), sz: sc.sz, prs: q, ctn: Math.ceil(q / TVS_META.packing),
          qcQty: null, qcDate: null, ordered: o.sizes[sc.sz].ordered,
          diff: (before + q) - o.sizes[sc.sz].ordered, bat: o.bat, actualExp: null, planExp: o.d,
          notProduced: first && note ? note : null,
        });
        addedSoFar[key] = (addedSoFar[key] || 0) + q;
        pv.sizes[sc.sz] = q; pv.total += q;
        first = false;
      }
      if (pv.total > 0) pivot.push(pv);
    }
    return { rows: out, errs, pivot, warns };
  };

  /* Tự nhận dạng định dạng file import nhập kho:
     • pivot theo ngày (có cột size số) → importReceiptsDaily
     • mẫu đơn giản cũ (cột "Size" + "Số đôi") → importReceipts   */
  Store.importReceiptsAuto = function (rows) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cs = (rows[i] || []).map(normTxt);
      if (cs.some(c => /^(?:uk\s*)?[1-9]$|^(?:uk\s*)?10$/.test(c))) {
        const r = Store.importReceiptsDaily(rows);
        r.format = "daily"; return r;
      }
      if (cs.some(c => c === "size") && cs.some(c => c.includes("so doi"))) break;
    }
    const csv = rows.map(r => (r || []).map(c => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
    const r = Store.importReceipts(csv);
    r.format = "simple"; r.pivot = []; r.warns = []; return r;
  };

  /* ── Import PHIẾU XUẤT KHO → tạo lệnh nháp ─────────────────── */
  Store.importShipments = function (text) {
    const rows = Store.parseCSV(text); const errs = [];
    const start = rows.length && /số phiếu|so phieu|phiếu/i.test(rows[0][0] + rows[0][1]) ? 1 : 0;
    const groups = new Map();
    for (let i = start; i < rows.length; i++) {
      const [code0, d0, ord0, sz0, qty0, note0] = rows[i].map(c => String(c).trim());
      const line = i + 1;
      if (!ord0) continue;
      const ord = ord0.toUpperCase(), sz = normSize(sz0), qty = toInt(qty0);
      const d = Store.parseDate(d0) || TVS_META.today;
      const o = U.orderByCode(ord);
      if (!o) { errs.push(`Dòng ${line}: chỉ thị "${ord}" không tồn tại`); continue; }
      if (!sz || !o.sizes[sz]) { errs.push(`Dòng ${line}: ${ord} không có size "${sz0}"`); continue; }
      if (!qty || qty <= 0) { errs.push(`Dòng ${line}: SL thực xuất "${qty0}" phải > 0`); continue; }
      const avail = U.avail(ord, sz);
      if (qty > avail) { errs.push(`Dòng ${line}: ${ord} ${sz} xuất ${qty} > tồn khả dụng ${avail}`); continue; }
      const key = code0 || "(tự sinh)";
      if (!groups.has(key)) groups.set(key, { code: code0, date: d, lines: [] });
      groups.get(key).lines.push({
        kind: "run", ord, ctry: o.ctry, po: o.po, style: TVS_META.itemCode, col: o.col.split(",")[0].trim(),
        sz, perCtn: TVS_META.packing, groupPrs: o.sizes[sz].ordered, from: null, to: null,
        req: o.sizes[sz].ordered, qty, ctn: Math.ceil(qty / TVS_META.packing), note: note0 || "",
      });
    }
    return { groups: [...groups.values()], errs };
  };

  window.Store = Store;
})();
