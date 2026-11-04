/* ═══════════════════════════════════════════════════════════════════
   github-sync.js — LƯU DỮ LIỆU THẬT TRÊN GITHUB
   Kho dữ liệu chung = file data/tvs-data.json trong repo (TVS_GH).
   • Mọi người (viewer) tải dữ liệu chung khi mở web — luôn thấy số liệu mới
   • Tài khoản nhập liệu (có GitHub Token) ghi thay đổi = 1 commit
     "Cập nhật dữ liệu bởi <user>" → lịch sử thay đổi xem được trên GitHub
   • Không có token hoặc token sai/hết hạn → thông báo lỗi rõ ràng, cho phép
     kiểm tra và cập nhật token trực tiếp, không làm mất dữ liệu trên máy.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const Sync = {};
  const CFG = window.TVS_GH || {};
  const API = () => `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${CFG.dataPath}`;

  Sync.state = {
    sha: null,
    lastSync: null,
    lastBy: null,
    syncing: false,
    pending: false,
    error: null,
    offline: false,
    lastHttpStatus: null
  };

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

  const headers = (isPut = false) => {
    const h = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (isPut) {
      h["Content-Type"] = "application/json";
    }
    const t = window.Auth ? Auth.token() : "";
    if (t) h.Authorization = "Bearer " + t;
    return h;
  };

  const chip = () => { if (window.App && App.renderSyncChip) App.renderSyncChip(); };

  /* Gộp an toàn dữ liệu remote & local khi xảy ra xung đột 409 hoặc đang chờ lưu */
  Sync.mergePayload = function (remote, local) {
    if (!remote) return local;
    if (!local) return remote;
    const mergeArr = (a, b, keyFn) => {
      const map = new Map();
      (a || []).forEach(x => map.set(keyFn(x), x));
      (b || []).forEach(x => map.set(keyFn(x), x));
      return [...map.values()];
    };
    const mergeEdits = (a, b) => {
      const out = Object.assign({}, a || {});
      for (const [k, v] of Object.entries(b || {})) {
        if (!out[k] || (v.rev || 0) >= (out[k].rev || 0)) out[k] = v;
      }
      return out;
    };
    return {
      ordersAdded: mergeArr(remote.ordersAdded, local.ordersAdded, x => x._id || (x.ord + "|" + x.sz)),
      receiptsAdded: mergeArr(remote.receiptsAdded, local.receiptsAdded, x => x._id || (x.rd + "|" + x.ord + "|" + x.sz)),
      shipments: mergeArr(remote.shipments, local.shipments, x => x.id || x.code),
      seq: Math.max(remote.seq || 1, local.seq || 1),
      receiptEdits: mergeEdits(remote.receiptEdits, local.receiptEdits),
      orderEdits: mergeEdits(remote.orderEdits, local.orderEdits),
      seedReceiptsOff: local.seedReceiptsOff !== undefined ? local.seedReceiptsOff : !!remote.seedReceiptsOff,
      packingAdded: Object.assign({}, remote.packingAdded || {}, local.packingAdded || {}),
      packingMeta: Object.assign({}, remote.packingMeta || {}, local.packingMeta || {}),
      packingLog: mergeArr(remote.packingLog, local.packingLog, x => (x.at || "") + "|" + (x.file || "")),
    };
  };

  /* ── KIỂM TRA QUYỀN VÀ TRẠNG THÁI GITHUB TOKEN ── */
  Sync.testToken = async function (customToken) {
    const t = (customToken !== undefined ? customToken : (window.Auth ? Auth.token() : "")).trim();
    if (!t) return { ok: false, msg: "Chưa cấu hình GitHub Token" };
    try {
      // 1. Kiểm tra xác thực user / token
      const rUser = await fetch("https://api.github.com/user", {
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": "Bearer " + t,
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
      if (rUser.status === 401) {
        return { ok: false, status: 401, msg: "Token không hợp lệ hoặc đã hết hạn (401 Bad credentials)" };
      }
      const uData = rUser.ok ? await rUser.json() : null;
      const ghUser = uData ? uData.login : "User";

      // 2. Kiểm tra quyền truy cập repository
      const rRepo = await fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": "Bearer " + t,
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
      if (rRepo.status === 404) {
        return { ok: false, status: 404, msg: `Không tìm thấy repository ${CFG.owner}/${CFG.repo} hoặc Token không có quyền truy cập repo này` };
      }
      if (rRepo.status === 401 || rRepo.status === 403) {
        return { ok: false, status: rRepo.status, msg: `Token bị từ chối truy cập repository (${rRepo.status})` };
      }
      const repoData = await rRepo.json();
      const perms = repoData.permissions || {};
      const canPush = perms.push === true || perms.admin === true;

      return {
        ok: true,
        user: ghUser,
        canPush: canPush,
        permissions: perms,
        msg: canPush
          ? `✓ Token hợp lệ! User: ${ghUser} · Có quyền Ghi/Push vào ${CFG.repo}`
          : `⚠ Token hợp lệ nhưng CHỈ CÓ QUYỀN ĐỌC (không có quyền Ghi vào ${CFG.repo}). Hãy tạo token có quyền "Contents: Read and write".`
      };
    } catch (e) {
      return { ok: false, msg: "Lỗi kết nối mạng tới GitHub API: " + (e.message || e) };
    }
  };

  /* ── TẢI dữ liệu chung từ GitHub ── */
  Sync.load = async function () {
    if (!CFG.owner) return;
    Sync.state.syncing = true;
    chip();
    try {
      const r = await fetch(API() + "?ref=" + CFG.branch + "&t=" + Date.now(), { headers: headers() });
      Sync.state.lastHttpStatus = r.status;
      if (r.status === 404) {
        Sync.state.sha = null;
        Sync.state.syncing = false;
        chip();
        return;
      }
      if (!r.ok) throw new Error("GitHub HTTP " + r.status);
      const j = await r.json();
      Sync.state.sha = j.sha;
      const data = JSON.parse(b64decodeUtf8(j.content));
      if (window.Store && Store.replaceLocal) {
        // Bảo vệ dữ liệu local: luôn gộp nếu trên máy có phiếu xuất kho hoặc dữ liệu mới
        const hasLocal = Store.local && (
          (Store.local.shipments && Store.local.shipments.length > 0) ||
          (Store.local.ordersAdded && Store.local.ordersAdded.length > 0) ||
          (Store.local.receiptsAdded && Store.local.receiptsAdded.length > 0) ||
          (Store.local.receiptEdits && Object.keys(Store.local.receiptEdits).length > 0) ||
          (Store.local.orderEdits && Object.keys(Store.local.orderEdits).length > 0)
        );
        const merged = (Sync.state.pending || hasLocal) ? Sync.mergePayload(data, Store.local) : data;
        Store.replaceLocal(merged);
      }
      Sync.state.lastSync = new Date();
      Sync.state.lastBy = data.meta && data.meta.updatedBy || null;
      Sync.state.offline = false;
      Sync.state.error = null;
    } catch (e) {
      Sync.state.error = String(e.message || e);
      Sync.state.offline = true;
    } finally {
      Sync.state.syncing = false;
      chip();
    }
  };

  /* ── GHI dữ liệu chung lên GitHub (chỉ editor có token) ── */
  let timer = null;
  Sync.queue = function () {
    if (!(window.Auth && Auth.canEdit())) return;
    Sync.state.pending = true;
    Sync.state.error = null;
    chip();
    clearTimeout(timer);
    timer = setTimeout(() => Sync.save(), 1600);
  };

  Sync.save = async function (retried) {
    if (!(window.Auth && Auth.canEdit())) {
      App.toast("Tài khoản hiện tại không có quyền ghi (chế độ chỉ xem)", "warn");
      return;
    }
    const tok = Auth.token();
    if (!tok) {
      Sync.state.error = "Chưa có GitHub Token (cần cài đặt token để lưu online)";
      Sync.state.pending = false;
      chip();
      App.toast("⚠ Chưa có GitHub Token — bấm vào chip đồng bộ để nhập Token", "warn");
      return;
    }
    Sync.state.syncing = true;
    Sync.state.error = null;
    chip();
    try {
      // 1. Nếu chưa có SHA trong bộ nhớ, tự động lấy SHA hiện tại trên GitHub
      if (!Sync.state.sha) {
        try {
          const g = await fetch(API() + "?ref=" + CFG.branch + "&t=" + Date.now(), { headers: headers() });
          if (g.ok) {
            const gj = await g.json();
            Sync.state.sha = gj.sha;
          }
        } catch (_) {}
      }

      // 2. Chuẩn bị payload dữ liệu
      const payload = Object.assign({}, Store.local, {
        meta: { updatedAt: new Date().toISOString(), updatedBy: Auth.current.u, app: "TVS N-X-T v4" }
      });
      const jsonStr = (window.Store && Store.stringifyCompact)
        ? Store.stringifyCompact(payload)
        : JSON.stringify(payload, null, 1);

      const body = {
        message: `Cập nhật dữ liệu bởi ${Auth.current.u} (${Auth.current.name}) — ${new Date().toLocaleString("vi-VN")}`,
        content: b64encodeUtf8(jsonStr),
        branch: CFG.branch,
      };
      if (Sync.state.sha) body.sha = Sync.state.sha;

      // 3. Gửi PUT lên GitHub
      const r = await fetch(API(), { method: "PUT", headers: headers(true), body: JSON.stringify(body) });
      Sync.state.lastHttpStatus = r.status;

      // Xử lý xung đột SHA (409 Conflict hoặc 422 Mismatch)
      if (r.status === 409 || r.status === 422) {
        if (!retried) {
          const g = await fetch(API() + "?ref=" + CFG.branch + "&t=" + Date.now(), { headers: headers() });
          if (g.ok) {
            const gj = await g.json();
            Sync.state.sha = gj.sha;
            try {
              const remoteData = JSON.parse(b64decodeUtf8(gj.content));
              const merged = Sync.mergePayload(remoteData, Store.local);
              if (window.Store && Store.replaceLocal) Store.replaceLocal(merged);
            } catch (_) {}
          }
          App.toast("⚠ Có phiên bản mới trên GitHub — hệ thống đang tự động gộp và đồng bộ lại...", "warn");
          return await Sync.save(true);
        }
        throw new Error("Xung đột phiên bản SHA trên GitHub (409/422). Vui lòng thử bấm 'Tải lại' rồi lưu lại.");
      }

      if (r.status === 401) {
        throw new Error("GitHub Token không hợp lệ hoặc đã hết hạn (401 Bad credentials)");
      }
      if (r.status === 403) {
        throw new Error("GitHub Token không có quyền ghi repo này (403 Forbidden). Cần quyền Contents: Read and write.");
      }
      if (!r.ok) {
        let errDetail = "";
        try {
          const errJ = await r.json();
          if (errJ && errJ.message) errDetail = ": " + errJ.message;
        } catch (_) {}
        throw new Error(`GitHub API lỗi ${r.status}${errDetail}`);
      }

      const j = await r.json();
      Sync.state.sha = j.content.sha;
      Sync.state.lastSync = new Date();
      Sync.state.lastBy = Auth.current.u;
      Sync.state.pending = false;
      Sync.state.error = null;
      Sync.state.offline = false;
      App.toast("☁ Đã lưu dữ liệu lên GitHub thành công (" + U.esc(Auth.current.name) + ")", "ok");
    } catch (e) {
      Sync.state.error = String(e.message || e);
      Sync.state.pending = false;
      App.toast("⚠ " + Sync.state.error, "bad");
    } finally {
      Sync.state.syncing = false;
      chip();
    }
  };

  /* Trạng thái hiển thị cho chip topbar */
  Sync.label = function () {
    if (!CFG.owner) return null;
    if (Sync.state.syncing) return { cls: "warn", txt: "Đang đồng bộ…" };
    if (Sync.state.error) return { cls: "bad", txt: "Lỗi đồng bộ ☁" };
    if (Sync.state.pending) return { cls: "warn", txt: "Chờ lưu ☁" };
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
