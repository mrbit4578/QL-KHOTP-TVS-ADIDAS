/* ═══════════════════════════════════════════════════════════════════
   xlsx-write.js — GHI FILE EXCEL .xlsx THUẦN JAVASCRIPT (v4.9)
   • Không cần thư viện ngoài, không CDN — chạy offline như toàn hệ thống
   • Tự đóng gói ZIP (phương thức Store + CRC32) đúng chuẩn OOXML
   • Hỗ trợ: nhiều sheet, gộp ô, cố định dòng tiêu đề, độ rộng cột,
     định dạng số #,##0, tô nền tiêu đề, viền ô, chữ đậm/nghiêng
   Cách dùng:
     XlsxWrite.download("BAO_CAO.xlsx", [
       { name: "Bao cao", cols: [{w:6},{w:16}], freeze: {r:4, c:2},
         merges: [{s:{r:0,c:0}, e:{r:0,c:9}}],
         rows: [
           [{ v:"TIÊU ĐỀ", s:XlsxWrite.S.title }],
           ["Cột chữ", 1234, { v: 5678, s: XlsxWrite.S.numB }],
         ] }
     ]);
   Ô có thể là: chuỗi · số · null · { v, s, t } (t: "s" chuỗi | "n" số)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── CRC32 (bảng tra) ───────────────────────────────────────── */
  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const enc = s => new TextEncoder().encode(s);

  /* ── ZIP (Store — không nén, hợp lệ với mọi Excel) ──────────── */
  function zip(files) {
    const chunks = [], central = [];
    let offset = 0;
    const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

    for (const f of files) {
      const nameB = enc(f.name), data = f.data, crc = crc32(data);
      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0));
      const head = new Uint8Array(local);
      chunks.push(head, nameB, data);
      central.push({ crc, size: data.length, nameB, offset });
      offset += head.length + nameB.length + data.length;
    }
    const cdStart = offset;
    const cds = [];
    for (const c of central) {
      const rec = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.size), u32(c.size), u16(c.nameB.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
      const head = new Uint8Array(rec);
      cds.push(head, c.nameB);
      offset += head.length + c.nameB.length;
    }
    const end = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(offset - cdStart), u32(cdStart), u16(0)));

    const all = chunks.concat(cds, [end]);
    const total = all.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const b of all) { out.set(b, p); p += b.length; }
    return out;
  }

  /* ── Tiện ích XML ───────────────────────────────────────────── */
  const esc = s => String(s === null || s === undefined ? "" : s)
    .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]))
    /* loại ký tự điều khiển không hợp lệ trong XML */
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  /* Số cột 0 → "A", 26 → "AA" */
  function colName(i) {
    let s = "";
    for (i = i + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
  }
  const ref = (r, c) => colName(c) + (r + 1);

  /* ── Danh mục style cố định (chỉ số dùng trong cell.s) ──────── */
  const S = {
    base: 0,    // chữ thường, không viền
    title: 1,   // tiêu đề lớn (đậm 15)
    sub: 2,     // dòng phụ (nghiêng, xám)
    lab: 3,     // nhãn đậm không viền
    head: 4,    // tiêu đề bảng: nền xanh đậm, chữ trắng, viền, canh giữa, xuống dòng
    head2: 5,   // tiêu đề phụ: nền xám nhạt, đậm, viền, canh giữa
    txt: 6,     // ô chữ có viền
    txtC: 7,    // ô chữ có viền, canh giữa
    num: 8,     // ô số có viền, #,##0
    numB: 9,    // ô số có viền, đậm
    totT: 10,   // dòng tổng — chữ đậm nền vàng nhạt
    totN: 11,   // dòng tổng — số đậm nền vàng nhạt
    numNeg: 12, // ô số có viền, chữ đỏ (thiếu hụt)
    txtB: 13,   // ô chữ có viền, đậm
  };

  const STYLES_XML =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="8">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="7" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  /* ── Dựng XML 1 worksheet ───────────────────────────────────── */
  function sheetXml(sh) {
    const rows = sh.rows || [];
    const nCol = Math.max(1, ...rows.map(r => (r ? r.length : 0)));
    let body = "";

    rows.forEach((row, r) => {
      if (!row || !row.length) { body += `<row r="${r + 1}"/>`; return; }
      let cells = "";
      row.forEach((cell, c) => {
        if (cell === null || cell === undefined || cell === "") {
          /* vẫn ghi ô rỗng nếu có style (để giữ viền bảng) */
          const s0 = (cell && cell.s) || 0;
          if (s0) cells += `<c r="${ref(r, c)}" s="${s0}"/>`;
          return;
        }
        let v = cell, s = 0, t = null;
        if (typeof cell === "object") { v = cell.v; s = cell.s || 0; t = cell.t || null; }
        if (v === null || v === undefined || v === "") { if (s) cells += `<c r="${ref(r, c)}" s="${s}"/>`; return; }
        const isNum = t ? t === "n" : (typeof v === "number" && isFinite(v));
        cells += isNum
          ? `<c r="${ref(r, c)}"${s ? ` s="${s}"` : ""}><v>${v}</v></c>`
          : `<c r="${ref(r, c)}"${s ? ` s="${s}"` : ""} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      });
      const h = sh.rowHeights && sh.rowHeights[r];
      body += `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ""}>${cells}</row>`;
    });

    const colsXml = (sh.cols && sh.cols.length)
      ? `<cols>${sh.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 12}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const fz = sh.freeze;
    const paneXml = fz
      ? `<pane xSplit="${fz.c || 0}" ySplit="${fz.r || 0}" topLeftCell="${ref(fz.r || 0, fz.c || 0)}" activePane="bottomRight" state="frozen"/>`
      : "";
    const mergeXml = (sh.merges && sh.merges.length)
      ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m =>
          `<mergeCell ref="${ref(m.s.r, m.s.c)}:${ref(m.e.r, m.e.c)}"/>`).join("")}</mergeCells>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${ref(Math.max(0, rows.length - 1), Math.max(0, nCol - 1))}"/>
<sheetViews><sheetView workbookViewId="0"${sh.tabSelected ? ' tabSelected="1"' : ""}>${paneXml}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}<sheetData>${body}</sheetData>${mergeXml}
<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="${sh.landscape === false ? "portrait" : "landscape"}" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  /* Tên sheet hợp lệ: ≤31 ký tự, bỏ : \ / ? * [ ] */
  const safeName = (n, i) => (String(n || ("Sheet" + (i + 1))).replace(/[:\\\/?*\[\]]/g, "-").slice(0, 31) || ("Sheet" + (i + 1)));

  function build(sheets) {
    sheets = sheets.filter(Boolean);
    if (!sheets.length) sheets = [{ name: "Sheet1", rows: [] }];
    const names = sheets.map((s, i) => safeName(s.name, i));

    const files = [
      { name: "[Content_Types].xml", data: enc(
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`) },
      { name: "_rels/.rels", data: enc(
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`) },
      { name: "xl/workbook.xml", data: enc(
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`) },
      { name: "xl/_rels/workbook.xml.rels", data: enc(
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`) },
      { name: "xl/styles.xml", data: enc(STYLES_XML) },
    ];
    sheets.forEach((s, i) => files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc(sheetXml(Object.assign({ tabSelected: i === 0 }, s))),
    }));
    return zip(files);
  }

  function download(filename, sheets) {
    const bytes = build(sheets);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = /\.xlsx$/i.test(filename) ? filename : filename + ".xlsx";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return bytes.length;
  }

  const API = { S, build, download, colName, zip, _sheetXml: sheetXml };
  if (typeof window !== "undefined") window.XlsxWrite = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;   // để chạy kiểm thử
})();
