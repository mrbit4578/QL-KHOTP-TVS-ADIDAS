/* ═══════════════════════════════════════════════════════════════════
   app.js — Điều phối ứng dụng TVS × adidas N-X-T
   Router #/... · sidebar · tìm kiếm toàn cục · modal · toast · file
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const App = {};

  /* ── Bộ icon SVG dùng chung ── */
  const ICONS = {
    dash: `<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>`,
    clip: `<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5" fill="none"/><line x1="8.5" y1="9.5" x2="15.5" y2="9.5"/><line x1="8.5" y1="13" x2="15.5" y2="13"/><line x1="8.5" y1="16.5" x2="13" y2="16.5"/>`,
    orders: `<rect x="5" y="4" width="14" height="17" rx="2"/><line x1="8.5" y1="9.5" x2="15.5" y2="9.5"/><line x1="8.5" y1="13" x2="15.5" y2="13"/><line x1="8.5" y1="16.5" x2="13" y2="16.5"/>`,
    box: `<path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" fill="none"/><path d="M3 7l9 4.5L21 7M12 11.5V21.5" fill="none"/>`,
    layers: `<path d="M12 3 21 8l-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 17l9 5 9-5" fill="none"/>`,
    truck: `<rect x="2" y="6" width="12" height="10" rx="1.5"/><path d="M14 9.5h4l3 3.5v3h-7z" fill="none"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>`,
    doc: `<path d="M6 2.5h8l5 5V21.5H6z" fill="none"/><path d="M14 2.5v5h5" fill="none"/><line x1="9" y1="12" x2="16" y2="12"/><line x1="9" y1="15.5" x2="16" y2="15.5"/><line x1="9" y1="19" x2="13" y2="19"/>`,
    nodes: `<circle cx="12" cy="5" r="2.6"/><circle cx="5" cy="18" r="2.6"/><circle cx="19" cy="18" r="2.6"/><path d="M12 7.5 6 15.8M12 7.5l6 8.3M7.6 18h8.8" fill="none"/>`,
    bot: `<rect x="4.5" y="8" width="15" height="11" rx="3"/><circle cx="9.5" cy="13" r="1.6" fill="#fff"/><circle cx="14.5" cy="13" r="1.6" fill="#fff"/><line x1="12" y1="8" x2="12" y2="4.5"/><circle cx="12" cy="3.6" r="1.4"/>`,
    globe: `<circle cx="12" cy="12" r="9" fill="none"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none"/><line x1="3" y1="12" x2="21" y2="12"/>`,
    calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>`,
    alert: `<path d="M12 3.5 22 20H2z" fill="none"/><line x1="12" y1="10" x2="12" y2="14.6"/><circle cx="12" cy="17.3" r="1.2"/>`,
    gauge: `<path d="M4 17a8.5 8.5 0 1 1 16 0" fill="none"/><line x1="12" y1="16.5" x2="16" y2="10"/><circle cx="12" cy="17" r="1.6"/>`,
    check: `<circle cx="12" cy="12" r="9" fill="none"/><path d="m7.8 12.3 2.8 2.8 5.6-6" fill="none"/>`,
    gear: `<circle cx="12" cy="12" r="3.2" fill="none"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" fill="none"/>`,
    clock: `<circle cx="12" cy="12" r="9" fill="none"/><path d="M12 6.5V12l3.8 2.3" fill="none"/>`,
    plus: `<circle cx="12" cy="12" r="9" fill="none"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`,
    download: `<path d="M12 3v11" fill="none"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5" fill="none"/><path d="M4 17v3.5h16V17" fill="none"/>`,
    upload: `<path d="M12 14.5V3.5" fill="none"/><path d="M7.5 7.5 12 3l4.5 4.5" fill="none"/><path d="M4 17v3.5h16V17" fill="none"/>`,
    print: `<rect x="6" y="3" width="12" height="5.5" fill="none"/><rect x="4" y="8.5" width="16" height="8" rx="1.5" fill="none"/><rect x="7" y="14" width="10" height="6.5" fill="none"/>`,
    trash: `<path d="M4.5 6.5h15M9.5 6V4h5v2M6.5 6.5 7.5 21h9l1-14.5" fill="none"/><line x1="10" y1="10" x2="10" y2="17"/><line x1="14" y1="10" x2="14" y2="17"/>`,
  };
  App.icon = (name, cls) => `<svg class="${cls || "n-ico"}" viewBox="0 0 24 24" fill="currentColor"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    style="fill:none;stroke:currentColor">${ICONS[name] || ICONS.dash}</svg>`;

  /* ── Khai báo trang (theo sơ đồ WMS hình ①) ── */
  const alertCount = () => U.ORDER_INDEX.filter(o => o.daysLeft !== null && o.daysLeft <= 30 && o.short > 0).length;
  const ROUTES = [
    { sec: "Tổng quan" },
    { id: "", icon: "dash", label: "Bảng điều khiển", view: "dashboard", badge: alertCount },
    { sec: "Vận hành · WMS Core" },
    { id: "orders", icon: "orders", label: "Đơn đặt hàng · OMS", view: "orders" },
    { id: "warehouse", icon: "box", label: "Nhập kho · WMS", view: "warehouse" },
    { id: "delivery", icon: "doc", label: "Lệnh giao hàng · PXK", view: "delivery" },
    { id: "inventory", icon: "layers", label: "Tồn kho · N-X-T", view: "inventory" },
    { id: "shipping", icon: "truck", label: "Kế hoạch xuất · TMS", view: "shipping" },
    { sec: "Hệ thống & AI" },
    { id: "architecture", icon: "nodes", label: "Kiến trúc hệ thống", view: "architecture" },
    { id: "assistant", icon: "bot", label: "Trợ lý AI · RAG", view: "assistant" },
  ];

  /* ── Render sidebar ── */
  function renderNav(currentId) {
    const nav = document.getElementById("nav");
    nav.innerHTML = ROUTES.map(r => {
      if (r.sec) return `<div class="nav-sec">${r.sec}</div>`;
      const b = r.badge ? r.badge() : 0;
      return `<a class="nav-item ${r.id === currentId ? "active" : ""}" href="#/${r.id}">
        ${App.icon(r.icon)}<span>${r.label}</span>${b ? `<span class="n-badge">${b}</span>` : ""}</a>`;
    }).join("");
    renderLocalInfo();
  }

  /* Chỉ báo dữ liệu nhập tay + khôi phục gốc */
  function renderLocalInfo() {
    const el = document.getElementById("localInfo");
    if (!el || !window.Store) return;
    const c = Store.counts();
    const total = c.orders + c.receipts + c.shipments + (c.orderEdits || 0);
    const edTxt = c.orderEdits ? ` · <b>${c.orderEdits}</b> đơn đã sửa` : "";
    const demo = Store.persistent ? "" : `<div style="color:#f2a20c;margin-top:3px">⚠ Chế độ demo: trình duyệt nhúng chặn lưu trữ — dữ liệu nhập sẽ mất khi tải lại trang. Bản .zip chạy máy thật lưu bình thường.</div>`;
    el.innerHTML = (total
      ? `Dữ liệu nhập thêm: <b>${c.orders}</b> dòng đơn · <b>${c.receipts}</b> dòng NK · <b>${c.shipments}</b> phiếu XK${edTxt}
         <a id="btnResetLocal" style="color:#ff8d80;cursor:pointer;font-weight:700"> ↺ Khôi phục gốc</a>`
      : `Chưa có dữ liệu nhập thêm (100% từ Excel gốc)`) + demo;
    const rst = el.querySelector("#btnResetLocal");
    if (rst) rst.classList.add("need-edit");
    const btn = document.getElementById("btnResetLocal");
    if (btn) btn.onclick = () => {
      if (confirm("Xoá toàn bộ dữ liệu nhập tay/import/phiếu xuất kho và quay về dữ liệu gốc Excel?")) {
        Store.resetAll();
        App.toast("Đã khôi phục dữ liệu gốc từ Excel", "ok");
      }
    };
  }

  /* ── Router ── */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const params = {};
    if (qs) for (const kv of qs.split("&")) {
      const [k, v] = kv.split("=");
      params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
    return { path: path || "", params };
  }

  function navigate() {
    const { path, params } = parseHash();
    const route = ROUTES.find(r => r.id === path && !r.sec) || ROUTES[1];
    const view = window.Views[route.view];
    renderNav(route.id);
    document.getElementById("pageTitle").textContent = view.title;
    const root = document.getElementById("view");
    root.innerHTML = "";
    view.render(root, params);
    window.scrollTo(0, 0);
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("show");
  }
  /* Vẽ lại màn hình hiện tại (sau khi dữ liệu đổi) */
  App.refresh = () => { if (document.getElementById("view")) navigate(); };

  /* ── Modal ── */
  App.openModal = (html, wide) => {
    let back = document.getElementById("modalBack");
    if (!back) {
      back = document.createElement("div");
      back.id = "modalBack"; back.className = "modal-back";
      back.addEventListener("click", e => { if (e.target === back) App.closeModal(); });
      document.body.appendChild(back);
    }
    back.innerHTML = `<div class="modal${wide ? " wide" : ""}">${html}</div>`;
    back.classList.add("open");
  };
  App.closeModal = () => {
    const b = document.getElementById("modalBack");
    if (b) b.classList.remove("open");
    document.body.classList.remove("print-phieu");
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape") App.closeModal(); });

  /* ── Toast thông báo ── */
  App.toast = (msg, type) => {
    let wrap = document.getElementById("toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toasts"; document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.innerHTML = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 3600);
  };

  /* ── Chọn file import (CSV) ── */
  App.pickFile = cb => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".csv,.txt,text/csv";
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => cb(String(rd.result || ""), f.name);
      rd.readAsText(f, "utf-8");
    };
    inp.click();
  };

  /* ── Chọn file dữ liệu: nhận trực tiếp .xlsx (qua XlsxLite) hoặc .csv ── */
  App.pickDataFile = cb => {
    const old = document.getElementById("tvsFilePick");
    if (old) old.remove();
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".xlsx,.csv,.txt";
    inp.id = "tvsFilePick";
    inp.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(inp);
    inp.onchange = () => {
      const f = inp.files[0];
      inp.remove();
      if (!f) return;
      const rd = new FileReader();
      if (/\.xlsx$/i.test(f.name)) {
        if (!window.XlsxLite || !XlsxLite.supported) {
          App.toast("⚠ Trình duyệt không hỗ trợ đọc .xlsx trực tiếp — hãy lưu file thành .csv rồi import", "warn");
          return;
        }
        rd.onload = async () => {
          try { cb({ rows: await XlsxLite.parse(rd.result), name: f.name, kind: "xlsx" }); }
          catch (e) { App.toast("⚠ Không đọc được file Excel: " + (e.message || e), "warn"); }
        };
        rd.readAsArrayBuffer(f);
      } else {
        rd.onload = () => cb({ rows: Store.parseCSV(String(rd.result || "")), name: f.name, kind: "csv" });
        rd.readAsText(f, "utf-8");
      }
    };
    inp.click();
  };

  /* ═══ IN PHIẾU — qua IFRAME TÀI LIỆU ĐỘC LẬP ═══
     Tài liệu in chỉ chứa các trang phiếu + CSS in riêng bên dưới, cô lập
     hoàn toàn khỏi CSS/modal/overflow/iframe của ứng dụng → mọi trang
     2-3-4… luôn in đủ nội dung trên mọi trình duyệt. */
  const PRINT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111;font-size:12px;line-height:1.45}
