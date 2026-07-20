/* ═══════════════════════════════════════════════════════════════════
   views/assistant.js — TRỢ LÝ AI TVS (mô phỏng Agentic RAG — hình ②)
   Planner → chọn công cụ truy xuất → tổng hợp câu trả lời
   Tri thức = 100% dữ liệu thật nhúng từ file Excel (không cần server)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const norm = s => s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/\s+/g, " ").trim();

  const CTRY_ALIAS = {
    "my": "UNITED STATES", "hoa ky": "UNITED STATES", "usa": "UNITED STATES", "united states": "UNITED STATES",
    "duc": "GERMANY", "germany": "GERMANY", "nhat": "JAPAN", "nhat ban": "JAPAN", "japan": "JAPAN",
    "anh": "UNITED KINGDOM", "uk": "UNITED KINGDOM", "united kingdom": "UNITED KINGDOM",
    "y": "ITALY", "italy": "ITALY", "italia": "ITALY",
    "argentina": "ARGENTINA", "canada": "CANADA", "chile": "CHILE", "israel": "ISRAEL",
    "tho nhi ky": "TURKIYE", "turkiye": "TURKIYE", "turkey": "TURKIYE",
    "uae": "UNITED ARAB EMIRATES", "a rap": "UNITED ARAB EMIRATES",
    "colombia": "COLOMBIA", "nam phi": "SOUTH AFRICA", "south africa": "SOUTH AFRICA", "mexico": "MEXICO",
  };

  const steps = arr => `<div class="steps">${arr.map((s, i) =>
    `<span class="step${i === arr.length - 1 ? " hot" : ""}">${s}</span>`).join("")}</div>`;
  const tbl = (heads, rows) => `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  /* ── Các "công cụ" truy xuất (mô phỏng Agentic RAG tools) ── */
  function ansOrder(code) {
    const o = U.orderByCode(code);
    if (!o) return { s: ["🧠 Planner", "🔍 Order Lookup Tool", "⚠ CRAG: không thấy → hỏi lại"], h: `Không tìm thấy đơn <b>${U.esc(code)}</b> trong 95 đơn hàng. Bạn kiểm tra lại mã (ví dụ: <b>AE2607131</b>, <b>AE2607172</b>)?` };
    const rows = U.SIZES.filter(s => o.sizes[s]).map(s =>
      [s, U.fmt(o.sizes[s].ordered), U.fmt(o.sizes[s].received), U.fmt(o.sizes[s].received - o.sizes[s].ordered)]);
    return {
      s: ["🧠 Planner", "🔍 Order Lookup Tool", "📊 Size Matrix", "✅ Answer"],
      h: `<b>${U.flag(o.ctry)} Đơn ${o.ord}</b> — ${U.esc(o.ctry)} · PO <b>${U.esc(o.po)}</b> · màu <b>${o.col}</b> · đợt ${o.bat}.<br>
      Đặt <b>${U.fmt(o.prs)} đôi</b> (${U.fmt(o.ctn)} thùng) · xuất KD <b>${U.fmtDate(o.d)}</b> (còn ${o.daysLeft} ngày).<br>
      Đã nhập kho <b>${U.fmt(o.recvPrs)} đôi</b>${o.recvDates.length ? " (ngày " + o.recvDates.join(", ") + ")" : ""} — còn thiếu <b>${U.fmt(o.short)} đôi</b>.
      ${o.notes.length ? "<br>⚠ Chưa sản xuất: <b>" + o.notes.map(U.esc).join("; ") + "</b>" : ""}
      ${tbl(["Size", "Đặt", "Nhập", "Chênh"], rows)}
      <div style="margin-top:6px"><a href="#/orders?q=${o.ord}">Mở trang đơn hàng →</a></div>`
    };
  }

  function ansCountry(c) {
    const rows = TVS_ORDERS.filter(r => r.ctry === c);
    const ords = U.ORDER_INDEX.filter(o => o.ctry === c);
    const byDate = U.aggBy(rows, r => r.d).sort((a, b) => a.key.localeCompare(b.key));
    return {
      s: ["🧠 Planner", "🗂 Country Filter Tool", "∑ Aggregator", "✅ Answer"],
      h: `<b>${U.flag(c)} ${c} (${U.VN_COUNTRY[c] || c})</b>: <b>${ords.length} đơn hàng</b>, tổng <b>${U.fmt(U.sum(rows, r => r.prs))} đôi</b> = ${U.fmt(U.sum(rows, r => r.ctn))} thùng.
      ${tbl(["Ngày xuất KD", "Số đôi", "Số thùng", "Đơn"], byDate.map(x => [U.fmtDate(x.key), U.fmt(x.prs), U.fmt(x.ctn), U.uniq(x.rows, r => r.ord).length]))}
      Đơn: ${ords.slice(0, 8).map(o => `<b>${o.ord}</b>`).join(", ")}${ords.length > 8 ? ` +${ords.length - 8} đơn` : ""}.`
    };
  }

  function ansColor(col) {
    const rows = TVS_ORDERS.filter(r => r.col === col);
    if (!rows.length) return { s: ["🧠 Planner", "🎨 Color Tool", "⚠ CRAG"], h: `Không có mã màu <b>${U.esc(col)}</b>. 5 màu thật: LC1783, LC1784, LC1785, LC1786, LC1787.` };
    const bySz = U.SIZES.map(s => [s, U.fmt(U.sum(rows.filter(r => r.sz === s), r => r.prs))]);
    return {
      s: ["🧠 Planner", "🎨 Color Filter Tool", "∑ Aggregator", "✅ Answer"],
      h: `Màu <b>${col}</b>: <b>${U.fmt(U.sum(rows, r => r.prs))} đôi</b> (${U.fmt(U.sum(rows, r => r.ctn))} thùng) trên ${U.uniq(rows, r => r.ord).length} đơn, ${U.uniq(rows, r => r.ctry).length} thị trường.
      ${tbl(["Size", "Số đôi"], bySz)}`
    };
  }

  function ansShort() {
    return {
      s: ["🧠 Planner", "⚖ Shortage Tool (N↔Đặt)", "✅ Answer"],
      h: `Hiện có <b>${U.SHORTAGES.length} mục thiếu</b>, tổng <b>${U.fmt(U.sum(U.SHORTAGES, s => s.qty))} đôi</b>:
      ${tbl(["Đơn", "Size", "Thiếu", "Loại"], U.SHORTAGES.map(s => [`${s.ord} ${U.flag(s.ctry)}`, s.sz, U.fmt(s.qty), s.type]))}
      Ưu tiên nhất: <b>AE2607131 (Ý)</b> xuất ngày <b>25/07/2026</b> — còn ${U.daysFromToday("2026-07-25")} ngày mà thiếu 15 đôi UK 9 chưa sản xuất.`
    };
  }

  function ansNXT() {
    const N = U.NXT;
    return {
      s: ["🧠 Planner", "📦 Inventory Tool (N-X-T)", "✅ Answer"],
      h: `Tình hình <b>N-X-T</b> đến ${U.fmtDate(TVS_META.today)}:
      ${tbl(["Chỉ tiêu", "Đôi", "Thùng"], [
        ["① Tổng đặt hàng", U.fmt(N.datPrs), U.fmt(N.datCtn)],
        ["② Nhập kho (N)", U.fmt(N.nhapPrs), U.fmt(N.nhapCtn)],
        ["③ Xuất kho (X)", U.fmt(N.xuatPrs), U.fmt(N.xuatCtn)],
        ["④ Tồn kho (T)", "<b>" + U.fmt(N.tonPrs) + "</b>", "<b>" + U.fmt(N.tonCtn) + "</b>"],
        ["⑤ Còn phải SX", U.fmt(N.conSXPrs), "—"]])}
      Tiến độ đạt <b>${U.fmtPct(N.progress)}</b> kế hoạch. Chi tiết tại <a href="#/inventory">trang N-X-T →</a>`
    };
  }

  function ansShip() {
    const up = U.SHIP_PLAN.filter(p => p.days >= 0).slice(0, 5);
    return {
      s: ["🧠 Planner", "🚚 Shipping Plan Tool", "✅ Answer"],
      h: `5 mốc xuất KD gần nhất:
      ${tbl(["Ngày", "Còn", "Số đôi", "Thị trường"], up.map(p =>
        [U.fmtDate(p.d), p.days + " ngày", U.fmt(p.prs), p.ctries.map(c => U.flag(c)).join(" ")]))}
      Toàn bộ 15 mốc xem tại <a href="#/shipping">Kế hoạch xuất →</a>`
    };
  }

  function ansOnTime() {
    const OT = U.ONTIME;
    if (!OT.n) return {
      s: ["🧠 Planner", "⏱ On-time Tool", "✅ Answer"],
      h: `Chưa có chỉ thị nào ghi nhận <b>ngày thực xuất</b>. Hãy tạo phiếu tại <a href="#/delivery">Lệnh giao hàng</a>,
      bấm <b>“Xuất kho”</b> — hệ thống sẽ ghi ngày thực xuất và tự tính % đúng hạn so với "Ngày xuất KD".`
    };
    return {
      s: ["🧠 Planner", "⏱ On-time Tool (thực xuất ↔ KD)", "✅ Answer"],
      h: `Tỷ lệ xuất <b>đúng hạn: ${U.fmtPct(OT.rate, 0)}</b> (${OT.onTimeN}/${OT.n} chỉ thị) ·
      theo số đôi: <b>${U.fmtPct(OT.pairsRate, 0)}</b> (${U.fmt(OT.pairsOnTime)}/${U.fmt(OT.pairs)} đôi) ·
      chênh lệch bình quân <b>${(OT.avgDelay > 0 ? "+" : "") + OT.avgDelay.toFixed(1).replace(".", ",")} ngày</b>.
      ${tbl(["Chỉ thị", "Ngày KD", "Thực xuất", "Chênh", "Kết quả"], OT.orders.map(o =>
        [o.ord, U.fmtDate(o.d), U.fmtDate(o.lastShipDate), (o.delayDays > 0 ? "+" : "") + o.delayDays + " ngày",
         o.onTime ? "✅ đúng hạn" : "❌ trễ"]))}
      Chi tiết tại <a href="#/delivery">Lệnh giao hàng →</a>`
    };
  }

  function ansTotals() {
    return {
      s: ["🧠 Planner", "∑ Aggregator", "✅ Answer"],
      h: `Chương trình <b>adidas Rubber Boots ${TVS_META.itemCode}</b> tại TVS:
      <br>• Tổng đặt: <b>${U.fmt(TVS_META.totalPairs)} đôi</b> = <b>${U.fmt(TVS_META.totalCartons)} thùng</b> (quy cách 6 đôi/thùng)
      <br>• <b>95 đơn hàng</b> · <b>14 quốc gia</b> · <b>5 mã màu</b> · size UK 3–9 · 3 đợt đặt hàng
      <br>• Thị trường lớn nhất: 🇺🇸 Mỹ (10.878 đôi), 🇩🇪 Đức (7.414), 🇯🇵 Nhật (5.606)
      <br>• Màu chủ lực: LC1783 (16.534 đôi ≈ 41,3%) · Size chạy nhất: UK 6 (11.439 đôi)
      <br>• Đã nhập kho: <b>${U.fmt(U.NXT.nhapPrs)} đôi</b> (${U.fmtPct(U.NXT.progress)})`
    };
  }

  function ansBatch(b) {
    const rows = TVS_ORDERS.filter(r => r.bat === b);
    return {
      s: ["🧠 Planner", "🗂 Batch Filter Tool", "∑ Aggregator", "✅ Answer"],
      h: `<b>Đợt đặt hàng ${b}</b>: ${U.fmt(U.sum(rows, r => r.prs))} đôi = ${U.fmt(U.sum(rows, r => r.ctn))} thùng,
      ${U.uniq(rows, r => r.ord).length} đơn, ${U.uniq(rows, r => r.ctry).length} thị trường,
      giao từ ${U.fmtDate(U.uniq(rows, r => r.d).sort()[0])} đến ${U.fmtDate(U.uniq(rows, r => r.d).sort().pop())}.`
    };
  }

  function ansHelp() {
    return {
      s: ["🧠 Planner", "💬 Help"],
      h: `Tôi là <b>Trợ lý AI TVS</b> — truy xuất trực tiếp dữ liệu thật của 2 sheet Excel. Bạn có thể hỏi:
      <br>• "Đơn <b>AE2607131</b> thế nào?" — tra 1 đơn + ma trận size
      <br>• "Tổng hàng đi <b>Mỹ</b>?" / "đơn đi <b>Nhật</b>" — theo quốc gia
      <br>• "Màu <b>LC1783</b> bao nhiêu đôi?" — theo mã màu
      <br>• "Đang <b>thiếu</b> những gì?" — thiếu khi nhập + chưa sản xuất
      <br>• "<b>Tồn kho</b> hiện tại?" — bảng N-X-T
      <br>• "Lịch <b>xuất hàng</b> sắp tới?" / "Đợt 2 có gì?"`
    };
  }

  /* ── Planner: định tuyến ý định ── */
  function route(q) {
    const n = norm(q);
    const mOrd = q.match(/AE\d{6,}/i);
    if (mOrd) return ansOrder(mOrd[0].toUpperCase());
    const mPO = q.match(/\d{8,}-\d/);
    if (mPO) {
      const o = U.ORDER_INDEX.find(x => x.po.includes(mPO[0]));
      return o ? ansOrder(o.ord) : { s: ["🧠 Planner", "🔍 PO Lookup", "⚠ CRAG"], h: `Không thấy PO <b>${mPO[0]}</b>.` };
    }
    const mCol = q.match(/LC\s?17\d{2}/i);
    if (mCol) return ansColor(mCol[0].replace(/\s/, "").toUpperCase());
    const mBat = n.match(/dot\s*([123])/);
    if (mBat) return ansBatch(+mBat[1]);
    for (const k of Object.keys(CTRY_ALIAS).sort((a, b) => b.length - a.length)) {
      if (new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(n)) return ansCountry(CTRY_ALIAS[k]);
    }
    if (/dung han|tre han|on ?time|ty le|dung ngay/.test(n)) return ansOnTime();
    if (/thieu|chua san xuat|chua sx/.test(n)) return ansShort();
    if (/ton kho|n-x-t|nxt|ton\b/.test(n)) return ansNXT();
    if (/phieu xuat|lenh giao|thuc xuat/.test(n)) return ansOnTime();
    if (/xuat|lich|giao hang|ship/.test(n)) return ansShip();
    if (/nhap kho|tien do|san xuat|nhap/.test(n)) return ansNXT();
    if (/tong|bao nhieu|so luong|thong ke|size|mau/.test(n)) return ansTotals();
    return ansHelp();
  }

  /* ── Giao diện chat ── */
  window.Views.assistant = {
    title: "Trợ lý AI · Agentic RAG",
    render(root) {
      root.innerHTML = `
        <div class="chat-wrap">
          <div class="card chat">
            <div class="chat-log" id="chatLog"></div>
            <div class="chat-in">
              <input id="chatIn" placeholder="Hỏi về đơn hàng, tồn kho, lịch xuất… (vd: Đơn AE2607131 thế nào?)" autocomplete="off">
              <button class="btn primary" id="chatSend">Gửi</button>
            </div>
          </div>
          <div>
            <div class="card">
              <div class="card-h"><h3>Câu hỏi nhanh</h3></div>
              <div class="card-b quick-qs" id="quickQs">
                <button>Đơn AE2607131 thế nào?</button>
                <button>Tồn kho hiện tại?</button>
                <button>Đang thiếu những gì?</button>
                <button>Tổng hàng đi Mỹ?</button>
                <button>Lịch xuất hàng sắp tới?</button>
                <button>Tỷ lệ xuất đúng hạn bao nhiêu?</button>
                <button>Màu LC1783 bao nhiêu đôi?</button>
                <button>Đợt 2 có gì?</button>
              </div>
            </div>
            <div class="card mt">
              <div class="card-h"><h3>Cách hoạt động</h3></div>
              <div class="card-b note">
                Mô phỏng <b>Agentic RAG</b> (hình tham chiếu ②): Planner phân tích câu hỏi →
                gọi công cụ truy xuất trên dữ liệu thật (Order Lookup, Aggregator, Inventory N-X-T,
                Shipping Plan) → tổng hợp trả lời kèm bảng số liệu. Nếu không truy xuất được,
                cơ chế <b>CRAG</b> sẽ hỏi lại thay vì đoán bừa. Chạy 100% trên trình duyệt.
              </div>
            </div>
          </div>
        </div>`;

      const log = root.querySelector("#chatLog");
      const input = root.querySelector("#chatIn");
      const addMsg = (cls, html) => {
        const d = document.createElement("div");
        d.className = "msg " + cls; d.innerHTML = html;
        log.appendChild(d); log.scrollTop = log.scrollHeight;
      };
      const ask = q => {
        if (!q.trim()) return;
        addMsg("user", U.esc(q));
        const t = document.createElement("div");
        t.className = "msg bot"; t.innerHTML = `<span class="note">Đang truy xuất dữ liệu…</span>`;
        log.appendChild(t); log.scrollTop = log.scrollHeight;
        setTimeout(() => {
          const a = route(q);
          t.innerHTML = steps(a.s) + a.h;
          log.scrollTop = log.scrollHeight;
        }, 380);
      };

      addMsg("bot", steps(["🤖 TVS Assistant", "sẵn sàng"]) +
        `Xin chào! Tôi nắm toàn bộ <b>${U.fmt(TVS_ORDERS.length)} dòng đơn hàng</b> và
        <b>${TVS_RECEIPTS.length} dòng nhập kho</b> thật của chương trình adidas Rubber Boots ${TVS_META.itemCode}.
        Hãy hỏi tôi bất cứ điều gì về đơn hàng, tồn kho N-X-T hay lịch xuất — hoặc bấm câu hỏi nhanh bên cạnh.`);

      root.querySelector("#chatSend").onclick = () => { ask(input.value); input.value = ""; input.focus(); };
      input.addEventListener("keydown", e => { if (e.key === "Enter") { ask(input.value); input.value = ""; } });
      root.querySelectorAll("#quickQs button").forEach(b => b.onclick = () => ask(b.textContent));
    }
  };
})();
