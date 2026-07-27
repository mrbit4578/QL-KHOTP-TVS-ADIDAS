# TVS × adidas — Hệ thống web quản lý N-X-T Rubber Boots

**Công ty TNHH Giày Tuấn Việt (TVS)** — Nhà máy sản xuất giày thành phẩm Rubber Boots thương hiệu **adidas**, mã hàng **NVQ89**.

Hệ thống web tĩnh hoàn chỉnh theo dõi **Nhập – Xuất – Tồn (N-X-T)** kho thành phẩm, xây dựng từ **100% dữ liệu thật** trong file `THEO DOI CHI TIET N-X-T ADIDAS.xlsm`.

🌐 **Chạy online:** https://mrbit4578.github.io/QL-KHOTP-TVS-ADIDAS/

---

## ☁️ Chạy online trên GitHub Pages + lưu dữ liệu thật trên GitHub (v4)

### Bật GitHub Pages (làm 1 lần)
1. Vào repo → **Settings → Pages**
2. Mục **Build and deployment › Source**: chọn *Deploy from a branch* → Branch **main**, thư mục **/ (root)** → **Save**
3. Chờ ~1 phút → web chạy tại **https://mrbit4578.github.io/QL-KHOTP-TVS-ADIDAS/**

### Dữ liệu thật lưu trên GitHub
- Toàn bộ dữ liệu nhập thêm (đơn hàng, nhập kho, phiếu xuất kho) lưu tại **`data/tvs-data.json`** trong repo
- Mở web → hệ thống **tự tải dữ liệu chung** từ GitHub (mọi người luôn thấy số liệu mới nhất, chip ☁ trên topbar)
- Tài khoản nhập liệu thao tác → hệ thống **tự commit** file dữ liệu (ghi rõ *"Cập nhật dữ liệu bởi thukho…"*) → xem lại lịch sử thay đổi trong tab **Commits** của repo
- ⚠ Repo **public** thì dữ liệu đơn hàng cũng public — nếu cần bảo mật hãy chuyển repo sang **Private** (GitHub Pages với repo private yêu cầu gói GitHub Pro)

### Phân quyền: 3 tài khoản nhập liệu, còn lại chỉ xem
| Tài khoản | Vai trò | Mật khẩu mặc định |
|---|---|---|
| `thukho` | Thủ kho — nhập liệu | `thukho@2026` |
| `kinhdoanh` | Phòng NVKD — nhập liệu | `kinhdoanh@2026` |
| `quanly` | Quản lý kho — nhập liệu | `quanly@2026` |
| *(không đăng nhập)* | **Chỉ xem** toàn bộ số liệu | — |

- Người xem: mở link là xem được mọi màn hình; **toàn bộ nút thêm/sửa/xoá/xuất kho bị ẩn & khoá**
- ⚠ **Đổi mật khẩu ngay lần đầu**: sửa hash SHA-256 trong `assets/js/auth-config.js` — tạo hash mới bằng:
  `python3 -c "import hashlib;print(hashlib.sha256('MẬT_KHẨU_MỚI'.encode()).hexdigest())"`

### GitHub Token — chìa khoá GHI dữ liệu (phân quyền thật sự)
Lớp mật khẩu chỉ là giao diện; **quyền ghi thật** được GitHub bảo vệ bằng token:
1. Chủ repo vào **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access**: chỉ chọn `QL-KHOTP-TVS-ADIDAS` · **Permissions → Contents: Read and write** · hạn dùng tuỳ ý
3. Gửi token riêng cho **3 người nhập liệu** — mỗi người dán token 1 lần vào ô "GitHub Token" khi đăng nhập (máy sẽ nhớ)
4. Người không có token dù biết mật khẩu cũng **không thể ghi** — API GitHub từ chối (401/403)

---

## 🚀 Cách chạy

**Không cần cài đặt gì.** Giải nén và mở file `index.html` bằng trình duyệt (Chrome / Edge / Firefox / Safari).

> Toàn bộ hệ thống chạy offline: không CDN, không server, không internet. Dữ liệu đã được nhúng sẵn.

Tuỳ chọn chạy qua web server nội bộ (nếu muốn):

```bash
cd TVS-ADIDAS-WebSystem
python3 -m http.server 8080
# mở http://localhost:8080
```

## 📊 Nguồn dữ liệu thật

