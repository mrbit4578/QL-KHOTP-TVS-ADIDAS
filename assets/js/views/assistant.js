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
    "brazil": "BRAZIL", "thai lan": "THAILAND", "thailand": "THAILAND",
    "trung quoc": "CHINA", "china": "CHINA", "dai loan": "TAIWAN", "taiwan": "TAIWAN",
    "han quoc": "SOUTH KOREA", "korea": "SOUTH KOREA", "south korea": "SOUTH KOREA",
  };

  const steps = arr => `<div class="steps">${arr.map((s, i) =>
    `<span class="step${i === arr.length - 1 ? " hot" : ""}">${s}</span>`).join("")}</div>`;
  const tbl = (heads, rows) => `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  /* ── Các "công cụ" truy xuất (mô phỏng Agentic RAG tools) ── */
  function ansOrder(code) {
    const o = U.orderByCode(code);
    if (!o) return { s: ["🧠 Planner", "🔍 Order Lookup Tool", "⚠ CRAG: không thấy → hỏi lại"], h: `Không tìm thấy đơn <b>${U.esc(code)}</b> trong ${U.ORDER_INDEX.length} đơn hàng. Bạn kiểm tra lại mã (ví dụ: <b>AE2607131</b>, <b>AD2600004</b>)?` };
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
    if (!U.SHORTAGES.length) {
      return {
        s: ["🧠 Planner", "⚖ Shortage Tool (N↔Đặt)", "✅ Answer"],
        h: `Hiện không có đơn nào đang nhập dở bị thiếu hụt size.`
      };
    }
    const partialOrds = U.ORDER_INDEX.filter(o => o.recvPrs > 0 && o.short > 0).sort((a, b) => a.d.localeCompare(b.d));
    const prio = partialOrds[0];
    return {
      s: ["🧠 Planner", "⚖ Shortage Tool (N↔Đặt)", "✅ Answer"],
      h: `Hiện có <b>${U.SHORTAGES.length} mục thiếu</b> trên các đơn đã nhập kho 1 phần, tổng <b>${U.fmt(U.sum(U.SHORTAGES, s => s.qty))} đôi</b>:
      ${tbl(["Đơn", "Size", "Thiếu", "Loại"], U.SHORTAGES.map(s => [`${s.ord} ${U.flag(s.ctry)}`, s.sz, U.fmt(s.qty), s.type]))}
      ${prio ? `Ưu tiên nhất: <b>${prio.ord} (${U.VN_COUNTRY[prio.ctry] || prio.ctry})</b> xuất ngày <b>${U.fmtDate(prio.d)}</b> — đã nhập ${U.fmt(prio.recvPrs)}/${U.fmt(prio.prs)} đôi, còn thiếu <b>${U.fmt(prio.short)} đôi</b>.` : ""}`
    };
  }

  function ansNXT() {
    const N = U.NXT;
    return {
      s: ["🧠 Planner", "📦 Inventory Tool (N-X-T)", "✅ Answer"],
      h: `Tình hình <b>N-X-T</b> hiện tại (mapping thùng theo CLP):
      ${tbl(["Chỉ tiêu", "Đôi", "Thùng (CLP)"], [
        ["① Tổng đặt hàng", U.fmt(N.datPrs), U.fmt(N.datCtn)],
        ["② Nhập kho (N)", U.fmt(N.nhapPrs), U.fmt(N.nhapCtn)],
        ["③ Xuất kho (X)", U.fmt(N.xuatPrs), U.fmt(N.xuatCtn)],
        ["④ Tồn kho (T)", "<b>" + U.fmt(N.tonPrs) + "</b>", "<b>" + U.fmt(N.tonCtn) + "</b>"],
        ["⑤ Còn phải SX", U.fmt(N.conSXPrs), U.fmt(N.datCtn - N.nhapCtn)]])}
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
      Toàn bộ ${U.SHIP_PLAN.length} mốc xem tại <a href="#/shipping">Kế hoạch xuất →</a>`
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
    const N = U.NXT;
    const byCtry = U.aggBy(TVS_ORDERS, r => r.ctry).slice(0, 3);
    const byCol = U.aggBy(TVS_ORDERS, r => r.col)[0];
    const bySz = U.aggBy(TVS_ORDERS, r => r.sz)[0];
    const nBats = U.uniq(TVS_ORDERS, r => r.bat).length;
    const nCtries = U.uniq(TVS_ORDERS, r => r.ctry).length;
    const nCols = U.uniq(TVS_ORDERS, r => r.col).length;
    return {
      s: ["🧠 Planner", "∑ Aggregator", "✅ Answer"],
      h: `Chương trình <b>adidas Rubber Boots ${TVS_META.itemCode}</b> tại TVS:
      <br>• Tổng đặt: <b>${U.fmt(N.datPrs)} đôi</b> = <b>${U.fmt(N.datCtn)} thùng</b> (mapping theo Packing List · CLP)
      <br>• <b>${U.ORDER_INDEX.length} đơn hàng</b> · <b>${nCtries} quốc gia</b> · <b>${nCols} mã màu</b> · size UK 3–9 · <b>${nBats} đợt đặt hàng</b>
      <br>• Thị trường lớn nhất: ${byCtry.map(x => `${U.flag(x.key)} ${U.VN_COUNTRY[x.key] || x.key} (${U.fmt(x.prs)} đôi)`).join(", ")}
      <br>• Màu chủ lực: ${byCol ? `${byCol.key} (${U.fmt(byCol.prs)} đôi ≈ ${U.fmtPct(byCol.prs / N.datPrs)})` : "—"} · Size chạy nhất: ${bySz ? `${bySz.key} (${U.fmt(bySz.prs)} đôi)` : "—"}
      <br>• Đã nhập kho: <b>${U.fmt(N.nhapPrs)} đôi (${U.fmt(N.nhapCtn)} thùng)</b> (${U.fmtPct(N.progress)}) · Đã xuất: <b>${U.fmt(N.xuatPrs)} đôi</b> · Tồn: <b>${U.fmt(N.tonPrs)} đôi (${U.fmt(N.tonCtn)} thùng)</b>`
    };
  }

  function ansBatch(b) {
    const rows = TVS_ORDERS.filter(r => r.bat === b);
    if (!rows.length) return { s: ["🧠 Planner", "🗂 Batch Filter Tool", "⚠ CRAG"], h: `Không có đơn hàng nào thuộc <b>Đợt ${b}</b>. Các đợt hiện có: ${U.uniq(TVS_ORDERS, r => r.bat).sort((x, y) => x - y).map(x => "Đợt " + x).join(", ")}.` };
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
      h: `Tôi là <b>Trợ lý AI TVS</b> — truy xuất trực tiếp dữ liệu thật trên hệ thống. Bạn có thể hỏi:
      <br>• "Đơn <b>AE2607131</b> hoặc <b>AD2600004</b> thế nào?" — tra 1 đơn + ma trận size
      <br>• "Tổng hàng đi <b>Mỹ</b>?" / "đơn đi <b>Nhật</b>" — theo quốc gia
      <br>• "Màu <b>LC1783</b> bao nhiêu đôi?" — theo mã màu
      <br>• "Đang <b>thiếu</b> những gì?" — thiếu khi nhập + chưa sản xuất
      <br>• "<b>Tồn kho</b> hiện tại?" — bảng N-X-T
      <br>• "Lịch <b>xuất hàng</b> sắp tới?" / "Đợt 4 có gì?"`
    };
  }

  /* ── Planner: định tuyến ý định ── */
  function route(q) {
    const n = norm(q);
    const mOrd = q.match(/\b(?:AE|AD)\d{5,}\b/i);
    if (mOrd) return ansOrder(mOrd[0].toUpperCase());
    const mPO = q.match(/\d{8,}-\d/);
    if (mPO) {
      const o = U.ORDER_INDEX.find(x => x.po.includes(mPO[0]));
      return o ? ansOrder(o.ord) : { s: ["🧠 Planner", "🔍 PO Lookup", "⚠ CRAG"], h: `Không thấy PO <b>${mPO[0]}</b>.` };
    }
    const mCol = q.match(/LC\s?17\d{2}/i);
    if (mCol) return ansColor(mCol[0].replace(/\s/, "").toUpperCase());
    const mBat = n.match(/dot\s*(\d+)/);
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
