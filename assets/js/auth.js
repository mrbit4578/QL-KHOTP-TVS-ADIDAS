/* ═══════════════════════════════════════════════════════════════════
   auth.js — ĐĂNG NHẬP & PHÂN QUYỀN
   • editor (3 tài khoản trong auth-config.js): được nhập liệu, tạo phiếu,
     xuất kho, import, xoá… + cần GitHub Token để GHI dữ liệu online
   • viewer (mặc định, không cần đăng nhập): chỉ xem toàn bộ số liệu
   Quyền ghi thật sự nằm ở GitHub Token — không có token thì API GitHub
   từ chối ghi, nên viewer không thể sửa dữ liệu chung dù bẻ giao diện.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const Auth = {};

  /* ── SHA-256 thuần JS (gọn, không phụ thuộc) ── */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    let maxWord = Math.pow(2, 32), result = "";
    const words = [], asciiBitLength = ascii.length * 8;
    let hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
    let primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++)
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : "") + b.toString(16);
      }
    return result;
  }
  /* mã hoá UTF-8 trước khi băm (hỗ trợ mật khẩu tiếng Việt) */
  Auth.hash = s => sha256(unescape(encodeURIComponent(String(s))));

  /* ── Phiên đăng nhập ── */
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return Auth._m && Auth._m[k] || null; } };
  const set = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { (Auth._m = Auth._m || {})[k] = v; } };

  Auth.current = null;
  try { Auth.current = JSON.parse(get("TVS_SESSION") || "null"); } catch (e) {}
  Auth.token = () => get("TVS_GH_TOKEN") || "";
  Auth.canEdit = () => !!(Auth.current && Auth.current.role === "editor");
  Auth.userName = () => Auth.current ? Auth.current.name : "Khách (chỉ xem)";

  Auth.apply = function () {
    document.body.classList.toggle("role-viewer", !Auth.canEdit());
    if (window.App && App.renderUserChip) App.renderUserChip();
  };

  Auth.login = function (u, pass, token) {
    const cfg = (window.TVS_AUTH_CONFIG || { users: [] }).users.find(x => x.u === u.trim().toLowerCase());
    if (!cfg || Auth.hash(pass) !== cfg.sha256) return { ok: false, msg: "Sai tên đăng nhập hoặc mật khẩu" };
    Auth.current = { u: cfg.u, name: cfg.name, role: cfg.role };
    set("TVS_SESSION", JSON.stringify(Auth.current));
    if (token && token.trim()) set("TVS_GH_TOKEN", token.trim());
    Auth.apply();
    if (window.App && App.refresh) App.refresh();
    return { ok: true };
  };
  Auth.logout = function () {
    Auth.current = null;
    set("TVS_SESSION", null);
    Auth.apply();
    if (window.App && App.refresh) App.refresh();
  };

  /* ── Hộp thoại đăng nhập ── */
  Auth.openLogin = function () {
    const hasTok = !!Auth.token();
    App.openModal(`
      <div class="modal-h"><h3>Đăng nhập nhập liệu — TVS N-X-T</h3>
        <button class="modal-x" onclick="App.closeModal()">✕</button></div>
      <div class="modal-b" style="max-width:520px">
        <div class="note" style="margin-bottom:12px">
          Chỉ <b>3 tài khoản nhập liệu</b> được thao tác dữ liệu. Không đăng nhập vẫn xem được toàn bộ số liệu (chỉ xem).
        </div>
        <div class="frm" style="display:flex;flex-direction:column;gap:10px">
          <label>Tên đăng nhập
            <input id="lgU" placeholder="thukho / kinhdoanh / quanly" autocomplete="username"></label>
          <label>Mật khẩu
            <input id="lgP" type="password" placeholder="••••••••" autocomplete="current-password"></label>
          <label>GitHub Token (để GHI dữ liệu online — dán 1 lần, máy sẽ nhớ)
            <input id="lgT" type="password" placeholder="${hasTok ? "•••••• đã lưu — bỏ trống để giữ nguyên" : "github_pat_… (Contents: Read and write)"}"></label>
        </div>
        <div class="mt" style="display:flex;gap:8px;align-items:center">
          <button class="btn primary" id="lgGo">Đăng nhập</button>
          <button class="btn" onclick="App.closeModal()">Huỷ</button>
          ${hasTok ? `<button class="btn danger small" id="lgClearTok" style="margin-left:auto">Xoá token đã lưu</button>` : ""}
        </div>
        <div class="note mt" id="lgErr"></div>
        <div class="note mt">Token do quản trị viên cấp (fine-grained, chỉ quyền <b>Contents Read/Write</b> trên repo dữ liệu). Người xem KHÔNG cần token.</div>
      </div>`);
    const go = () => {
      const r = Auth.login(
        document.getElementById("lgU").value,
        document.getElementById("lgP").value,
        document.getElementById("lgT").value);
      if (!r.ok) { document.getElementById("lgErr").innerHTML = `<span style="color:var(--bad);font-weight:700">⚠ ${r.msg}</span>`; return; }
      App.closeModal();
      App.toast(`✓ Xin chào <b>${U.esc(Auth.current.name)}</b> — bạn có quyền nhập liệu${Auth.token() ? " + đồng bộ GitHub" : " (chưa có token — dữ liệu chỉ lưu máy này)"}`, "ok");
      if (window.Sync) Sync.queue();
    };
    document.getElementById("lgGo").onclick = go;
    document.getElementById("lgP").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    document.getElementById("lgT").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    const clr = document.getElementById("lgClearTok");
    if (clr) clr.onclick = () => { set("TVS_GH_TOKEN", null); App.toast("Đã xoá GitHub token khỏi máy này", "warn"); App.closeModal(); };
  };

  window.Auth = Auth;
})();