.px-page{position:relative;height:276mm;overflow:hidden;padding:0 0 12mm;page-break-after:always;break-after:page}
.px-page.land{height:189mm}
.px-page:last-child{page-break-after:auto;break-after:auto}
.px-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.px-co{font-weight:800;font-size:13px}
.px-co-sub{font-size:11px;color:#333}
.px-form-no{text-align:right;font-size:10.2px;max-width:330px;color:#333}
.px-title{text-align:center;font-size:19px;font-weight:800;letter-spacing:.02em;margin:14px 0 12px}
.px-title span{font-size:12px;font-weight:700}
.px-info{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
.px-row{display:flex;border-bottom:1px dotted #c9ced6;padding:3.5px 0;gap:8px}
.px-lab{width:158px;flex-shrink:0;font-weight:700;color:#333;font-size:11.2px}
.px-val{flex:1;font-size:11.8px}
.px-cont-info{font-size:11.5px;color:#333;border:1px dotted #c9ced6;border-radius:6px;padding:6px 10px;margin-bottom:8px}
.px-sec{font-weight:800;font-size:12.5px;margin:14px 0 6px;letter-spacing:.04em}
.px-tbl{width:100%;border-collapse:collapse;font-size:11px}
.px-tbl th,.px-tbl td{border:1px solid #6b7280;padding:3.5px 5px;text-align:left}
.px-tbl th{background:#f1f3f6;font-size:10px;text-transform:uppercase;letter-spacing:.02em;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.px-tbl .c{text-align:center}.px-tbl .r{text-align:right;font-variant-numeric:tabular-nums}
.px-tbl .nw{white-space:nowrap}
.px-tbl .px-total td{font-weight:800;background:#f7f8fa;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.px-carry td{text-align:right!important;color:#667085;font-style:italic}
.px-carry-d{font-size:11px;color:#667085;font-style:italic;text-align:right;padding:8px 2px}
.px-mix{font-size:9.6px;font-weight:600;color:#333;white-space:nowrap}
.px-sign-tbl{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
.px-sign-tbl th{background:#1f4e79;color:#fff;font-size:10.8px;font-weight:800;letter-spacing:.02em;border:1px solid #16385a;padding:5px 4px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.px-sign-tbl td{border:1px solid #9aa3b2;border-top:0;vertical-align:top;padding:7px 8px 6px;font-size:10.6px}
.px-sign-tbl .px-ky{color:#555;font-style:italic}
.px-sign-tbl .px-sign-space{height:92px}
.px-sign-tbl i{font-style:normal;color:#111;display:block;border-top:1px dotted #c9ced6;padding-top:4px}
.px-foot{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;gap:10px;border-top:1px solid #c9ced6;padding-top:6px;font-size:10.2px;color:#555;background:#fff}
.px-foot .px-pageno{font-weight:800;color:#111}
.px-page.compact .px-tbl th{padding:2.5px 4px;font-size:9.4px}
.px-page.compact .px-tbl td{padding:2px 4px;font-size:10px}
.px-page.compact .px-mix{font-size:8.8px}
.px-page.compact .px-sign-tbl th{padding:3.5px 4px;font-size:10px}
.px-page.compact .px-sign-tbl td{padding:3px 5px;font-size:9.6px}
.px-page.compact .px-sign-tbl .px-sign-space{height:64px}
.px-page.compact .px-sec{margin:8px 0 4px}
.px-page.compact .px-cont-info{padding:4px 8px;margin-bottom:5px}`;

  App.printModal = () => {
    const wrap = document.querySelector("#modalBack .phieu-wrap");
    if (!wrap) { window.print(); return; }
    const land = !!wrap.querySelector(".px-page.land");
    const old = document.getElementById("printFrame");
    if (old) old.remove();
    const f = document.createElement("iframe");
    f.id = "printFrame";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(f);
    f.srcdoc = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>In phiếu</title>
<style>@page{size:A4 ${land ? "landscape" : "portrait"};margin:9mm}${PRINT_CSS}</style></head>
<body>${wrap.innerHTML}</body></html>`;
    f.onload = () => setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); }
      catch (e) { fallbackPrint(); }
    }, 150);
  };

  /* Dự phòng: người dùng bấm Ctrl+P trực tiếp khi đang mở phiếu
     → tự dựng #printRoot gắn thẳng vào body để in đủ mọi trang */
  function fallbackPrint() {
    const src = document.querySelector("#modalBack .phieu-wrap");
    if (!src) return;
    let root = document.getElementById("printRoot");
    if (!root) { root = document.createElement("div"); root.id = "printRoot"; document.body.appendChild(root); }
    root.innerHTML = src.innerHTML;
    document.body.classList.add("print-phieu");
  }
  window.addEventListener("beforeprint", () => {
    const back = document.getElementById("modalBack");
    if (back && back.classList.contains("open") && !document.body.classList.contains("print-phieu"))
      fallbackPrint();
  });
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-phieu");
    const root = document.getElementById("printRoot");
    if (root) root.innerHTML = "";
  });

  /* ── Chip người dùng + phân quyền trên topbar ── */
  App.renderUserChip = function () {
    const el = document.getElementById("userChip");
    if (!el || !window.Auth) return;
    if (Auth.canEdit()) {
      el.innerHTML = `<span class="user-chip editor" title="Tài khoản nhập liệu">
          👤 <b>${U.esc(Auth.current.name)}</b></span>
        <button class="btn small" id="btnLogout">Đăng xuất</button>`;
      const b = document.getElementById("btnLogout");
      if (b) b.onclick = () => { Auth.logout(); App.toast("Đã đăng xuất — bạn đang ở chế độ chỉ xem", "warn"); };
    } else {
      el.innerHTML = `<span class="user-chip viewer" title="Chế độ chỉ xem">👁 Chỉ xem</span>
        <button class="btn small primary" id="btnLogin">Đăng nhập</button>`;
      const b = document.getElementById("btnLogin");
      if (b) b.onclick = () => Auth.openLogin();
    }
  };

  /* ── Chế độ nền SÁNG / TỐI ── */
  const SUN = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8"/></svg>`;
  const MOON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/></svg>`;
  App.getTheme = () => { try { return localStorage.getItem("TVS_THEME") === "dark" ? "dark" : "light"; } catch (e) { return "light"; } };
  App.applyTheme = t => {
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
    const b = document.getElementById("themeBtn");
    if (b) b.innerHTML = t === "dark" ? SUN : MOON;
  };
  App.toggleTheme = () => {
    const t = App.getTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem("TVS_THEME", t); } catch (e) {}
    App.applyTheme(t);
    App.refresh();   /* vẽ lại để biểu đồ đổi màu theo nền */
    App.toast(t === "dark" ? "🌙 Đã chuyển nền tối" : "☀ Đã chuyển nền sáng", "ok");
  };

  /* ── Chip trạng thái đồng bộ GitHub ── */
  App.renderSyncChip = function () {
    const el = document.getElementById("syncChip");
    if (!el || !window.Sync) return;
    const s = Sync.label();
    if (!s) { el.innerHTML = ""; return; }
    el.innerHTML = `<span class="bdg ${s.cls}" style="cursor:pointer" title="Dữ liệu chung lưu trên GitHub — bấm để tải lại">${s.txt}</span>`;
    el.firstElementChild.onclick = () => { Sync.load(); App.toast("Đang tải lại dữ liệu chung từ GitHub…", "ok"); };
  };

  /* ── Khởi động ── */
  window.App = App;
  window.addEventListener("hashchange", navigate);
  /* ── Đồng hồ hệ thống realtime (theo đúng ngày giờ máy tính) ── */
  function startSystemClock() {
    const pad = n => String(n).padStart(2, "0");
    const dEl = document.getElementById("sysDate");
    const tEl = document.getElementById("sysTime");
    const tick = () => {
      const now = new Date();
      if (dEl) dEl.textContent = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      if (tEl) tEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };
    tick();
    /* cập nhật đúng nhịp giây: canh về đầu giây rồi chạy mỗi 1000ms */
    if (App._clockTimer) { clearInterval(App._clockTimer); clearTimeout(App._clockAlign); }
    App._clockAlign = setTimeout(() => {
      tick();
      App._clockTimer = setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));
  }

  document.addEventListener("DOMContentLoaded", () => {
    App.applyTheme(App.getTheme());
    const tb = document.getElementById("themeBtn");
    if (tb) tb.onclick = App.toggleTheme;
    startSystemClock();
    if (window.Auth) Auth.apply();
    App.renderSyncChip();
    const gs = document.getElementById("globalSearch");
    gs.addEventListener("keydown", e => {
      if (e.key === "Enter" && gs.value.trim()) {
        location.hash = "#/orders?q=" + encodeURIComponent(gs.value.trim());
        gs.blur();
      }
    });
    const burger = document.getElementById("burger"), sb = document.getElementById("sidebar"), scrim = document.getElementById("scrim");
    burger.addEventListener("click", () => { sb.classList.toggle("open"); scrim.classList.toggle("show"); });
    scrim.addEventListener("click", () => { sb.classList.remove("open"); scrim.classList.remove("show"); });
    navigate();
  });
})();