| Sheet Excel | Nội dung | Đưa vào hệ thống |
|---|---|---|
| `Data` — DATA ĐƠN ĐẶT HÀNG GỐC | 549 dòng chi tiết đơn đặt hàng từ khách adidas: ngày xuất KD, quốc gia, đơn hàng, PO, màu, size, số đôi, số thùng, đợt | `assets/js/data.js` → `TVS_ORDERS` |
| `ChitietNK` — CHI TIẾT THÀNH PHẨM ADIDAS NHẬP KHO | Từng ngày sản xuất xong → đóng thùng → nhập kho (17 cột: SL kiểm, SL đặt, thiếu/đủ, chưa SX, ngày thực xuất…) | `assets/js/data.js` → `TVS_RECEIPTS` |

**Số liệu tổng (đối chiếu khớp 100% với Excel):**
- Tổng đặt hàng: **40.027 đôi = 6.909 thùng** · 95 đơn hàng · 14 quốc gia · 5 mã màu (LC1783–LC1787) · size UK 3–9 · 3 đợt
- Đã nhập kho (đến 17/07/2026): **679 đôi = 117 thùng** (AE2607172 Argentina + AE2607131 Ý)
- Quy cách đóng thùng: **6 đôi/thùng** — Số thùng = `ROUNDUP(Số đôi ÷ 6)` (đúng công thức trong file)
- Thiếu khi nhập: 10 đôi (UK 6 −6, UK 8 −4) · Chưa sản xuất: UK 9 = 11 (Argentina) + UK 9 = 15 (Ý)

## 🧭 Các phân hệ (theo sơ đồ kiến trúc WMS — hình tham chiếu ①)

| Phân hệ | Trang | Vai trò |
|---|---|---|
| Analytics & Dashboard | **Bảng điều khiển** | KPI, cảnh báo đơn sắp đến hạn còn thiếu hàng, 5 biểu đồ tổng quan |
| OMS | **Đơn đặt hàng** | Tra cứu 95 đơn / 549 dòng, lọc đa chiều, ma trận size từng đơn + ➕ nhập liệu / import / export |
| WMS | **Nhập kho** | Nhật ký nhập kho từng ngày, đủ 17 cột gốc, quy cách đóng thùng, trạng thái QC + ➕ nhập liệu / import / export |
| **PXK** | **Lệnh giao hàng** | Phiếu xuất kho kiêm lệnh giao hàng (Mẫu 03/XKNB) — chọn nhiều chỉ thị, tải SL từ Nhập kho, ghi ngày thực xuất, **% xuất đúng hạn**, in phiếu |
| Inventory Tracking | **Tồn kho N-X-T** | Luồng ①Đặt → ②Nhập → ③Xuất → ④Tồn → ⑤Còn SX, danh sách thiếu hụt |
| TMS | **Kế hoạch xuất** | 15 mốc "Ngày xuất KD" (25/07/2026 → 09/01/2027), độ sẵn sàng từng mốc |
| Architecture | **Kiến trúc hệ thống** | Sơ đồ ERP ↔ WMS ↔ WCS/OMS/TMS + 5 kiến trúc RAG (hình tham chiếu ②) |
| AI Layer | **Trợ lý AI** | Chatbot mô phỏng Agentic RAG: hỏi đáp trực tiếp trên dữ liệu thật (kể cả % đúng hạn) |

## ✍️ Nhập liệu · Import · Export (v2.0)

**Màn hình nhập liệu** trên cả 3 màn hình dữ liệu:
- **Đơn đặt hàng**: nút *Thêm đơn hàng* — nhập mã chỉ thị, PO, quốc gia, màu, đợt, số đôi theo 7 size (thùng tự tính ROUNDUP ÷ 6)
- **Nhập kho**: nút *Nhập kho mới* — chọn chỉ thị → hệ thống tự đối chiếu SL đặt / đã nhập / còn thiếu theo size → nhập số lượng lần này
- **Lệnh giao hàng**: nút *Tạo lệnh giao hàng* (xem bên dưới)

