/* ═══════════════════════════════════════════════════════════════════
   collapsible.js — SỔ XUỐNG / THU GỌN CÁC KHỐI TRÊN MỌI MÀN HÌNH (v4.10)
   • Mỗi thẻ .card có tiêu đề (.card-h) tự có nút ▾ để xổ / thu gọn
   • Khi mở màn hình: các khối thu gọn sẵn — chỉ thấy thanh tiêu đề,
     KPI tổng quan & thanh công cụ vẫn hiện (những khối không có .card-h)
   • Nhớ trạng thái từng khối theo màn hình (localStorage) cho lần sau
   • Nút "Mở tất cả / Thu gọn tất cả" trên thanh tiêu đề (topbar)
   • Không sửa từng view — dùng MutationObserver, tự áp cho khối mới render
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const KEY = "TVS_COLLAPSE_V1";
  const DEFAULT_COLLAPSED = true;    // vào màn hình: thu gọn sẵn (theo yêu cầu)

  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { store = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };

  const routeId = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
  const titleOf = card => {
    const h = card.querySelector(":scope > .card-h");
    const t = h && (h.querySelector("h3") || h);
    return (t ? t.textContent : "").trim().replace(/\s+/g, " ").slice(0, 80);
  };
  const keyOf = card => routeId() + " ‖ " + titleOf(card);

  /* Khối có được phép thu gọn không: là .card, có .card-h trực tiếp, có tiêu đề */
  function collapsibleCards() {
    const view = document.getElementById("view");
    if (!view) return [];
    return [...view.querySelectorAll(".card")].filter(c => {
      const h = c.querySelector(":scope > .card-h");
      return h && titleOf(c);
    });
  }

  function applyState(card, collapsed) {
    card.classList.toggle("collapsed", collapsed);
    const chev = card.querySelector(":scope > .card-h > .clp-chev");
    if (chev) chev.setAttribute("aria-expanded", String(!collapsed));
  }

  let observer = null;
  function enhance() {
    if (observer) observer.disconnect();
    const cards = collapsibleCards();
    for (const card of cards) {
      const k = keyOf(card);
      if (!card.hasAttribute("data-clp")) {
        card.setAttribute("data-clp", "1");
        card.classList.add("clp");
        const h = card.querySelector(":scope > .card-h");
        /* nút chevron đặt ở đầu tiêu đề — không đè lên các nút bên phải */
        const chev = document.createElement("button");
        chev.type = "button";
        chev.className = "clp-chev";
        chev.title = "Sổ xuống / Thu gọn";
        chev.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        h.insertBefore(chev, h.firstChild);
        /* Bấm vào tiêu đề (trừ các nút/ô nhập bên trong) để xổ/thu gọn */
        h.addEventListener("click", e => {
          if (e.target.closest("button:not(.clp-chev), a, input, select, .seg")) return;
          const now = !card.classList.contains("collapsed");
          store[keyOf(card)] = now; save();
          applyState(card, now);
        });
      }
      const saved = store[keyOf(card)];
      applyState(card, saved === undefined ? DEFAULT_COLLAPSED : saved);
    }
    enhanceTableArea();
    updateGlobalBtn();
    if (observer) observer.observe(document.getElementById("view"), { childList: true, subtree: true });
  }

  /* ── OMS · Đơn đặt hàng: bảng kết quả không có .card-h ──
     Giữ nguyên thanh công cụ + bộ lọc + tab; chỉ thu gọn phần BẢNG (#tblArea).
     Nút ▾ chèn vào thanh "Nguồn: … · N đơn" ngay trên bảng. */
  function enhanceTableArea() {
    const tbl = document.getElementById("tblArea");
    if (!tbl) return;
    const bar = tbl.previousElementSibling;     // thanh chứa .seg + "Nguồn…"
    if (!bar) return;
    const key = routeId() + " ‖ #tblArea";
    if (!bar.hasAttribute("data-clp")) {
      bar.setAttribute("data-clp", "1");
      bar.classList.add("clp-bar");
      const chev = document.createElement("button");
      chev.type = "button"; chev.className = "clp-chev";
      chev.title = "Sổ xuống / Thu gọn bảng";
      chev.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      bar.insertBefore(chev, bar.firstChild);
      bar.addEventListener("click", e => {
        if (e.target.closest("button:not(.clp-chev), a, input, select, .seg")) return;
        const now = !tbl.classList.contains("clp-hidden");
        store[key] = now; save(); applyTbl(bar, tbl, now);
      });
    }
    const saved = store[key];
    applyTbl(bar, tbl, saved === undefined ? DEFAULT_COLLAPSED : saved);
  }
  function applyTbl(bar, tbl, collapsed) {
    tbl.classList.toggle("clp-hidden", collapsed);
    bar.classList.toggle("collapsed", collapsed);
  }

  /* ── Nút "Mở tất cả / Thu gọn tất cả" trên topbar ── */
  function setAll(collapsed) {
    for (const card of collapsibleCards()) { store[keyOf(card)] = collapsed; applyState(card, collapsed); }
    const tbl = document.getElementById("tblArea");
    if (tbl && tbl.previousElementSibling) {
      store[routeId() + " ‖ #tblArea"] = collapsed;
      applyTbl(tbl.previousElementSibling, tbl, collapsed);
    }
    save(); updateGlobalBtn();
  }
  function updateGlobalBtn() {
    const btn = document.getElementById("clpAllBtn");
    if (!btn) return;
    const cards = collapsibleCards();
    const tbl = document.getElementById("tblArea");
    const hasAny = cards.length || tbl;
    btn.style.display = hasAny ? "" : "none";
    const anyOpen = cards.some(c => !c.classList.contains("collapsed"))
      || (tbl && !tbl.classList.contains("clp-hidden"));
    btn.dataset.mode = anyOpen ? "collapse" : "expand";
    btn.title = anyOpen ? "Thu gọn tất cả khối" : "Mở tất cả khối";
    btn.innerHTML = anyOpen
      ? `<svg viewBox="0 0 24 24" class="ico"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Thu gọn tất cả</span>`
      : `<svg viewBox="0 0 24 24" class="ico"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Mở tất cả</span>`;
  }
  function ensureGlobalBtn() {
    if (document.getElementById("clpAllBtn")) return;
    const tools = document.querySelector(".topbar-tools");
    if (!tools) return;
    const btn = document.createElement("button");
    btn.id = "clpAllBtn";
    btn.className = "clp-all-btn";
    btn.onclick = () => setAll(btn.dataset.mode === "collapse");
    tools.insertBefore(btn, tools.firstChild);
    updateGlobalBtn();
  }

  function boot() {
    ensureGlobalBtn();
    const view = document.getElementById("view");
    if (!view) return;
    observer = new MutationObserver(() => { clearTimeout(boot._t); boot._t = setTimeout(enhance, 30); });
    enhance();
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 120));
  window.addEventListener("hashchange", () => setTimeout(enhance, 60));
})();
