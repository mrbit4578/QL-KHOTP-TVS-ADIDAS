/* ═══════════════════════════════════════════════════════════════════
   xlsx-lite.js — Trình đọc file Excel .xlsx thuần JavaScript (offline)
   Không cần thư viện ngoài: dùng DecompressionStream của trình duyệt
   (Chrome 103+, Edge, Safari 16.4+, Firefox 113+) để giải nén ZIP.
   API:  XlsxLite.parse(arrayBuffer) → Promise<Array<Array>>  (sheet đầu)
         XlsxLite.supported → boolean
   Hỗ trợ: sharedStrings, inlineStr, số & chuỗi; số serial ngày Excel
   được giữ nguyên dạng số — dùng XlsxLite.serialToISO() khi cần.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const X = {};
  X.supported = typeof DecompressionStream !== "undefined";

  /* ── ZIP: đọc central directory & giải nén entry ── */
  function findEOCD(dv) {
    for (let i = dv.byteLength - 22; i >= Math.max(0, dv.byteLength - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) return i;
    }
    throw new Error("File không phải ZIP/XLSX hợp lệ");
  }
  function readEntries(buf) {
    const dv = new DataView(buf);
    const eocd = findEOCD(dv);
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const entries = {};
    const td = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true);
      const elen = dv.getUint16(off + 30, true);
      const clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = td.decode(new Uint8Array(buf, off + 46, nlen));
      entries[name] = { method, csize, lho };
      off += 46 + nlen + elen + clen;
    }
    return entries;
  }
  async function extract(buf, entry) {
    const dv = new DataView(buf);
    const off = entry.lho;
    if (dv.getUint32(off, true) !== 0x04034b50) throw new Error("Local header lỗi");
    const nlen = dv.getUint16(off + 26, true);
    const elen = dv.getUint16(off + 28, true);
    const start = off + 30 + nlen + elen;
    const bytes = new Uint8Array(buf, start, entry.csize);
    if (entry.method === 0) return new TextDecoder().decode(bytes);
    if (entry.method === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    throw new Error("Phương thức nén không hỗ trợ: " + entry.method);
  }

  /* ── XML helpers ── */
  const parseXML = s => new DOMParser().parseFromString(s, "application/xml");
  const colIdx = ref => {
    let n = 0;
    for (const ch of ref) {
      if (ch >= "A" && ch <= "Z") n = n * 26 + (ch.charCodeAt(0) - 64);
      else break;
    }
    return n - 1;
  };

  /* ── Đọc sheet đầu tiên thành mảng 2 chiều ── */
  X.parse = async function (buf) {
    if (!X.supported) throw new Error("Trình duyệt không hỗ trợ DecompressionStream — hãy dùng file CSV");
    const entries = readEntries(buf);

    /* sharedStrings */
    let shared = [];
    if (entries["xl/sharedStrings.xml"]) {
      const doc = parseXML(await extract(buf, entries["xl/sharedStrings.xml"]));
      shared = [...doc.getElementsByTagName("si")].map(si =>
        [...si.getElementsByTagName("t")].map(t => t.textContent).join(""));
    }

    /* sheet đầu tiên theo workbook.xml + rels */
    let sheetPath = "xl/worksheets/sheet1.xml";
    try {
      const wbDoc = parseXML(await extract(buf, entries["xl/workbook.xml"]));
      const first = wbDoc.getElementsByTagName("sheet")[0];
      const rid = first && (first.getAttribute("r:id") || first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
      if (rid && entries["xl/_rels/workbook.xml.rels"]) {
        const relDoc = parseXML(await extract(buf, entries["xl/_rels/workbook.xml.rels"]));
        for (const rel of relDoc.getElementsByTagName("Relationship")) {
          if (rel.getAttribute("Id") === rid) {
            let t = rel.getAttribute("Target").replace(/^\//, "");
            if (!t.startsWith("xl/")) t = "xl/" + t.replace(/^(\.\.\/)+/, "");
            sheetPath = t;
          }
        }
      }
    } catch (e) { /* dùng mặc định sheet1 */ }
    if (!entries[sheetPath]) {
      const alt = Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
      if (alt) sheetPath = alt; else throw new Error("Không tìm thấy worksheet");
    }

    const doc = parseXML(await extract(buf, entries[sheetPath]));
    const rows = [];
    for (const rowEl of doc.getElementsByTagName("row")) {
      const rIdx = parseInt(rowEl.getAttribute("r") || (rows.length + 1), 10) - 1;
      while (rows.length <= rIdx) rows.push([]);
      const arr = rows[rIdx];
      let autoCol = 0;
      for (const c of rowEl.getElementsByTagName("c")) {
        const ref = c.getAttribute("r");
        const ci = ref ? colIdx(ref) : autoCol;
        autoCol = ci + 1;
        const t = c.getAttribute("t") || "n";
        let val = null;
        if (t === "inlineStr") {
          val = [...c.getElementsByTagName("t")].map(x => x.textContent).join("");
        } else {
          const v = c.getElementsByTagName("v")[0];
          if (v) {
            if (t === "s") val = shared[parseInt(v.textContent, 10)] ?? "";
            else if (t === "str" || t === "b") val = v.textContent;
            else {
              const num = parseFloat(v.textContent);
              val = isNaN(num) ? v.textContent : num;
            }
          }
        }
        arr[ci] = val;
      }
    }
    return rows;
  };

  /* Số serial Excel → ISO yyyy-mm-dd (epoch 1900, bỏ qua giờ) */
  X.serialToISO = function (n) {
    if (typeof n !== "number" || n < 20000 || n > 80000) return null;
    const ms = Math.round((n - 25569) * 86400000);
    const d = new Date(ms);
    const p = x => String(x).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  };

  window.XlsxLite = X;
})();