**Export file mẫu & Import theo mẫu** (CSV UTF-8, mở được bằng Excel):
- `MAU_IMPORT_DON_DAT_HANG.csv` — 9 cột như sheet Data gốc
- `MAU_IMPORT_NHAP_KHO.csv` — chỉ cần Ngày NK, Đơn hàng, Size, Số đôi (quốc gia/PO/màu **tự mapping** từ đơn hàng)
- `MAU_IMPORT_PHIEU_XUAT_KHO.csv` — Số phiếu, Ngày, Chỉ thị, Size, SL thực xuất
- Import có **kiểm tra lỗi từng dòng** (sai size, chỉ thị không tồn tại, vượt tồn khả dụng…) và **xem trước** trước khi áp dụng
- Export dữ liệu hiện tại ra CSV ở từng màn hình

## 🚚 Lệnh giao hàng / Phiếu xuất kho (Mẫu 03/XKNB) — v3.0

Theo đúng file mẫu `PHIEU XUAT KHO THANH PHAM.xlsx`:
1. **Tạo lệnh** → điền thông tin phiếu (số phiếu `PXK-ADI-2026-xxxx`, lệnh GH `TVS-ADI-2026-xxxx`, Packing List, tài xế, biển số xe, seal…, mặc định xuất cho Công ty TNHH Giày Elite Việt Nam)
2. **Chọn chỉ thị cần xuất — chọn được NHIỀU chỉ thị** (mapping từ đơn đặt hàng, hiển thị tồn khả dụng, 📦 = có packing list)
3. Hệ thống **tải số lượng từ màn hình Nhập kho + PACKING LIST (CLP)** → mỗi dòng = 1 nhóm thùng đúng packing: thùng nguyên (6 đôi), thùng lẻ, **thùng MIX SIZE gộp đúng như packing list** (xuất nguyên thùng bật/tắt); số carton & số thùng #từ–đến lấy chính xác theo packing
4. **Xác nhận XUẤT KHO** → ghi **Ngày thực xuất** → trừ tồn N-X-T ngay lập tức
5. Hệ thống đối chiếu Ngày thực xuất ↔ Ngày xuất KD → **tỷ lệ xuất đúng hạn %** (theo chỉ thị & theo số đôi, chênh lệch bình quân ngày)
   - **Ô "Ngày thực xuất" nhập trực tiếp trên bảng lệnh giao hàng (v4.1):** mỗi phiếu có 1 ô ngày ngay tại danh sách — phiếu đã xuất sửa ngày sẽ tự tính lại tỷ lệ đúng hạn; phiếu nháp nhập sẵn ngày để bước "Xuất kho" điền tự động (người chỉ-xem thấy ngày dạng chữ, không sửa được)
6. **In phiếu phân trang** — hệ thống tự chia trang, chân mỗi trang in **"Trang i/tổng"** + số phiếu + ngày in; khối **XÁC NHẬN** theo mẫu chuẩn (dải tiêu đề xanh navy): Người lập phiếu · Người nhận hàng · Thủ kho · Bảo vệ · Phòng.NVKD · Ban giám đốc
7. **Chọn hướng giấy in ▯ Đứng / ▭ Ngang (A4)** ngay trên phiếu — hệ thống tự tính lại số dòng mỗi trang theo khổ giấy (ngân sách chiều cao mm thật), bơm rule `@page{size:A4 …}` để hộp thoại in nhận đúng hướng; số "Trang i/n" luôn khớp số tờ máy in báo; lựa chọn được ghi nhớ cho lần in sau
8. **Tự co dòng vừa trang** — khi trang cuối chỉ còn ít dòng + khối ký mà thiếu chỗ, hệ thống tự nén chiều cao dòng/khối ký để gói gọn trong trang, không lấn sang tờ sau (có badge "tự co dòng vừa trang")
9. **In qua tài liệu độc lập (v3.3)** — bấm "In phiếu" hệ thống dựng một tài liệu in riêng trong iframe ẩn (chỉ chứa các trang phiếu + CSS in chuyên dụng, cô lập 100% khỏi giao diện ứng dụng) rồi mới gọi hộp thoại in → **mọi trang 2-3-4… luôn in đủ nội dung** trên mọi trình duyệt, kể cả khi web đang chạy nhúng trong iframe khác; mỗi trang khoá đúng 1 tờ A4, footer ghim đáy tờ; bấm Ctrl+P trực tiếp khi đang mở phiếu cũng được tự xử lý qua cơ chế dự phòng

## 📦 Packing List (CLP) — nguồn tính số thùng

