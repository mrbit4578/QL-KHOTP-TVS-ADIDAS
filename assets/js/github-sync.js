/* ═══════════════════════════════════════════════════════════════════
   github-sync.js — LƯU DỮ LIỆU THẬT TRÊN GITHUB
   Kho dữ liệu chung = file data/tvs-data.json trong repo (TVS_GH).
   • Mọi người (viewer) tải dữ liệu chung khi mở web — luôn thấy số liệu mới
   • Tài khoản nhập liệu (có GitHub Token) ghi thay đổi = 1 commit
     "Cập nhật dữ liệu bởi <user>" → lịch sử thay đổi xem được trên GitHub
   • Không có token → API GitHub từ chối ghi (phân quyền THẬT)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const Sync = {};
  const CFG = window.TVS_GH || {};
  const API = () => `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${CFG.dataPath}`;

  Sync.state = { sha: null, lastSync: null, lastBy: null, syncing: false, pending: false, error: null, offline: false };

  const b64decodeUtf8 = b64 => {
    const bin = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  };
  const b64encodeUtf8 = str => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const headers = () => {
    const h = { Accept: "application/vnd.github+json" };
    const t = window.Auth ? Auth.token() : "";
    if (t) h.Authorization = "Bearer " + t;
    return h;
  };
  const chip = () => { if (window.App && App.renderSyncChip) App.renderSyncChip(); };

  /* ── TẢI dữ liệu chung từ GitHub ── */
  Sync.load = async function () {
    if (!CFG.owner) return;
    Sync.state.syncing = true; Sync.state.error = null; chip();
    try {
      const r = await fetch(API() + "?ref=" + CFG.branch + "&t=" + Date.now(), { headers: headers() });
      if (r.status === 404) { Sync.state.sha = null; Sync.state.syncing = false; chip(); return; }
      if (!r.ok) throw new Error("GitHub " + r.status);
      const j = await r.json();
      Sync.state.sha = j.sha;
      const data = JSON.parse(b64decodeUtf8(j.content));
      if (window.Store && Store.replaceLocal) Store.replaceLocal(data);
      Sync.state.lastSync = new Date();
      Sync.state.lastBy = data.meta && data.meta.updatedBy || null;
      Sync.state.offline = false;
    } catch (e) {
      Sync.state.error = String(e.message || e);
      Sync.state.offline = true;
    }
    Sync.state.syncing = false; chip();
  };

  /* ── GHI dữ liệu chung lên GitHub (chỉ editor có token) ── */
  let timer = null;
  Sync.queue = function () {
    if (!(window.Auth && Auth.canEdit() && Auth.token())) return;
    Sync.state.pending = true; chip();
    clearTimeout(timer);
    timer = setTimeout(() => Sync.save(), 1600);
  };

  Sync.save = async function (retried) {
    if (!(window.Auth && Auth.canEdit())) return;
    if (!Auth.token()) { App.toast("⚠ Chưa có GitHub Token — dữ liệu chỉ lưu trên máy này. Đăng nhập lại và dán token để đồng bộ.", "warn"); return; }
    Sync.state.syncing = true; Sync.state.error = null; chip();
    try {
      const payload = Object.assign({}, Store.local, {
        meta: { updatedAt: new Date().toISOString(), updatedBy: Auth.current.u, app: "TVS N-X-T v4" }
      });
      const body = {
        message: `Cập nhật dữ liệu bởi ${Auth.current.u} (${Auth.current.name}) — ${new Date().toLocaleString("vi-VN")}`,
        content: b64encodeUtf8(JSON.stringify(payload, null, 1)),
        branch: CFG.branch,
      };
      if (Sync.state.sha) body.sha = Sync.state.sha;
      const r = await fetch(API(), { method: "PUT", headers: headers(), body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) {
        if (!retried) {   /* sha lệch (người khác vừa ghi) → lấy sha mới, ghi lại 1 lần */
          const g = await fetch(API() + "?ref=" + CFG.branch + "&t=" + Date.now(), { headers: headers() });
          if (g.ok) { Sync.state.sha = (await g.json()).sha; }
          Sync.state.syncing = false;
          App.toast("⚠ Có người vừa cập nhật dữ liệu — đang ghi đè bản của bạn (kiểm tra lịch sử commit nếu cần)", "warn");
          return Sync.save(true);
        }
        throw new Error("Xung đột dữ liệu (409)");
      }
      if (r.status === 401 || r.status === 403) throw new Error("Token không có quyền ghi (401/403)");
      if (!r.ok) throw new Error("GitHub " + r.status);
      const j = await r.json();
      Sync.state.sha = j.content.sha;
      Sync.state.lastSync = new Date();
      Sync.state.lastBy = Auth.current.u;
      Sync.state.pending = false;
      Sync.state.offline = false;
      App.toast("☁ Đã lưu dữ liệu lên GitHub (" + U.esc(Auth.current.name) + ")", "ok");
    } catch (e) {
      Sync.state.error = String(e.message || e);
      App.toast("⚠ Lỗi đồng bộ GitHub: " + U.esc(Sync.state.error), "warn");
    }
    Sync.state.syncing = false; chip();
  };

  /* Trạng thái hiển thị cho chip topbar */
  Sync.label = function () {
    if (!CFG.owner) return null;
    if (Sync.state.syncing) return { cls: "warn", txt: "Đang đồng bộ…" };
    if (Sync.state.pending) return { cls: "warn", txt: "Chờ lưu ☁" };
    if (Sync.state.error) return { cls: "bad", txt: "Lỗi đồng bộ" };
    if (Sync.state.lastSync) {
      const hh = Sync.state.lastSync.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      return { cls: "ok", txt: "☁ GitHub " + hh + (Sync.state.lastBy ? " · " + Sync.state.lastBy : "") };
    }
    return { cls: "neu", txt: "☁ Chưa đồng bộ" };
  };

  /* Tự tải dữ liệu chung khi mở trang */
  document.addEventListener("DOMContentLoaded", () => { setTimeout(() => Sync.load(), 60); });

  window.Sync = Sync;
})();
