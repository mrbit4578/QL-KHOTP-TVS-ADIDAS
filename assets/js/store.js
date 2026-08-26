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
  /* PACKING LIST gốc nhúng trong data-packing.js (đợt 1 + 2 + 3) — bất biến */
  const SEED_PACKING = Object.assign({}, window.TVS_PACKING || {});

  function blank() {
    return { ordersAdded: [], receiptsAdded: [], shipments: [], seq: 0, receiptEdits: {},
             orderEdits: {}, seedReceiptsOff: false,
             /* v5.0 — packing list import cho các đợt 4, 5, 6… */
             packingAdded: {}, packingMeta: {}, packingLog: [] };
  }
  const SIZES6 = ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9"];
  const PK = (window.TVS_META && TVS_META.packing) || 6;
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

  /* ── Áp override SỬA/XÓA dòng ma trận nhập kho (theo nhóm ngày+chỉ thị) ──
     Hoạt động cho cả dòng Excel gốc lẫn dòng nhập thêm. Không đụng seed gốc. */
  const gkOf = r => r.rdLabel + "||" + r.ord;
  function applyReceiptEdits(rows) {
    const edits = Store.local.receiptEdits || {};
    if (!Object.keys(edits).length) return rows;
    const byKey = {};
    rows.forEach(r => { (byKey[gkOf(r)] = byKey[gkOf(r)] || []).push(r); });
    const out = [], editedOrders = new Set(), handled = new Set();
    for (const r of rows) {
      const gk = gkOf(r), e = edits[gk];
      if (!e) { out.push(r); continue; }
      editedOrders.add(r.ord);
      if (e.deleted) continue;                 // đã xóa → bỏ toàn nhóm
      if (!e.sizes) { out.push(r); continue; }  // không override size
      if (handled.has(gk)) continue;
      handled.add(gk);
      const base = byKey[gk], tmpl = base[0];
      SIZES6.forEach(sz => {
        const q = e.sizes[sz];
        if (!q || q <= 0) return;
        const src = base.find(x => x.sz === sz) || tmpl;
        out.push(Object.assign({}, src, { sz, prs: q, ctn: Math.ceil(q / PK), _edited: true, _rev: e.rev }));
      });
    }
    if (editedOrders.size) {
      for (let i = 0; i < out.length; i++)
        if (editedOrders.has(out[i].ord)) out[i] = Object.assign({}, out[i]); // clone, tránh sửa seed
      recomputeDiffs(out, editedOrders);
    }
    return out;
  }
  /* Tính lại cột Thiếu/Đủ cho các đơn có chỉnh sửa (dòng cuối mỗi size mang net) */
  function recomputeDiffs(rows, ordSet) {
    const ordered = {}, recv = {}, lastIdx = {};
    for (const o of (window.TVS_ORDERS || [])) {
      if (!ordSet.has(o.ord)) continue;
      ordered[o.ord + "|" + o.sz] = (ordered[o.ord + "|" + o.sz] || 0) + o.prs;
    }
    rows.forEach((r, i) => {
      if (!ordSet.has(r.ord)) return;
      recv[r.ord + "|" + r.sz] = (recv[r.ord + "|" + r.sz] || 0) + r.prs;
      lastIdx[r.ord + "|" + r.sz] = i;
    });
    rows.forEach((r, i) => {
      if (!ordSet.has(r.ord)) return;
      const key = r.ord + "|" + r.sz;
      r.diff = (lastIdx[key] === i) ? (recv[key] - (ordered[key] || 0)) : 0;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     ÁP OVERRIDE SỬA / XOÁ ĐƠN ĐẶT HÀNG (v4.8) — khoá theo MÃ ĐƠN
     Hoạt động cho cả đơn Excel gốc lẫn đơn nhập tay/import.
     Không bao giờ ghi đè mảng seed gốc (luôn tạo bản sao dòng).
       edit = { rev, deleted, head:{d,ctry,po,col,bat}, sizes:{"UK 4":120,…}, log:[] }
     ══════════════════════════════════════════════════════════════ */
  function applyOrderEdits(rows) {
    const edits = Store.local.orderEdits || {};
    if (!Object.keys(edits).length) return rows;
    const out = [], handled = new Set();
    const byOrd = {};
    rows.forEach(r => { (byOrd[r.ord] = byOrd[r.ord] || []).push(r); });

    for (const r of rows) {
      const e = edits[r.ord];
      if (!e) { out.push(r); continue; }
      if (e.deleted) continue;                       // đơn đã xoá → bỏ toàn bộ dòng
      if (!e.sizes) { out.push(headed(r, e)); continue; }  // chỉ sửa thông tin chung
      if (handled.has(r.ord)) continue;              // ma trận size đã dựng lại 1 lần
      handled.add(r.ord);
      const base = byOrd[r.ord], tmpl = base[0];
      SIZES6.forEach(sz => {
        const q = parseInt(e.sizes[sz], 10) || 0;
        if (q <= 0) return;
        const src = base.find(x => x.sz === sz) || tmpl;
        out.push(headed(Object.assign({}, src, {
          sz, prs: q, ctn: Math.ceil(q / PK), _edited: true, _rev: e.rev,
        }), e));
      });
    }
    return out;
  }
  /* Ghi đè thông tin chung (ngày xuất KD / quốc gia / PO / màu / đợt) lên 1 dòng */
  function headed(r, e) {
    if (!e || !e.head) return r;
    const h = e.head, patch = { _edited: true, _rev: e.rev };
    if (h.d) patch.d = h.d;
    if (h.ctry) patch.ctry = h.ctry;
    if (h.po !== undefined && h.po !== null) patch.po = h.po;
    if (h.col) patch.col = h.col;
    if (h.bat) patch.bat = +h.bat;
    return Object.assign({}, r, patch);
  }

  /* Gộp gốc + overlay vào biến toàn cục cho utils.js dùng.
     seedReceiptsOff = true → KHÔNG dùng dữ liệu nhập kho gốc (đã thay thế bằng
     dữ liệu import/nhập tay). Bật/tắt được, khôi phục lại lúc nào cũng được. */
  Store.merge = function () {
    window.TVS_ORDERS = applyOrderEdits(SEED_ORDERS.concat(Store.local.ordersAdded));
    const base = Store.local.seedReceiptsOff ? [] : SEED_RECEIPTS;
    window.TVS_RECEIPTS = applyReceiptEdits(base.concat(Store.local.receiptsAdded));
    window.TVS_SHIPMENTS = Store.local.shipments;
    /* Packing list = gốc (đợt 1–3) + packing import thêm (đợt 4, 5, 6…) */
    window.TVS_PACKING = Object.assign({}, SEED_PACKING, Store.local.packingAdded || {});
  };
  Store.merge();

  /* ── Thông tin & điều khiển DỮ LIỆU GỐC nhập kho ── */
  Store.seedReceiptInfo = () => ({
    off: !!Store.local.seedReceiptsOff,
    rows: SEED_RECEIPTS.length,
    prs: SEED_RECEIPTS.reduce((a, r) => a + r.prs, 0),
    groups: [...new Set(SEED_RECEIPTS.map(r => r.rdLabel + "||" + r.ord))].length,
  });
  /* Bỏ dùng / dùng lại dữ liệu nhập kho gốc (fix cứng trong data.js) */
  Store.setSeedReceipts = function (on) {
    if (!Store.guard()) return;
    Store.local.seedReceiptsOff = !on;
    commit();
  };
  /* Khôi phục toàn bộ dữ liệu nhập kho về gốc ban đầu:
     bật lại seed, xoá dòng bổ sung & mọi chỉnh sửa/xoá đã ghi */
  Store.resetReceiptsToSeed = function () {
    if (!Store.guard()) return;
    Store.local.seedReceiptsOff = false;
    Store.local.receiptsAdded = [];
    Store.local.receiptEdits = {};
    commit();
  };
  /* Xoá sạch dữ liệu nhập kho hiện có (kể cả gốc) để nạp bộ dữ liệu mới */
  Store.clearAllReceipts = function () {
    if (!Store.guard()) return;
    Store.local.seedReceiptsOff = true;
    Store.local.receiptsAdded = [];
    Store.local.receiptEdits = {};
    commit();
  };

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
      receiptEdits: data.receiptEdits || {},
      orderEdits: data.orderEdits || {},
      seedReceiptsOff: !!data.seedReceiptsOff,
      packingAdded: data.packingAdded || {},
      packingMeta: data.packingMeta || {},
      packingLog: data.packingLog || [],
    });
    persist();
    Store.merge();
    if (window.U && U.rebuild) U.rebuild();
    if (window.App && App.refresh) App.refresh();
  };

  /* ── SỬA / XÓA dòng ma trận nhập kho + NHẬT KÝ (số lần sửa · lý do) ──
     Nhóm = 1 dòng ma trận = (Ngày NK + Chỉ thị). newSizes = { "UK 4": số đôi, … } */
  Store.receiptGroupSizes = function (rdLabel, ord) {
    const sizes = {};
    (window.TVS_RECEIPTS || []).forEach(r => {
      if (r.rdLabel === rdLabel && r.ord === ord) sizes[r.sz] = (sizes[r.sz] || 0) + r.prs;
    });
    return sizes;
  };
  Store.receiptEditInfo = function (rdLabel, ord) {
    return (Store.local.receiptEdits || {})[rdLabel + "||" + ord] || null;
  };
  const whoAmI = () => (window.Auth && Auth.current ? Auth.current.u : "?");

  Store.editReceiptGroup = function (rdLabel, ord, newSizes, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    if (!reason || !reason.trim()) return { ok: false, msg: "Vui lòng nhập lý do sửa" };
    const before = Store.receiptGroupSizes(rdLabel, ord);
    const after = {};
    Object.keys(newSizes || {}).forEach(sz => { const q = parseInt(newSizes[sz], 10) || 0; if (q > 0) after[sz] = q; });
    if (!Object.keys(after).length) return { ok: false, msg: "Phải còn ít nhất 1 size > 0 (muốn bỏ hết hãy dùng Xóa)" };
    const gk = rdLabel + "||" + ord;
    const e = (Store.local.receiptEdits[gk]) || { rev: 0, log: [] };
    e.rev += 1; e.sizes = after; e.deleted = false;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), reason: reason.trim(), before, after });
    Store.local.receiptEdits[gk] = e;
    commit();
    return { ok: true, rev: e.rev };
  };
  Store.deleteReceiptGroup = function (rdLabel, ord, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    if (!reason || !reason.trim()) return { ok: false, msg: "Vui lòng nhập lý do xóa" };
    const before = Store.receiptGroupSizes(rdLabel, ord);
    const gk = rdLabel + "||" + ord;
    const e = (Store.local.receiptEdits[gk]) || { rev: 0, log: [] };
    e.rev += 1; e.deleted = true; e.sizes = null;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), reason: reason.trim(), before, after: null });
    Store.local.receiptEdits[gk] = e;
    commit();
    return { ok: true };
  };
  /* Khôi phục nhóm về trạng thái gốc (gỡ mọi override, giữ nhật ký) */
  Store.restoreReceiptGroup = function (rdLabel, ord, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    const gk = rdLabel + "||" + ord;
    const e = Store.local.receiptEdits[gk]; if (!e) return { ok: false, msg: "Nhóm chưa có chỉnh sửa" };
    e.rev += 1; e.deleted = false; e.sizes = null;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), reason: (reason || "Khôi phục về gốc").trim(), restored: true });
    commit();
    return { ok: true };
  };

  /* ═══════════════════════════════════════════════════════════════
     SỬA / XOÁ ĐƠN ĐẶT HÀNG NGAY TRÊN MÀN HÌNH OMS (v4.8)
     Sửa được cả đơn Excel gốc lẫn đơn nhập tay — mọi thao tác đều ghi
     nhật ký (ai sửa · lúc nào · lý do · trước/sau) và khôi phục được.
     ═══════════════════════════════════════════════════════════════ */

  /* Ma trận size hiện hành của 1 đơn: { "UK 4": 120, … } */
  Store.orderSizes = function (ord) {
    const sizes = {};
    (window.TVS_ORDERS || []).forEach(r => {
      if (r.ord === ord) sizes[r.sz] = (sizes[r.sz] || 0) + r.prs;
    });
    return sizes;
  };
  /* Thông tin chung hiện hành của 1 đơn */
  Store.orderHead = function (ord) {
    const rows = (window.TVS_ORDERS || []).filter(r => r.ord === ord);
    if (!rows.length) return null;
    const r = rows[0];
    return { d: r.d, ctry: r.ctry, po: r.po || "", col: r.col, bat: r.bat };
  };
  Store.orderEditInfo = ord => (Store.local.orderEdits || {})[ord] || null;
  /* Đơn ĐANG bị thay đổi so với gốc (khác với đơn chỉ còn nhật ký sau khi khôi phục) */
  Store.isOrderOverridden = function (ord) {
    const e = (Store.local.orderEdits || {})[ord];
    return !!(e && (e.deleted || e.sizes || e.head));
  };
  Store.orderEditCount = () =>
    Object.keys(Store.local.orderEdits || {}).filter(Store.isOrderOverridden).length;
  /* Số đơn có nhật ký chỉnh sửa (kể cả đã khôi phục về gốc) */
  Store.orderEditLogCount = () => Object.keys(Store.local.orderEdits || {}).length;
  Store.isOrderSeed = ord => SEED_ORDERS.some(r => r.ord === ord);

  /* Cảnh báo nghiệp vụ khi giảm SL đặt xuống dưới SL đã nhập kho / đã xuất kho.
     Trả về { blocks:[…], warns:[…] } — blocks làm hỏng N-X-T nên chặn lưu. */
  Store.checkOrderSizes = function (ord, newSizes) {
    const blocks = [], warns = [];
    const cur = Store.orderSizes(ord);
    SIZES6.forEach(sz => {
      const q = parseInt((newSizes || {})[sz], 10) || 0;
      const recv = (window.U && U._recvByOrdSize) ? (U._recvByOrdSize[ord + "|" + sz] || 0) : 0;
      const shipped = (window.U && U._shipByOrdSize) ? (U._shipByOrdSize[ord + "|" + sz] || 0) : 0;
      if (shipped > 0 && q < shipped)
        blocks.push(`${sz}: đã XUẤT KHO ${shipped} đôi — không thể hạ SL đặt xuống ${q}`);
      else if (recv > 0 && q < recv)
        warns.push(`${sz}: đã nhập kho ${recv} đôi > SL đặt mới ${q} → sẽ thành nhập dư`);
      if (q <= 0 && (cur[sz] || 0) > 0 && (recv > 0 || shipped > 0))
        warns.push(`${sz}: bỏ size này nhưng kho đã có phát sinh (nhập ${recv} · xuất ${shipped})`);
    });
    return { blocks, warns };
  };

  /* Sửa 1 đơn hàng: head = thông tin chung (có thể bỏ trống), sizes = ma trận size */
  Store.editOrder = function (ord, head, newSizes, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    if (!reason || !reason.trim()) return { ok: false, msg: "Vui lòng nhập lý do sửa" };
    if (!U.orderByCode(ord)) return { ok: false, msg: `Không tìm thấy đơn ${ord}` };

    const beforeSizes = Store.orderSizes(ord), beforeHead = Store.orderHead(ord);
    let after = null;
    if (newSizes) {
      after = {};
      SIZES6.forEach(sz => { const q = parseInt(newSizes[sz], 10) || 0; if (q > 0) after[sz] = q; });
      if (!Object.keys(after).length)
        return { ok: false, msg: "Phải còn ít nhất 1 size > 0 (muốn bỏ hẳn đơn hãy dùng Xoá đơn)" };
      const chk = Store.checkOrderSizes(ord, after);
      if (chk.blocks.length) return { ok: false, msg: chk.blocks.join(" · ") };
    }
    const nh = {};
    if (head) {
      if (head.d) nh.d = head.d;
      if (head.ctry) nh.ctry = String(head.ctry).trim().toUpperCase();
      if (head.po !== undefined) nh.po = String(head.po).trim();
      if (head.col) nh.col = String(head.col).trim().toUpperCase();
      if (head.bat) nh.bat = parseInt(head.bat, 10) || 1;
    }

    const e = Store.local.orderEdits[ord] || { rev: 0, log: [] };
    e.rev += 1; e.deleted = false;
    if (Object.keys(nh).length) e.head = Object.assign({}, e.head, nh);
    if (after) e.sizes = after;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), reason: reason.trim(),
      before: beforeSizes, after: after || beforeSizes,
      beforeHead, afterHead: Object.keys(nh).length ? Object.assign({}, beforeHead, nh) : null });
    Store.local.orderEdits[ord] = e;
    commit();
    return { ok: true, rev: e.rev };
  };

  /* Sửa nhanh SL 1 size ngay trên bảng (chế độ “Chi tiết từng dòng size”) */
  Store.editOrderSize = function (ord, sz, qty, reason) {
    const cur = Store.orderSizes(ord);
    if (!cur[sz] && cur[sz] !== 0) return { ok: false, msg: `Đơn ${ord} không có size ${sz}` };
    const next = Object.assign({}, cur);
    next[sz] = parseInt(qty, 10) || 0;
    return Store.editOrder(ord, null, next, reason);
  };

  /* Xoá cả đơn hàng (ẩn khỏi hệ thống, khôi phục được) */
  Store.deleteOrder = function (ord, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    if (!reason || !reason.trim()) return { ok: false, msg: "Vui lòng nhập lý do xoá" };
    const o = U.orderByCode(ord);
    if (!o) return { ok: false, msg: `Không tìm thấy đơn ${ord}` };
    if (o.shipPrs > 0)
      return { ok: false, msg: `Đơn ${ord} đã xuất kho ${o.shipPrs} đôi — huỷ phiếu xuất kho trước khi xoá đơn` };
    const e = Store.local.orderEdits[ord] || { rev: 0, log: [] };
    e.rev += 1; e.deleted = true;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), reason: reason.trim(),
      before: Store.orderSizes(ord), after: null, beforeHead: Store.orderHead(ord), afterHead: null });
    Store.local.orderEdits[ord] = e;
    commit();
    return { ok: true };
  };

  /* Khôi phục 1 đơn về đúng dữ liệu gốc (giữ nguyên nhật ký) */
  Store.restoreOrder = function (ord, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    const e = Store.local.orderEdits[ord];
    if (!e) return { ok: false, msg: "Đơn này chưa có chỉnh sửa" };
    e.rev += 1; e.deleted = false; e.sizes = null; e.head = null;
    e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(),
      reason: (reason || "Khôi phục về gốc").trim(), restored: true });
    commit();
    return { ok: true };
  };

  /* Khôi phục TOÀN BỘ đơn hàng về gốc — xoá sạch mọi override & nhật ký sửa đơn */
  Store.restoreAllOrders = function () {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    const n = Object.keys(Store.local.orderEdits || {}).length;
    Store.local.orderEdits = {};
    commit();
    return { ok: true, n };
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
    /* ⚠ Nếu mã đơn từng bị XOÁ / SỬA ma trận size, phải gỡ override — nếu không
       dòng vừa thêm sẽ bị lớp overlay ẩn đi (tưởng như không thêm được). */
    const revived = [];
    for (const ord of new Set(rows.map(r => r.ord))) {
      const e = (Store.local.orderEdits || {})[ord];
      if (e && (e.deleted || e.sizes)) {
        e.rev += 1; e.deleted = false; e.sizes = null;
        e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(), restored: true,
          reason: (src === "import" ? "Import đơn hàng mới" : "Thêm đơn hàng") +
            " — gỡ trạng thái đã xoá/đã sửa để nhận dữ liệu mới" });
        revived.push(ord);
      }
    }
    Store.local.ordersAdded.push(...rows);
    commit();
    if (revived.length && window.App && App.toast)
      App.toast(`ℹ Đã gỡ trạng thái xoá/sửa cũ của đơn ${U.esc(revived.slice(0, 3).join(", "))}${revived.length > 3 ? "…" : ""} để nhận dữ liệu mới`, "warn");
  };
  Store.addReceipts = function (rows, src, opts) {
    if (!Store.guard()) return;
    opts = opts || {};
    /* Chế độ THAY THẾ: xoá sạch dữ liệu nhập kho hiện có (kể cả gốc) trước khi nạp */
    if (opts.replaceAll) {
      Store.local.seedReceiptsOff = true;
      Store.local.receiptsAdded = [];
      Store.local.receiptEdits = {};
    }
    rows.forEach(r => { r._id = uid(); r._src = src || "manual"; });
    /* ⚠ QUAN TRỌNG: nếu nhóm (ngày + chỉ thị) từng bị XOÁ, phải gỡ cờ xoá —
       nếu không dữ liệu vừa thêm/import sẽ bị lớp override ẩn đi (không thấy gì). */
    const revived = [];
    for (const gk of new Set(rows.map(r => r.rdLabel + "||" + r.ord))) {
      const e = Store.local.receiptEdits[gk];
      if (e && (e.deleted || e.sizes)) {
        e.rev += 1; e.deleted = false; e.sizes = null;
        e.log.push({ rev: e.rev, at: new Date().toISOString(), by: whoAmI(),
          reason: (src === "import" ? "Import dữ liệu mới" : "Nhập kho mới") + " — gỡ trạng thái đã xoá/đã sửa để nhận dữ liệu mới",
          restored: true });
        revived.push(gk.split("||").join(" · "));
      }
    }
    Store.local.receiptsAdded.push(...rows);
    commit();
    if (revived.length && window.App && App.toast)
      App.toast(`ℹ Đã bỏ trạng thái xoá/sửa cũ của ${revived.length} dòng để nhận dữ liệu mới: ${U.esc(revived.slice(0, 3).join("; "))}${revived.length > 3 ? "…" : ""}`, "warn");
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
    orderEdits: Object.keys(Store.local.orderEdits || {}).filter(Store.isOrderOverridden).length,
    packing: Object.keys(Store.local.packingAdded || {}).length,
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
  /* Mẫu DẠNG NGANG — 1 dòng = 1 đơn, các cột size UK3…UK9 (giống form nhập tay).
     Hệ thống tự chuyển (unpivot) sang dạng dọc khi import. */
  Store.templateOrders = function () {
    Store.downloadCSV("MAU_IMPORT_DON_DAT_HANG_SIZE_NGANG.csv", [
      ["Ngày xuất KD", "Quốc gia", "Đơn hàng", "PO", "Màu", "Tên màu tiếng việt", "Đợt đặt hàng", "3", "4", "5", "6", "7", "8", "9", "Tổng đôi"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "MÀU ĐEN", "3", "", "120", "240", "240", "180", "60", "", "840"],
      ["15/02/2027", "GERMANY", "AE2701002", "0903999888-1", "LC1786", "MÀU NÂU", "3", "6", "60", "90", "90", "60", "30", "12", "348"],
    ]);
  };
  /* Mẫu dạng DỌC (1 dòng = 1 size) — vẫn hỗ trợ để tương thích bản cũ */
  Store.templateOrdersLong = function () {
    Store.downloadCSV("MAU_IMPORT_DON_DAT_HANG_SIZE_DOC.csv", [
      ["Ngày xuất KD", "Quốc gia", "Đơn hàng", "PO", "Màu", "Size", "Số đôi", "Số thùng", "Đợt đặt hàng"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "UK 4", "120", "", "3"],
      ["15/02/2027", "JAPAN", "AE2701001", "0903999999-1", "LC1783", "UK 5", "240", "", "3"],
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

  /* ── Import ĐƠN ĐẶT HÀNG dạng SIZE HÀNG NGANG → tự chuyển sang hàng dọc ──
     1 dòng = 1 đơn với các cột size (3,4,5… hoặc UK 3, UK 4…).
     Nhận mảng 2 chiều (từ .xlsx qua XlsxLite hoặc .csv qua parseCSV). */
  Store.importOrdersWide = function (rows) {
    const errs = [], out = [], pivot = [], warns = [];
    /* 1. Tìm dòng tiêu đề (có "Đơn hàng"/"Chỉ thị" + ít nhất 1 cột size) */
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cs = (rows[i] || []).map(normTxt);
      const hasOrd = cs.some(c => c.includes("don hang") || c.includes("chi thi"));
      const hasSize = cs.some(c => /^(?:uk\s*)?([1-9]|10)$/.test(c));
      if (hasOrd && hasSize) { hi = i; break; }
    }
    if (hi < 0) return { rows: [], errs: ["Không tìm thấy dòng tiêu đề — cần cột 'Đơn hàng' và các cột size (3, 4, 5… hoặc UK 3…)"], pivot, warns };
    const H = (rows[hi] || []).map(normTxt);
    const find = (...keys) => H.findIndex(c => keys.some(k => c.includes(k)));
    const ix = {
      d: find("ngay xuat", "ngay xk", "ngay"), ctry: find("quoc gia"),
      ord: (find("don hang") >= 0 ? find("don hang") : find("chi thi")),
      po: find("po"), col: find("mau") >= 0 && !H[find("mau")].includes("ten mau") ? find("mau") : H.findIndex(c => c === "mau"),
      colVN: H.findIndex(c => c.includes("ten mau")), bat: find("dot"),
    };
    const sizeCols = [];
    H.forEach((h, i) => { const m = h.match(/^(?:uk\s*)?([1-9]|10)$/); if (m) sizeCols.push({ idx: i, sz: "UK " + m[1] }); });

    const seenOrd = new Set();
    for (let i = hi + 1; i < rows.length; i++) {
      const R = rows[i] || [], line = i + 1;
      const ordRaw = String(R[ix.ord] ?? "").trim();
      if (!ordRaw) continue;
      const ord = ordRaw.toUpperCase();
      const d = ix.d >= 0 ? readDateCell(R[ix.d]) : null;
      if (!d) { errs.push(`Dòng ${line}: ngày xuất KD "${R[ix.d] ?? ""}" không hợp lệ (dd/mm/yyyy)`); continue; }
      const ctry = String(R[ix.ctry] ?? "").split("\n").pop().replace(/^=>/, "").trim().toUpperCase();
      if (!ctry) { errs.push(`Dòng ${line}: thiếu quốc gia`); continue; }
      const po = String(R[ix.po] ?? "").split("\n").pop().replace(/^=>/, "").trim();
      const col = String(R[ix.col] ?? "").trim().toUpperCase() || "LC1783";
      const bat = parseInt(String(R[ix.bat] ?? "").trim(), 10) || 1;
      if (U.orderByCode(ord)) warns.push(`${ord} đã tồn tại trong hệ thống — import sẽ THÊM dòng size mới (kiểm tra tránh trùng)`);
      if (seenOrd.has(ord)) warns.push(`${ord} xuất hiện nhiều lần trong file`);
      seenOrd.add(ord);

      const pv = { d, dLabel: U.fmtDate(d), ctry, ord, po, col, colVN: ix.colVN >= 0 ? String(R[ix.colVN] ?? "").trim() : "", bat, sizes: {}, total: 0 };
      let hadInput = false, dupAll = true;
      for (const sc of sizeCols) {
        const q = parseInt(String(R[sc.idx] ?? "").replace(/[.\s,]/g, ""), 10);
        if (!q || q <= 0) continue;
        hadInput = true;
        if (TVS_ORDERS.some(x => x.ord === ord && x.sz === sc.sz)) { errs.push(`Dòng ${line}: ${ord} đã có size ${sc.sz} trong hệ thống`); continue; }
        dupAll = false;
        out.push({ d, ctry, ord, po, col, sz: sc.sz, prs: q, ctn: Math.ceil(q / PK), bat });
        pv.sizes[sc.sz] = q; pv.total += q;
      }
      if (pv.total > 0) pivot.push(pv);
      else if (!hadInput) errs.push(`Dòng ${line}: ${ord} không có size nào > 0`);
      else if (dupAll) warns.push(`${ord}: tất cả size đã có sẵn trong hệ thống — dòng này bị bỏ qua`);
    }
    return { rows: out, errs, pivot, warns };
  };

  /* Đọc ô ngày: số serial Excel hoặc chuỗi dd/mm/yyyy */
  function readDateCell(v) {
    if (typeof v === "number" && window.XlsxLite) { const d = XlsxLite.serialToISO(v); if (d) return d; }
    return Store.parseDate(v);
  }

  /* Tự nhận dạng file đơn hàng: NGANG (có cột size) hay DỌC (cột Size + Số đôi) */
  Store.importOrdersAuto = function (rows) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cs = (rows[i] || []).map(normTxt);
      if (cs.some(c => /^(?:uk\s*)?([1-9]|10)$/.test(c))) {
        const r = Store.importOrdersWide(rows); r.format = "wide"; return r;
      }
      if (cs.some(c => c === "size") && cs.some(c => c.includes("so doi"))) break;
    }
    const csv = rows.map(r => (r || []).map(c => {
      const s = String(c ?? ""); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
    const r = Store.importOrders(csv);
    r.format = "long"; r.pivot = []; r.warns = []; return r;
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

  /* ═══════════════════════════════════════════════════════════════
     PACKING LIST (CLP) — IMPORT THEO MẪU CHO CÁC ĐỢT 4, 5, 6… (v5.0)
     • Đợt 1 · 2 · 3 = dữ liệu gốc nhúng trong assets/js/data-packing.js
       (95 chỉ thị — bất biến, không sửa qua web)
     • Đợt sau: chỉ cần IMPORT file .xlsx/.csv theo mẫu → hệ thống tự
       mapping thành đúng cấu trúc packing (thùng nguyên / thùng lẻ /
       thùng MIX SIZE), lưu localStorage + tự commit lên GitHub
     ═══════════════════════════════════════════════════════════════ */

  /* Chuẩn hoá tiêu đề cột: bỏ dấu · đ→d · bỏ ký tự đặc biệt */
  const pkNorm = s => String(s ?? "").toLowerCase().replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  const pkInt = v => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? Math.round(v) : null;
    const s = String(v).trim().replace(/[.\s,']/g, "");
    return /^-?\d+$/.test(s) ? parseInt(s, 10) : null;
  };
  /* Size trong packing list: 3 → 10 (UK) */
  const pkSize = v => {
    const s = pkNorm(v).replace(/^uk/, "").trim();
    const m = s.match(/^(\d{1,2})$/);
    if (!m) return null;
    const n = +m[1];
    return (n >= 3 && n <= 10) ? "UK " + n : null;
  };

  /* Dòng tiêu đề packing list: có ô "SIZE" + ô "Số thùng" + ô mã chỉ thị */
  Store.pkFindHeader = function (rows, limit) {
    limit = limit || 15;
    for (let i = 0; i < Math.min(rows.length, limit); i++) {
      const cs = (rows[i] || []).map(pkNorm);
      const hasSize = cs.some(c => c === "size" || c === "co size");
      const hasCtn = cs.some(c => c === "so thung" || c.indexOf("so thung") === 0);
      const hasOrd = cs.some(c => c.includes("chi thi") || c === "ma don" || c.includes("don hang"));
      if (hasSize && hasCtn && hasOrd) return i;
    }
    return -1;
  };

  /* Nhận diện cột — hỗ trợ mọi biến thể layout CLP (đợt 1/2/3 & về sau) */
  function pkMapCols(header) {
    const H = (header || []).map(pkNorm);
    const find = pred => { for (let i = 0; i < H.length; i++) if (H[i] && pred(H[i])) return i; return -1; };
    return {
      ord: find(c => c.includes("chi thi") || c === "ma don" || c.includes("don hang")),
      po: find(c => c === "po" || c.indexOf("po ") === 0 || c === "po no" || c === "so po"),
      col: find(c => ["art", "art no", "hinh the", "ma mau", "mau", "ma hang", "ma art"].includes(c)),
      name: find(c => c.includes("ten hinh the") || c.includes("ten hang") || c.includes("ten san pham")),
      cust: find(c => c.includes("khach hang")),
      wh: find(c => c.includes("nuoc") && c.includes("kho")),
      gender: find(c => c.includes("gioi tinh")),
      size: find(c => c === "size" || c === "co size"),
      perCtn: find(c => c.includes("doi") && c.includes("thung")),
      prs: find(c => ["so luong", "tong so doi", "so doi", "sl", "tong doi"].includes(c)),
      ctn: find(c => c === "so thung"),
      from: find(c => ["tu thung", "so thung tu", "thung tu", "tu"].includes(c)),
      to: find(c => ["den thung", "so thung den", "thung den", "den"].includes(c)),
      box: find(c => c.includes("ma hop")),
    };
  }

  /* ── Bộ máy mapping: mảng 2 chiều → { ord: {…schema TVS_PACKING…} } ──
     Quy tắc đọc (đúng như file gốc của khách adidas):
     • 1 dòng = 1 nhóm thùng (thùng nguyên hoặc thùng lẻ)
     • Dòng có SIZE nhưng TRỐNG "Số thùng"/"Từ–Đến thùng" → cùng nằm trong
       THÙNG MIX của nhóm liền trước (gộp size vào nhóm đó)
     • Dòng có số thùng từ–đến TRÙNG nhóm liền trước → cũng là thùng MIX
     • Dòng TRỐNG SIZE nhưng có tổng số đôi → dòng TỔNG của chỉ thị (đối chiếu)
     • Dòng trống mã chỉ thị → bỏ qua                                     */
  function pkParseRows(rows) {
    const errs = [], warns = [], fileTotals = {};
    const hi = Store.pkFindHeader(rows);
    if (hi < 0) return { packing: {}, order: [], errs: ["Không tìm thấy dòng tiêu đề packing list — cần các cột “Mã chỉ thị”, “SIZE”, “Số thùng” (xem file mẫu)"], warns, fileTotals };
    const ix = pkMapCols(rows[hi]);
    ["ord", "size", "prs", "ctn"].forEach(k => { if (ix[k] < 0) errs.push("Thiếu cột bắt buộc trong file: " + ({ ord: "Mã chỉ thị", size: "SIZE", prs: "Tổng số đôi", ctn: "Số thùng" })[k]); });
    if (errs.length) return { packing: {}, order: [], errs, warns, fileTotals };

    const cell = (R, k) => (ix[k] >= 0 && ix[k] < R.length ? R[ix[k]] : null);
    const packing = {}, order = [];

    for (let i = hi + 1; i < rows.length; i++) {
      const R = rows[i] || [], line = i + 1;
      const ord = String(cell(R, "ord") ?? "").trim().toUpperCase();
      if (!ord) continue;
      const sz = pkSize(cell(R, "size"));
      const prs = pkInt(cell(R, "prs"));
      let per = pkInt(cell(R, "perCtn"));
      let ctn = pkInt(cell(R, "ctn"));
      let frm = pkInt(cell(R, "from"));
      let to = pkInt(cell(R, "to"));
      const box = String(cell(R, "box") ?? "").trim();

      let p = packing[ord];
      if (!p) {
        p = packing[ord] = {
          po: String(cell(R, "po") ?? "").trim(),
          col: String(cell(R, "col") ?? "").trim().toUpperCase(),
          ctry: "",
          name: String(cell(R, "name") ?? "").trim() || "ADIDAS RAINBOOT W",
          cust: String(cell(R, "cust") ?? "").trim(),
          wh: String(cell(R, "wh") ?? "").trim(),
          gender: String(cell(R, "gender") ?? "").trim() || "Women",
          totalPrs: 0, totalCtn: 0, groups: [],
        };
        order.push(ord);
      }

      /* dòng TỔNG của chỉ thị (không có size) → chỉ dùng để đối chiếu */
      if (!sz) { if (prs) fileTotals[ord] = { prs, ctn: ctn || 0 }; continue; }
      if (!prs || prs <= 0) { errs.push(`Dòng ${line}: ${ord} size ${sz} — số đôi không hợp lệ`); continue; }

      const g = p.groups, prev = g.length ? g[g.length - 1] : null;
      let cont = false;
      if (prev) {
        if (ctn === null && frm === null && to === null) cont = true;
        else if (frm !== null && prev.from === frm && prev.to === (to === null ? frm : to)) cont = true;
      }
      if (cont) {                       /* → thùng MIX SIZE */
        prev.sizes[sz] = (prev.sizes[sz] || 0) + prs;
        prev.prs += prs;
        prev.perCtn = prev.prs;
        prev.mix = Object.keys(prev.sizes).length > 1;
        continue;
      }
      if (ctn === null || ctn <= 0) {
        if (!per) { errs.push(`Dòng ${line}: ${ord} size ${sz} — thiếu cả “Số thùng” và “Đôi/thùng”`); continue; }
        ctn = Math.ceil(prs / per);
      }
      if (!per) per = ctn ? Math.ceil(prs / ctn) : prs;
      if (frm === null) frm = prev && prev.to ? prev.to + 1 : 1;
      if (to === null) to = frm + ctn - 1;
      g.push({ sizes: { [sz]: prs }, prs, perCtn: per, ctn, from: frm, to, box, mix: false });
    }

    for (const ord of order) {
      const p = packing[ord];
      p.totalPrs = p.groups.reduce((a, g) => a + g.prs, 0);
      p.totalCtn = p.groups.reduce((a, g) => a + g.ctn, 0);
      if (!p.groups.length) { errs.push(`${ord}: không đọc được nhóm thùng nào`); continue; }
      const ft = fileTotals[ord];
      if (ft) {
        if (ft.prs !== p.totalPrs) warns.push(`${ord}: dòng TỔNG trong file ${U.fmt(ft.prs)} đôi ≠ tổng các dòng chi tiết ${U.fmt(p.totalPrs)} đôi`);
        if (ft.ctn && ft.ctn !== p.totalCtn) warns.push(`${ord}: dòng TỔNG trong file ${U.fmt(ft.ctn)} thùng ≠ tổng các dòng chi tiết ${U.fmt(p.totalCtn)} thùng`);
      }
      /* dãy số thùng phải liên tục 1..totalCtn */
      let cur = 0, bad = false;
      for (const g of p.groups) {
        if (g.from !== cur + 1 || g.to !== g.from + g.ctn - 1) { bad = true; break; }
        cur = g.to;
      }
      if (bad || cur !== p.totalCtn) warns.push(`${ord}: dãy số thùng trong file không liên tục (kiểm tra lại cột “Số thùng từ/đến”)`);
    }
    return { packing, order, errs, warns, fileTotals };
  }

  /* Chọn sheet packing tốt nhất khi file .xlsx có nhiều sheet */
  Store.pkPickSheet = function (sheets) {
    let best = null, bestScore = -1;
    (sheets || []).forEach((s, i) => {
      const n = pkNorm(s.name);
      let sc = 0;
      if (n === "clp") sc += 100; else if (n.includes("clp") || n.includes("packing")) sc += 80;
      if (Store.pkFindHeader(s.rows || []) >= 0) sc += 50;
      sc += Math.min((s.rows || []).length, 4000) / 10000 - i / 1000;
      if (sc > bestScore) { best = s; bestScore = sc; }
    });
    return best;
  };

  /* ── IMPORT chính: nhận {rows} hoặc {sheets:[{name,rows}]} ──
     Trả về đầy đủ dữ liệu để XEM TRƯỚC (preview) & đối chiếu trước khi lưu */
  Store.importPackingCLP = function (input) {
    const src = Array.isArray(input) ? { rows: input } : (input || {});
    let rows = src.rows, sheet = src.sheet || "";
    if (src.sheets && src.sheets.length) {
      const pick = Store.pkPickSheet(src.sheets);
      if (pick) { rows = pick.rows; sheet = pick.name; }
    }
    rows = rows || [];
    const r = pkParseRows(rows);
    const preview = [], dupes = [];
    let prs = 0, ctn = 0, groups = 0, mix = 0;

    for (const ord of r.order) {
      const p = r.packing[ord];
      const o = U.orderByCode(ord);
      p.ctry = o ? o.ctry : (p.ctry || "");
      const sizes = {};
      p.groups.forEach(g => Object.entries(g.sizes).forEach(([sz, q]) => { sizes[sz] = (sizes[sz] || 0) + q; }));
      const cmp = [];
      let match = "noorder";
      if (o) {
        match = "ok";
        const all = new Set([...Object.keys(sizes), ...Object.keys(o.sizes)]);
        [...all].sort((a, b) => U.sizeIdx(a) - U.sizeIdx(b)).forEach(sz => {
          const pl = sizes[sz] || 0, od = o.sizes[sz] ? o.sizes[sz].ordered : 0;
          cmp.push({ sz, pl, od });
          if (pl !== od) match = "diff";
        });
        if (match === "diff")
          r.warns.push(`${ord}: packing ${U.fmt(p.totalPrs)} đôi lệch so với đơn đặt hàng ${U.fmt(o.prs)} đôi — kiểm tra lại trước khi lưu`);
      } else {
        r.warns.push(`${ord}: chưa có trong đơn đặt hàng (OMS) — vẫn import được, hãy nhập/import đơn hàng để dùng trên phiếu xuất kho`);
      }
      const exists = Store.packingSource(ord);
      if (exists) dupes.push(ord);
      const gmix = p.groups.filter(g => g.mix).length;
      prs += p.totalPrs; ctn += p.totalCtn; groups += p.groups.length; mix += gmix;
      preview.push({
        ord, po: p.po, col: p.col, ctry: p.ctry, name: p.name, cust: p.cust, wh: p.wh,
        bat: o ? o.bat : (Store.packingBatch(ord) || null),
        prs: p.totalPrs, ctn: p.totalCtn, groups: p.groups.length, mix: gmix,
        sizes, cmp, match, exists, ordPrs: o ? o.prs : null,
      });
    }
    return {
      packing: r.packing, order: r.order, errs: r.errs, warns: r.warns,
      preview, dupes, sheet, file: src.name || "",
      totals: { orders: r.order.length, prs, ctn, groups, mix },
    };
  };

  /* ── Nguồn packing của 1 chỉ thị: 'import' | 'seed' | null ── */
  Store.packingSource = ord => (Store.local.packingAdded || {})[ord] ? "import"
    : (SEED_PACKING[ord] ? "seed" : null);
  Store.packingOf = ord => (window.TVS_PACKING || {})[ord] || null;
  Store.packingMeta = ord => (Store.local.packingMeta || {})[ord] || null;
  Store.seedPackingCount = () => Object.keys(SEED_PACKING).length;
  /* Đợt của chỉ thị: lấy từ đơn đặt hàng, nếu chưa có thì lấy từ nhật ký import */
  Store.packingBatch = function (ord) {
    const o = U.orderByCode(ord);
    if (o) return o.bat;
    const m = Store.packingMeta(ord);
    return m && m.bat ? m.bat : null;
  };

  /* ── LƯU packing đã import (ghi đè phải được người dùng xác nhận) ── */
  Store.applyPacking = function (res, opts) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    opts = opts || {};
    const reason = String(opts.reason || "").trim();
    if (!reason) return { ok: false, msg: "Vui lòng nhập lý do / ghi chú cho lần import này" };
    const ow = new Set(opts.overwrite || []);
    const at = new Date().toISOString(), by = whoAmI();
    const added = [], over = [], skipped = [];
    Store.local.packingAdded = Store.local.packingAdded || {};
    Store.local.packingMeta = Store.local.packingMeta || {};
    Store.local.packingLog = Store.local.packingLog || [];

    for (const ord of (res.order || [])) {
      const p = res.packing[ord];
      if (!p || !p.groups || !p.groups.length) continue;
      const ex = Store.packingSource(ord);
      if (ex && !ow.has(ord)) { skipped.push(ord); continue; }
      Store.local.packingAdded[ord] = JSON.parse(JSON.stringify(p));
      Store.local.packingMeta[ord] = {
        at, by, reason, file: res.file || "", sheet: res.sheet || "",
        bat: (U.orderByCode(ord) || {}).bat || opts.bat || null,
        over: !!ex, prevSource: ex || null,
        prs: p.totalPrs, ctn: p.totalCtn, groups: p.groups.length,
      };
      (ex ? over : added).push(ord);
    }
    if (!added.length && !over.length) return { ok: false, msg: "Không có chỉ thị nào được lưu (tất cả đã tồn tại và chưa được chọn ghi đè)" };
    Store.local.packingLog.unshift({
      at, by, reason, file: res.file || "", sheet: res.sheet || "",
      added: added.slice(), over: over.slice(), skipped: skipped.slice(),
      prs: [...added, ...over].reduce((a, c) => a + (res.packing[c] ? res.packing[c].totalPrs : 0), 0),
      ctn: [...added, ...over].reduce((a, c) => a + (res.packing[c] ? res.packing[c].totalCtn : 0), 0),
    });
    if (Store.local.packingLog.length > 200) Store.local.packingLog.length = 200;
    commit();
    return { ok: true, added, over, skipped };
  };

  /* ── XOÁ packing đã import của 1 chỉ thị (dữ liệu gốc đợt 1–3 không xoá) ── */
  Store.deletePacking = function (ord, reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    if (!(Store.local.packingAdded || {})[ord])
      return { ok: false, msg: `${ord} thuộc packing list GỐC (đợt 1–3) nhúng trong data-packing.js — không xoá được trên web. Muốn thay số liệu hãy import file mới và chọn GHI ĐÈ.` };
    if (!reason || !String(reason).trim()) return { ok: false, msg: "Vui lòng nhập lý do xoá" };
    const meta = Store.local.packingMeta[ord] || {};
    delete Store.local.packingAdded[ord];
    delete Store.local.packingMeta[ord];
    Store.local.packingLog = Store.local.packingLog || [];
    Store.local.packingLog.unshift({
      at: new Date().toISOString(), by: whoAmI(), reason: String(reason).trim(),
      file: meta.file || "", sheet: meta.sheet || "", deleted: [ord], added: [], over: [], skipped: [],
      prs: meta.prs || 0, ctn: meta.ctn || 0,
    });
    commit();
    const back = SEED_PACKING[ord] ? " — đã khôi phục về packing list gốc" : "";
    return { ok: true, msg: `Đã xoá packing import của ${ord}${back}` };
  };

  /* Xoá TOÀN BỘ packing đã import (giữ nguyên đợt 1–3 gốc) */
  Store.clearImportedPacking = function (reason) {
    if (!Store.guard()) return { ok: false, msg: "Bạn chỉ có quyền xem" };
    const ords = Object.keys(Store.local.packingAdded || {});
    if (!ords.length) return { ok: false, msg: "Chưa có packing list nào được import" };
    Store.local.packingAdded = {};
    Store.local.packingMeta = {};
    Store.local.packingLog = Store.local.packingLog || [];
    Store.local.packingLog.unshift({
      at: new Date().toISOString(), by: whoAmI(), reason: String(reason || "Xoá toàn bộ packing đã import").trim(),
      file: "", sheet: "", deleted: ords, added: [], over: [], skipped: [], prs: 0, ctn: 0,
    });
    commit();
    return { ok: true, n: ords.length };
  };

  /* ── Thống kê packing list (dùng cho KPI & bảng theo đợt) ── */
  Store.packingStats = function () {
    const PKG = window.TVS_PACKING || {};
    const st = { orders: 0, prs: 0, ctn: 0, groups: 0, mix: 0, seed: 0, imported: 0, byBat: {}, diff: 0, noOrder: 0 };
    for (const [ord, p] of Object.entries(PKG)) {
      const bat = Store.packingBatch(ord) || 0;
      const b = st.byBat[bat] || (st.byBat[bat] = { bat, orders: 0, prs: 0, ctn: 0, groups: 0, mix: 0, seed: 0, imported: 0, diff: 0 });
      const src = Store.packingSource(ord);
      const gmix = p.groups.filter(g => g.mix).length;
      const o = U.orderByCode(ord);
      const dif = o ? (o.prs !== p.totalPrs) : false;
      st.orders++; st.prs += p.totalPrs; st.ctn += p.totalCtn; st.groups += p.groups.length; st.mix += gmix;
      if (src === "seed") st.seed++; else st.imported++;
      if (dif) st.diff++;
      if (!o) st.noOrder++;
      b.orders++; b.prs += p.totalPrs; b.ctn += p.totalCtn; b.groups += p.groups.length; b.mix += gmix;
      if (src === "seed") b.seed++; else b.imported++;
      if (dif) b.diff++;
    }
    st.without = (U.ORDER_INDEX || []).filter(o => !PKG[o.ord]).length;
    return st;
  };

  /* Danh sách packing (kèm đối chiếu đơn đặt hàng) cho màn hình Packing List */
  Store.packingRows = function () {
    const PKG = window.TVS_PACKING || {};
    return Object.keys(PKG).map(ord => {
      const p = PKG[ord], o = U.orderByCode(ord);
      const sizes = {};
      p.groups.forEach(g => Object.entries(g.sizes).forEach(([sz, q]) => { sizes[sz] = (sizes[sz] || 0) + q; }));
      return {
        ord, p, o, sizes,
        bat: Store.packingBatch(ord), src: Store.packingSource(ord), meta: Store.packingMeta(ord),
        prs: p.totalPrs, ctn: p.totalCtn, groups: p.groups.length,
        mix: p.groups.filter(g => g.mix).length,
        ordPrs: o ? o.prs : null,
        match: !o ? "noorder" : (o.prs === p.totalPrs && U.SIZES.every(sz => (sizes[sz] || 0) === (o.sizes[sz] ? o.sizes[sz].ordered : 0)) ? "ok" : "diff"),
      };
    }).sort((a, b) => (a.bat || 99) - (b.bat || 99) || a.ord.localeCompare(b.ord));
  };

  /* ── FILE MẪU & EXPORT packing list ─────────────────────────── */
  const PK_TPL_HEAD = ["STT", "Mã chỉ thị", "Po#", "Art#", "Tên hình thể", "Mã khách hàng",
    "Mã nước-mã kho", "Giới tính", "SIZE", "Tổng số đôi", "Số đôi/ thùng",
    "Số thùng", "Số thùng từ", "Số thùng đến", "Mã hộp"];

  function pkRowsOf(ords) {
    const PKG = window.TVS_PACKING || {};
    const rows = [PK_TPL_HEAD.slice()];
    let stt = 0;
    for (const ord of ords) {
      const p = PKG[ord]; if (!p) continue;
      stt++;
      for (const g of p.groups) {
        let first = true;
        for (const [sz, q] of Object.entries(g.sizes)) {
          rows.push([stt, ord, p.po, p.col, p.name, p.cust, p.wh, p.gender,
            sz.replace("UK ", ""), q,
            first ? g.perCtn : "", first ? g.ctn : "", first ? g.from : "", first ? g.to : "", g.box]);
          first = false;
        }
      }
      rows.push([stt, ord, p.po, p.col, p.name, p.cust, p.wh, p.gender, "", p.totalPrs, "", p.totalCtn, "", "", ""]);
    }
    return rows;
  }
  Store.packingTemplateRows = pkRowsOf;

  /* File mẫu CSV — 1 chỉ thị đủ thùng nguyên + thùng lẻ + thùng MIX SIZE */
  Store.templatePackingCSV = function () {
    Store.downloadCSV("MAU_IMPORT_PACKING_LIST_CLP.csv", [
      PK_TPL_HEAD.slice(),
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 4, 36, 6, 6, 1, 6, "NHNS88"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 5, 102, 6, 17, 7, 23, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 6, 60, 6, 10, 24, 33, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 6, 3, 3, 1, 34, 34, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 7, 2, 5, 1, 35, 35, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 8, 3, "", "", "", "", "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", "", 206, "", 35, "", "", ""],
    ]);
  };

  /* File mẫu .xlsx (2 sheet: CLP theo mẫu + Hướng dẫn) */
  Store.templatePackingXLSX = function () {
    if (!window.XlsxWrite) { Store.templatePackingCSV(); return; }
    const S = XlsxWrite.S;
    const head = PK_TPL_HEAD.map(h => ({ v: h, s: S.head }));
    const data = [
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 4, 36, 6, 6, 1, 6, "NHNS88"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 5, 102, 6, 17, 7, 23, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 6, 60, 6, 10, 24, 33, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 6, 3, 3, 1, 34, 34, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 7, 2, 5, 1, 35, 35, "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", 8, 3, "", "", "", "", "NHNS72"],
      [1, "AE2701001", "0903999999-1", "LC1783", "ADIDAS RAINBOOT W", "0308999999", "600000-SI600000", "Women", "", 206, "", 35, "", "", ""],
    ];
    XlsxWrite.download("MAU_IMPORT_PACKING_LIST_CLP.xlsx", [
      { name: "CLP", freeze: { r: 1, c: 2 }, cols: [{ w: 6 }, { w: 14 }, { w: 16 }, { w: 10 }, { w: 22 }, { w: 14 }, { w: 22 }, { w: 9 }, { w: 7 }, { w: 12 }, { w: 12 }, { w: 10 }, { w: 12 }, { w: 12 }, { w: 11 }], rows: [head].concat(data) },
      {
        name: "Huong dan", cols: [{ w: 110 }], rows: [
          [{ v: "HƯỚNG DẪN IMPORT PACKING LIST (CLP) — TVS × adidas", s: S.title }],
          ["1. Giữ nguyên dòng tiêu đề sheet CLP (có thể thêm/bớt cột phụ, hệ thống tự nhận cột theo tên)."],
          ["2. Mỗi dòng = 1 nhóm thùng: SIZE · Tổng số đôi · Số đôi/thùng · Số thùng · Số thùng từ → đến · Mã hộp."],
          ["3. THÙNG MIX SIZE: dòng đầu ghi đủ Số thùng = 1 và Số thùng từ = đến; các size còn lại trong cùng thùng để TRỐNG 3 cột (Số thùng, từ, đến)."],
          ["4. Dòng TỔNG của mỗi chỉ thị: để trống SIZE, ghi tổng số đôi & tổng số thùng (hệ thống dùng để đối chiếu)."],
          ["5. Quốc gia / Đợt đặt hàng KHÔNG cần ghi — hệ thống tự mapping từ đơn đặt hàng (OMS) theo Mã chỉ thị."],
          ["6. Import tại màn hình “Packing List · CLP” → nút “Import packing list”. Hệ thống xem trước, đối chiếu số đôi với đơn đặt hàng rồi mới lưu."],
          ["7. Chỉ thị đã có packing list sẽ được cảnh báo — chỉ ghi đè khi bạn tự tích chọn."],
        ]
      },
    ]);
  };

  /* Export packing hiện hành (CSV theo đúng mẫu → import lại được) */
  Store.exportPackingCSV = function (ords, fname) {
    const list = ords && ords.length ? ords : Object.keys(window.TVS_PACKING || {});
    Store.downloadCSV(fname || "PACKING_LIST_CLP_TVS.csv", pkRowsOf(list));
  };

  /* Export packing hiện hành ra .xlsx (sheet CLP + sheet tổng hợp) */
  Store.exportPackingXLSX = function (ords, fname) {
    const PKG = window.TVS_PACKING || {};
    const list = ords && ords.length ? ords : Object.keys(PKG);
    if (!window.XlsxWrite) { Store.exportPackingCSV(list); return; }
    const S = XlsxWrite.S;
    const raw = pkRowsOf(list);
    const head = raw[0].map(h => ({ v: h, s: S.head }));
    const body = raw.slice(1).map(r => r.map((c, i) => (typeof c === "number" && i !== 0
      ? { v: c, s: S.num } : { v: c === "" ? null : c, s: i === 0 ? S.txtC : S.txt })));
    const sum = [[{ v: "TỔNG HỢP PACKING LIST THEO CHỈ THỊ", s: S.title }], []];
    sum.push(["Chỉ thị", "Đợt", "Quốc gia", "PO", "Màu", "Tổng đôi", "Tổng thùng", "Số nhóm thùng", "Nhóm MIX", "Nguồn"].map(h => ({ v: h, s: S.head })));
    let tp = 0, tc = 0;
    for (const ord of list) {
      const p = PKG[ord]; if (!p) continue;
      tp += p.totalPrs; tc += p.totalCtn;
      sum.push([{ v: ord, s: S.txtB }, { v: Store.packingBatch(ord) || "", s: S.txtC }, { v: p.ctry, s: S.txt },
        { v: p.po, s: S.txt }, { v: p.col, s: S.txt }, { v: p.totalPrs, s: S.num }, { v: p.totalCtn, s: S.num },
        { v: p.groups.length, s: S.num }, { v: p.groups.filter(g => g.mix).length, s: S.num },
        { v: Store.packingSource(ord) === "seed" ? "Gốc (data-packing.js)" : "Import", s: S.txt }]);
    }
    sum.push([{ v: "TỔNG", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT },
      { v: tp, s: S.totN }, { v: tc, s: S.totN }, { v: "", s: S.totT }, { v: "", s: S.totT }, { v: "", s: S.totT }]);
    XlsxWrite.download(fname || "PACKING_LIST_CLP_TVS.xlsx", [
      { name: "CLP", freeze: { r: 1, c: 2 }, cols: [{ w: 6 }, { w: 14 }, { w: 16 }, { w: 10 }, { w: 22 }, { w: 14 }, { w: 22 }, { w: 9 }, { w: 7 }, { w: 12 }, { w: 12 }, { w: 10 }, { w: 12 }, { w: 12 }, { w: 11 }], rows: [head].concat(body) },
      { name: "Tong hop", cols: [{ w: 14 }, { w: 7 }, { w: 20 }, { w: 16 }, { w: 10 }, { w: 12 }, { w: 12 }, { w: 14 }, { w: 11 }, { w: 22 }], rows: sum },
    ]);
  };

  window.Store = Store;
})();