- File gốc: `260720_ADIDAS RAINBOOT - ĐƠN HÀNG XUỐNG LẦN 1` (sheet CLP) → nhúng tại `assets/js/data-packing.js`
- **34 chỉ thị đợt 1 = 12.601 đôi = 2.646 thùng**, 336 nhóm thùng trong đó **17 nhóm MIX size**
- Đối chiếu khớp 100% số đôi với đơn đặt hàng; đơn chưa có packing → tự dùng quy cách chuẩn 6 đôi/thùng

## 📥 Import nhập kho trực tiếp từ Excel (.xlsx)

- Màn hình Nhập kho nhận **đúng file mẫu `chi tiet nhap kho theo ngay.xlsx`** (1 dòng = 1 ngày × 1 chỉ thị, cột size 3→10) — import phát là hệ thống **tự unpivot + mapping** PO/mã hàng/màu/SL đặt/đợt/ngày xuất KD từ đơn hàng, có xem trước 2 bảng (dạng file ↔ dạng hệ thống) và cảnh báo trùng lặp
- Đọc .xlsx **không cần thư viện ngoài** nhờ `assets/js/xlsx-lite.js` (dùng DecompressionStream của trình duyệt); vẫn nhận .csv theo mẫu
- Màn hình có thêm **“Ma trận nhập kho theo ngày”** hiển thị dữ liệu đúng định dạng file mẫu

## 💾 Lưu trữ dữ liệu

- Dữ liệu Excel gốc là **bất biến** (nhúng trong `data.js`)
- Dữ liệu nhập tay / import / phiếu xuất kho lưu trong **localStorage của trình duyệt** — tự phục hồi khi mở lại
- Nút **↺ Khôi phục gốc** (chân sidebar) xoá toàn bộ dữ liệu bổ sung, quay về 100% Excel gốc
- Lưu ý: nếu mở qua môi trường nhúng chặn lưu trữ, hệ thống chạy ở *chế độ demo* (có cảnh báo) — bản .zip mở trên máy thật lưu bình thường

## 🗂 Cấu trúc dự án

```
TVS-ADIDAS-WebSystem/
├── index.html                  # Khung SPA (sidebar + topbar + router)
├── README.md
└── assets/
    ├── css/style.css           # Toàn bộ thiết kế (offline, không CDN) + form + phiếu in
    ├── img/logo.svg
    └── js/
        ├── data.js             # ★ DỮ LIỆU THẬT trích từ Excel (549 + 11 dòng) — bất biến
        ├── store.js            # ★ Lớp dữ liệu động: localStorage, CSV mẫu/import/export, phiếu XK
        ├── utils.js            # Lõi nghiệp vụ: N-X-T, tồn khả dụng, % xuất đúng hạn (U.rebuild)
        ├── charts.js           # Thư viện biểu đồ SVG thuần
        ├── app.js              # Router #/, icon, modal, toast, chọn file, in phiếu
        └── views/
            ├── dashboard.js    # Bảng điều khiển
            ├── orders.js       # OMS — Đơn đặt hàng + nhập liệu/import/export
            ├── warehouse.js    # WMS — Nhập kho + nhập liệu/import/export
            ├── delivery.js     # ★ PXK — Lệnh giao hàng, phiếu 03/XKNB, % đúng hạn
            ├── inventory.js    # N-X-T — Tồn kho (xuất thực từ phiếu XK)
            ├── shipping.js     # TMS — Kế hoạch xuất
            ├── architecture.js # Kiến trúc hệ thống (2 hình tham chiếu)
            └── assistant.js    # Trợ lý AI (Agentic RAG mô phỏng)
```

## 🔄 Cập nhật dữ liệu kỳ sau

Khi có file Excel mới, chỉ cần tái sinh `assets/js/data.js` (giữ nguyên định dạng `TVS_META / TVS_ORDERS / TVS_RECEIPTS`) — toàn bộ trang, biểu đồ, cảnh báo, N-X-T và trợ lý AI tự cập nhật theo.

---
© 2026 TVS — Công ty TNHH Giày Tuấn Việt · Xây dựng cho chương trình adidas Rubber Boots NVQ89

> **Mẹo:** File `TVS-ADIDAS-1FILE.html` là bản gộp toàn bộ hệ thống vào 1 file duy nhất — tiện gửi qua Zalo/Email, mở là chạy. Bản chuẩn nhiều file vẫn là `index.html`.
