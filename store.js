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
    return { ordersAdded: [], receiptsAdded: [], shipments: [], seq: 0, receiptEdits: {},
             orderEdits: {}, seedReceiptsOff: false };
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

  window.Store = Store;
})();
