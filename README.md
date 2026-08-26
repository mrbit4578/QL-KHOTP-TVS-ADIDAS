# TVS × adidas — Hệ thống web quản lý N-X-T Rubber Boots

**Công ty TNHH Giày Tuấn Việt (TVS)** — Nhà máy sản xuất giày thành phẩm Rubber Boots thương hiệu **adidas**, mã hàng **NVQ89**.

Hệ thống web tĩnh hoàn chỉnh theo dõi **Nhập – Xuất – Tồn (N-X-T)** kho thành phẩm, xây dựng từ **100% dữ liệu thật** trong file `THEO DOI CHI TIET N-X-T ADIDAS.xlsm`.

> 🆕 **v5.0 — MỚI:** đã mapping **packing list (CLP) đủ 3 đợt** (95 chỉ thị = 40.027 đôi = 7.578 thùng) và bổ sung màn hình **Packing List · CLP** với tính năng **IMPORT PACKING LIST THEO MẪU** — từ đợt 4, 5, 6… chỉ cần import file là hệ thống **tự mapping** (thùng nguyên / thùng lẻ / thùng MIX SIZE), tự đối chiếu với đơn đặt hàng và dùng ngay cho phiếu xuất kho.

🌐 **Chạy online (GitHub Pages):** https://mrbit4578.github.io/QL-KHOTP-TVS-ADIDAS/
🗄 **Repo dữ liệu:** https://github.com/mrbit4578/QL-KHOTP-TVS-ADIDAS

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
| Sheet `CLP` của 3 file đơn hàng (đợt 1 · 2 · 3) | **Packing list thật**: 95 chỉ thị = **40.027 đôi = 7.578 thùng**, 898 nhóm thùng (45 nhóm MIX size) — khớp 100% số đôi với đơn đặt hàng theo từng size | `assets/js/data-packing.js` → `TVS_PACKING` |
| `chi tiet nhap kho theo ngay.xlsx` (cập nhật 30/07/2026) | **Dữ liệu nhập kho nguồn** — 11 dòng ma trận theo ngày (16/07→22/07) = **2.006 đôi / 345 thùng**, 5 chỉ thị: AE2607131, AE2607171, AE2607172, AE2607173, AE2607563 | `assets/js/data.js` → `TVS_RECEIPTS` (45 dòng chi tiết sau unpivot) |

**Số liệu tổng (đối chiếu khớp 100% với Excel):**
- Tổng đặt hàng: **40.027 đôi = 6.909 thùng** · 95 đơn hàng · 14 quốc gia · 5 mã màu (LC1783–LC1787) · size UK 3–9 · 3 đợt
- Đã nhập kho (nguồn 30/07/2026): **2.006 đôi = 345 thùng** — 11 lần nhập từ 16/07 → 22/07 của 5 chỉ thị
- Quy cách đóng thùng: **6 đôi/thùng** — Số thùng = `ROUNDUP(Số đôi ÷ 6)` (đúng công thức trong file)

## 🧭 Các phân hệ (theo sơ đồ kiến trúc WMS — hình tham chiếu ①)

| Phân hệ | Trang | Vai trò |
|---|---|---|
| Analytics & Dashboard | **Bảng điều khiển** | KPI, cảnh báo đơn sắp đến hạn còn thiếu hàng, 5 biểu đồ tổng quan |
| OMS | **Đơn đặt hàng** | Tra cứu 95 đơn / 549 dòng, lọc đa chiều, ma trận size từng đơn + ➕ nhập liệu / import / export + ✏️ **sửa / xoá / khôi phục đơn ngay tại màn hình (v4.8)** |
| WMS | **Nhập kho** | Nhật ký nhập kho từng ngày, đủ 17 cột gốc, quy cách đóng thùng, trạng thái QC + ➕ nhập liệu / import / export |
| **PXK** | **Lệnh giao hàng** | Phiếu xuất kho kiêm lệnh giao hàng (Mẫu 03/XKNB) — chọn nhiều chỉ thị, tải SL từ Nhập kho, ghi ngày thực xuất, **% xuất đúng hạn**, in phiếu + ➕ **import packing list ngay tại màn hình (v5.0)** |
| **Packing List** | **Packing List · CLP** | ★ **(v5.0)** Packing list 3 đợt gốc (95 chỉ thị = 40.027 đôi = 7.578 thùng) + **IMPORT packing list theo mẫu cho đợt 4, 5, 6…**, đối chiếu size với đơn đặt hàng, export .xlsx/.csv, nhật ký import |
| Inventory Tracking | **Tồn kho N-X-T** | Luồng ①Đặt → ②Nhập → ③Xuất → ④Tồn → ⑤Còn SX, danh sách thiếu hụt + 📊 **báo cáo theo kỳ & xuất Excel (v4.9)** |
| TMS | **Kế hoạch xuất** | 15 mốc "Ngày xuất KD" (25/07/2026 → 09/01/2027), độ sẵn sàng từng mốc |
| Architecture | **Kiến trúc hệ thống** | Sơ đồ ERP ↔ WMS ↔ WCS/OMS/TMS + 5 kiến trúc RAG (hình tham chiếu ②) |
| AI Layer | **Trợ lý AI** | Chatbot mô phỏng Agentic RAG: hỏi đáp trực tiếp trên dữ liệu thật (kể cả % đúng hạn) |

## 🎨 Giao diện: nền Sáng / Tối & phông chữ (v4.3)

- **Nút đổi nền Sáng/Tối** ở góc trên bên phải (☀/🌙) — chọn nền tối để dịu mắt khi làm ca đêm; lựa chọn được **ghi nhớ** cho lần mở sau. Bảng màu tối được tinh chỉnh tương phản hài hòa (không đen tuyệt đối), biểu đồ & bảng số liệu tự đổi màu theo nền.
- **Tiêu đề** (tiêu đề trang, tiêu đề đầu mục, số liệu lớn, tiêu đề phiếu in) dùng font **UTM Neo Sans Intel**; **nội dung** dùng **Roboto**.
- Đảm bảo **không lỗi dấu tiếng Việt**: nếu máy chưa cài UTM Neo Sans Intel, hệ thống tự lùi về **Be Vietnam Pro** (Google Fonts, đủ dấu tiếng Việt). Muốn hiển thị đúng UTM Neo Sans Intel cho mọi máy → đặt file font vào `assets/fonts/` (xem `assets/fonts/README.txt`).
- Phiếu in luôn giữ nền trắng chữ đen (chuẩn in giấy) dù đang xem ở nền tối.

## ✍️ Nhập liệu · Import · Export (v2.0)

**Màn hình nhập liệu** trên cả 3 màn hình dữ liệu:
- **Đơn đặt hàng**: nút *Thêm đơn hàng* — nhập mã chỉ thị, PO, quốc gia, màu, đợt, số đôi theo 7 size (thùng tự tính ROUNDUP ÷ 6); **sửa / xoá đơn ngay trên bảng** (xem mục *Sửa đơn đặt hàng ngay trên màn hình OMS*)
- **Nhập kho**: nút *Nhập kho mới* — chọn chỉ thị → hệ thống tự đối chiếu SL đặt / đã nhập / còn thiếu theo size → nhập số lượng lần này
- **Lệnh giao hàng**: nút *Tạo lệnh giao hàng* (xem bên dưới)

**Export file mẫu & Import theo mẫu** (CSV UTF-8, mở được bằng Excel):
- `MAU_IMPORT_DON_DAT_HANG.csv` — 9 cột như sheet Data gốc
- `MAU_IMPORT_NHAP_KHO.csv` — chỉ cần Ngày NK, Đơn hàng, Size, Số đôi (quốc gia/PO/màu **tự mapping** từ đơn hàng)
- `MAU_IMPORT_PHIEU_XUAT_KHO.csv` — Số phiếu, Ngày, Chỉ thị, Size, SL thực xuất
- `MAU_IMPORT_PACKING_LIST_CLP.xlsx` / `.csv` **(v5.0)** — packing list theo layout sheet CLP của khách (kèm sheet *Hướng dẫn*), có ví dụ thùng nguyên · thùng lẻ · **thùng MIX size**
- Import có **kiểm tra lỗi từng dòng** (sai size, chỉ thị không tồn tại, vượt tồn khả dụng…) và **xem trước** trước khi áp dụng
- Export dữ liệu hiện tại ra CSV ở từng màn hình

## ✏️ SỬA ĐƠN ĐẶT HÀNG NGAY TRÊN MÀN HÌNH OMS (v4.8 — MỚI)

Trước đây màn hình **Đơn đặt hàng · OMS** chỉ *thêm / import / xoá dòng bổ sung*; dữ liệu 95 đơn gốc từ Excel không sửa được.
Từ v4.8, **mọi đơn hàng đều sửa được ngay tại màn hình OMS** — kể cả đơn Excel gốc — và mọi thay đổi đều có nhật ký, khôi phục được.

### 3 cách sửa
| Cách | Ở đâu | Sửa được gì |
|---|---|---|
| **✎ Sửa nhanh tại chỗ** | Tab *Chi tiết từng dòng size* → cột **Sửa nhanh** | Số đôi của đúng 1 size — ô nhập hiện ngay trên dòng, số thùng tự tính lại, gõ lý do rồi **Enter** là xong (Esc để huỷ) |
| **📋 Sửa cả đơn** | Tab *Theo đơn hàng* → cột **Thao tác** → nút **Sửa** | ① Thông tin chung: ngày xuất KD, quốc gia, PO, mã màu, đợt · ② Toàn bộ ma trận size UK 3–UK 9 (bảng đối chiếu SL đặt / đã nhập kho / đã xuất kho từng size) |
| **Trong modal chi tiết đơn** | Bấm vào 1 dòng đơn hàng | Nút *Sửa đơn hàng · Nhật ký chỉnh sửa · Xoá đơn* |

### Ràng buộc nghiệp vụ (bảo vệ số liệu N-X-T)
- ⛔ **Chặn** hạ SL đặt xuống thấp hơn **SL đã xuất kho** của size đó → phải huỷ phiếu xuất kho trước
- ⛔ **Chặn** xoá đơn đã có phát sinh xuất kho
- ⚠ **Cảnh báo** (vẫn cho lưu) khi SL đặt mới thấp hơn SL đã nhập kho → hiển thị ngay trong modal khi đang gõ
- ⚠ **Bắt buộc nhập lý do** cho mọi thao tác sửa / xoá
- Mã đơn hàng là **khoá dữ liệu** → không sửa được (muốn đổi mã: xoá đơn cũ + thêm đơn mới)

### Nhật ký & khôi phục
- Mỗi đơn có nhật ký đầy đủ: **lần sửa · thời điểm · người sửa · loại thao tác · ma trận size trước/sau · thông tin chung sau · lý do**
- **↺ Khôi phục đơn về gốc** (từng đơn) hoặc **↺ Khôi phục toàn bộ đơn về gốc** (nút trên thanh công cụ OMS)
- Nhãn **“đã sửa n×”** hiện ngay cạnh mã đơn để biết đơn nào đã bị thay đổi
- Đơn đã xoá chỉ bị **ẩn** (không mất) — khôi phục lại bất cứ lúc nào; nếu import/thêm lại đúng mã đơn đã xoá, hệ thống **tự gỡ trạng thái xoá** và báo rõ
- Toàn bộ chỉnh sửa lưu tại khoá `orderEdits` trong `data/tvs-data.json` → **đồng bộ GitHub** như mọi dữ liệu khác, xem lại lịch sử trong tab *Commits*
- Người **chỉ xem** không thấy cột Thao tác / Sửa nhanh (ẩn hoàn toàn qua lớp `need-edit`)

Số liệu N-X-T, tồn kho, kế hoạch xuất TMS, bảng điều khiển và trợ lý AI **tự tính lại tức thì** sau mỗi lần sửa.

## 📊 BÁO CÁO N-X-T THEO KỲ + XUẤT FILE EXCEL (v4.9 — MỚI)

Ngay tại màn hình **Tồn kho · N-X-T** (cuối trang) có khối **“Báo cáo N-X-T theo kỳ — xuất Excel”**:

| Nút | Tác dụng |
|---|---|
| **Từ ngày / Đến ngày** | Chọn kỳ báo cáo bất kỳ · kèm nút nhanh **Tháng này · Quý này · Toàn bộ** |
| **Hiển thị hàng ngang theo size** | 1 dòng = 1 đơn hàng · 4 khối cột **Tồn đầu kỳ · Nhập · Xuất · Tồn cuối kỳ**, mỗi khối trải UK 3→UK 9 + cột Cộng |
| **Hiển thị size theo dòng** | 1 dòng = 1 đơn × 1 size, các cột SL đặt · Tồn đầu · Nhập · Xuất · **Ngày thực xuất** · Tồn cuối |
| **Hiện cả đơn không phát sinh** | In đủ 95 đơn (kể cả đơn chưa nhập/xuất trong kỳ) thay vì chỉ đơn có biến động |
| **Export Excel (.xlsx)** | Tải file Excel đúng bảng đang xem |

**Công thức chuẩn kế toán kho** (tính theo từng đơn × size):
- Tồn đầu kỳ = nhập kho **trước** “từ ngày” − xuất kho **trước** “từ ngày”
- Nhập trong kỳ = dòng nhập kho có Ngày NK trong kỳ
- Xuất trong kỳ = phiếu xuất kho **đã xác nhận** có Ngày thực xuất trong kỳ (dòng MIX SIZE được phân bổ đúng từng size)
- **Tồn cuối kỳ = Tồn đầu kỳ + Nhập − Xuất**

**Cột “Ngày thực xuất” (v4.9.1)** — chỉ có ở kiểu **size theo dòng** (cả trên màn hình lẫn file Excel):
- Nạp trực tiếp từ ô *Ngày thực xuất* của phiếu xuất kho bên **Lệnh giao hàng · PXK**
- Chỉ tính **phiếu đã xác nhận xuất kho**; phiếu còn nháp không hiển thị
- Một size xuất làm nhiều lần → liệt kê đủ các ngày (`25/07/2026 · 03/08/2026`) kèm nhãn *n lần*; di chuột vào ô để xem từng phiếu và số đôi
- Dòng phiếu **MIX SIZE** được phân bổ đúng ngày cho từng size
- Kiểu *size hàng ngang* giữ nguyên, không thêm cột này

**File Excel xuất ra gồm 3 sheet:**
1. `N-X-T size ngang` hoặc `N-X-T size theo dong` — đúng kiểu đang xem, có tiêu đề công ty/kỳ/người lập, gộp ô, cố định dòng tiêu đề, định dạng số `#,##0`
2. `Tong hop theo size` — cộng dồn toàn bộ đơn theo UK 3→UK 9
3. `Nhat ky bien dong` — liệt kê từng lượt nhập/xuất trong kỳ kèm số chứng từ (đối chiếu kiểm kê)

Tên file tự đặt: `BAO_CAO_N-X-T_20260716_20260722_SIZE-NGANG.xlsx`.
Bộ ghi Excel nằm tại `assets/js/xlsx-write.js` — **thuần JavaScript, không thư viện ngoài, không CDN**, nên vẫn chạy offline đúng tinh thần hệ thống.

## 🧩 SỔ XUỐNG / THU GỌN CÁC KHỐI (v4.10 — MỚI)

Để màn hình không bị rối khi vừa truy cập:
- **Vào màn hình nào cũng chỉ thấy thanh tiêu đề từng khối + KPI tổng quan + thanh công cụ.** Nội dung chi tiết (bảng, biểu đồ, timeline) được **thu gọn sẵn**.
- Bấm vào **tiêu đề khối** (hoặc mũi tên ▾) để **xổ nội dung** ra; bấm lại để thu gọn.
- Nút **“Mở tất cả / Thu gọn tất cả”** trên thanh tiêu đề (topbar) mở/gập toàn bộ khối của màn hình hiện tại.
- Trạng thái mở/gập của **từng khối trên từng màn hình được ghi nhớ** cho lần mở sau.
- Áp dụng cho mọi màn hình (Bảng điều khiển, Nhập kho, Tồn kho, Lệnh giao hàng, Kế hoạch xuất, Kiến trúc, Trợ lý AI). Các khối KPI tổng quan và thanh nút công cụ luôn hiện, không bị gập.

Cơ chế nằm ở `assets/js/collapsible.js` — tự nhận diện mọi khối có tiêu đề, không phải sửa từng màn hình.

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

## 📦 Packing List (CLP) — nguồn tính số thùng (v5.0 — cập nhật)

| Đợt | File gốc (sheet CLP) | Chỉ thị | Số đôi | Số thùng | Nhóm thùng | Nhóm MIX |
|---|---|---|---|---|---|---|
| Đợt 1 | `260720_ADIDAS RAINBOOT - ĐƠN HÀNG XUỐNG LẦN 1` | 34 | 12.601 | 2.646 | 336 | 17 |
| Đợt 2 | `260820_ADIDAS RAINBOOT - ĐƠN HÀNG XUỐNG LẦN 2` | 50 | 24.373 | 4.303 | 477 | 26 |
| Đợt 3 | `260825_ADIDAS RAINBOOT - ĐƠN HÀNG XUỐNG LẦN 3` | 11 | 3.053 | 629 | 85 | 2 |
| **Tổng** | nhúng tại `assets/js/data-packing.js` | **95** | **40.027** | **7.578** | **898** | **45** |

- Đối chiếu **khớp 100%** số đôi với đơn đặt hàng (`TVS_ORDERS`) theo **từng chỉ thị × từng size**; dãy số thùng `từ → đến` liên tục `1..tổng thùng` cho mọi chỉ thị
- Cấu trúc dữ liệu (schema) của đợt 2 & 3 **giữ nguyên y hệt đợt 1**: `{po, col, ctry, name, cust, wh, gender, totalPrs, totalCtn, groups[{sizes, prs, perCtn, ctn, from, to, box, mix}]}`
- Đơn chưa có packing → tự dùng quy cách chuẩn 6 đôi/thùng (đánh dấu `*` trên phiếu xuất kho)
- **Đợt 4, 5, 6… KHÔNG cần sửa code**: dùng màn hình **Packing List · CLP → Import packing list** (xem mục dưới)

## 📥 IMPORT PACKING LIST THEO MẪU — ĐỢT 4, 5, 6… (v5.0 — MỚI)

Màn hình mới **“Packing List · CLP”** trên sidebar (và nút **Import packing list** ngay trong màn hình *Lệnh giao hàng · PXK*):

| Khối | Nội dung |
|---|---|
| **6 KPI** | Chỉ thị có packing · Tổng số đôi (PL) · Tổng thùng carton · Nhóm MIX SIZE · Chỉ thị chưa có packing · Đối chiếu đơn đặt hàng |
| **Packing list theo đợt đặt hàng** | Từng đợt: số chỉ thị · đôi · thùng · nhóm thùng · nhóm MIX · nguồn (gốc / import) · kết quả đối chiếu |
| **Chi tiết theo chỉ thị** | Lọc theo đợt / nguồn / tìm kiếm; bấm 1 dòng → xem **toàn bộ nhóm thùng** (thùng số #từ–đến, MIX, mã hộp) + **bảng đối chiếu size** packing ↔ SL đặt |
| **Chỉ thị chưa có packing list** | Danh sách đơn còn thiếu packing (đang tạm tính 6 đôi/thùng) |
| **Nhật ký import** | Ai import · lúc nào · file/sheet nào · thêm mới / ghi đè / bỏ qua · lý do |

**Cách import (2 phút):**
1. Bấm **File mẫu (.xlsx)** hoặc **File mẫu (.csv)** → mở bằng Excel, điền theo đúng cột (hoặc dùng **thẳng file CLP gốc của khách adidas**, không cần sửa gì)
2. Bấm **Import packing list** → chọn file `.xlsx` (hệ thống **tự tìm sheet `CLP`**) hoặc `.csv`
3. Hệ thống **xem trước & đối chiếu**: số chỉ thị · số đôi · số thùng · số nhóm MIX · so sánh **từng size** với đơn đặt hàng (OMS) · cảnh báo dòng lỗi
4. Chỉ thị **đã có packing** hiện cảnh báo *“cần tích ghi đè”* — bạn tự **tích chọn** từng chỉ thị muốn ghi đè (không tích = giữ nguyên số liệu cũ)
5. Nhập **lý do** (bắt buộc) → **Lưu** → phiếu xuất kho dùng ngay packing mới; dữ liệu tự **commit `data/tvs-data.json`** lên GitHub

**Quy tắc đọc file (đúng như file gốc của khách):**
- 1 dòng = 1 nhóm thùng: `SIZE · Tổng số đôi · Số đôi/thùng · Số thùng · Số thùng từ → đến · Mã hộp`
- **Thùng MIX SIZE**: dòng đầu ghi `Số thùng = 1` + `Số thùng từ = đến`; các size còn lại **cùng thùng** để **trống** 3 cột (Số thùng, từ, đến) — hệ thống tự gộp thành 1 thùng MIX
- Dòng **TỔNG** của chỉ thị: để trống `SIZE`, ghi tổng số đôi & tổng số thùng → dùng để đối chiếu
- **Quốc gia / Đợt / Ngày xuất KD không cần ghi** — tự mapping từ đơn đặt hàng theo *Mã chỉ thị*
- Nhận mọi biến thể tên cột (`Mã chỉ thị` / `MÃ ĐƠN`, `Art#` / `Hình thể`, `Tổng số đôi` / `Số lượng`…) — nhận diện cột theo tên, không phụ thuộc vị trí

**Thao tác khác:** Export packing hiện hành ra `.xlsx` (2 sheet: `CLP` re-import được + `Tong hop`) hoặc `.csv` · Export 1 chỉ thị · **Xoá bản import** (tự khôi phục về packing gốc nếu có) · Xoá toàn bộ bản import. Packing list gốc đợt 1–3 **không xoá được trên web** (bảo vệ dữ liệu nguồn) — muốn thay số liệu thì import file mới và chọn **ghi đè**.

> Người **chỉ xem** vẫn xem được toàn bộ packing list nhưng **không thấy** nút Import / Xoá (lớp `need-edit`).

## 📥 Import nhập kho trực tiếp từ Excel (.xlsx)

- Màn hình Nhập kho nhận **đúng file mẫu `chi tiet nhap kho theo ngay.xlsx`** (1 dòng = 1 ngày × 1 chỉ thị, cột size 3→10) — import phát là hệ thống **tự unpivot + mapping** PO/mã hàng/màu/SL đặt/đợt/ngày xuất KD từ đơn hàng, có xem trước 2 bảng (dạng file ↔ dạng hệ thống) và cảnh báo trùng lặp
- Đọc .xlsx **không cần thư viện ngoài** nhờ `assets/js/xlsx-lite.js` (dùng DecompressionStream của trình duyệt); vẫn nhận .csv theo mẫu
- Màn hình có thêm **“Ma trận nhập kho theo ngày”** hiển thị dữ liệu đúng định dạng file mẫu

## 💾 Lưu trữ dữ liệu

- Dữ liệu Excel gốc là **bất biến** (nhúng trong `data.js`)
- Dữ liệu nhập tay / import / phiếu xuất kho lưu trong **localStorage của trình duyệt** — tự phục hồi khi mở lại
- Nút **↺ Khôi phục gốc** (chân sidebar) xoá toàn bộ dữ liệu bổ sung, quay về 100% Excel gốc

### 🔓 Dữ liệu gốc nhập kho — fix cứng nhưng SỬA ĐƯỢC (v4.5)
Dữ liệu nhập kho gốc được **fix cứng** trong `assets/js/data.js`, nhưng người dùng nhập liệu **toàn quyền thay đổi** ngay trên web (mọi thao tác đều ghi nhật ký người sửa / lý do):
- **Sửa / Xoá từng dòng** ma trận nhập kho (kể cả dòng gốc) — xem mục Ma trận nhập kho theo ngày
- **Bỏ dùng dữ liệu gốc** → ẩn toàn bộ số liệu gốc, chỉ dùng dữ liệu bạn nhập/import; **Dùng lại** bất cứ lúc nào
- **↺ Khôi phục gốc ban đầu** → về đúng bộ dữ liệu nguồn, xoá mọi dòng thêm & mọi chỉnh sửa
- **Xoá sạch nhập kho** → dọn trắng để nạp bộ dữ liệu mới hoàn toàn từ file
- Khi **Import**, chọn 1 trong 2 chế độ: **Thêm vào** dữ liệu hiện có, hoặc **Thay thế toàn bộ** (xoá sạch rồi nạp file làm dữ liệu duy nhất)
- ✅ Đã sửa lỗi: trước đây nếu xoá một dòng rồi import lại đúng ngày + chỉ thị đó thì dữ liệu mới **bị ẩn** (tưởng như không import được). Nay hệ thống tự gỡ trạng thái đã xoá/đã sửa của dòng đó và thông báo rõ.
- Lưu ý: nếu mở qua môi trường nhúng chặn lưu trữ, hệ thống chạy ở *chế độ demo* (có cảnh báo) — bản .zip mở trên máy thật lưu bình thường

## 🗂 Cấu trúc dự án

```
TVS-ADIDAS-WebSystem/
├── index.html                  # Khung SPA (sidebar + topbar + router)
├── TVS-ADIDAS-1FILE.html       # ★ Bản gộp 1 file (v5.0) — sinh bởi tools/build-1file.py
├── README.md
├── data/tvs-data.json          # Dữ liệu chung lưu trên GitHub (đơn/nhập/xuất/packing import)
├── tools/
│   └── build-1file.py          # ★ (v5.0) Sinh lại TVS-ADIDAS-1FILE.html từ index.html + assets/
└── assets/
    ├── css/style.css           # Toàn bộ thiết kế (offline, không CDN) + form + phiếu in
    ├── img/logo.svg
    └── js/
        ├── data.js             # ★ DỮ LIỆU THẬT trích từ Excel (549 + 11 dòng) — bất biến
        ├── data-packing.js     # ★ PACKING LIST (CLP) 3 ĐỢT — 95 chỉ thị · 40.027 đôi · 7.578 thùng
        ├── xlsx-lite.js        # Đọc .xlsx thuần JS (v5.0: đọc được MỌI sheet — tự chọn sheet CLP)
        ├── xlsx-write.js       # ★ Ghi file .xlsx thuần JS (v4.9) — báo cáo N-X-T & export packing
        ├── nxt-report.js       # ★ Báo cáo N-X-T theo kỳ + export Excel (v4.9)
        ├── collapsible.js      # ★ Sổ xuống / thu gọn khối trên mọi màn hình (v4.10)
        ├── store.js            # ★ Lớp dữ liệu động: localStorage, CSV/XLSX mẫu–import–export, phiếu XK,
        │                       #   IMPORT PACKING LIST + nhật ký + ghi đè có xác nhận (v5.0)
        ├── utils.js            # Lõi nghiệp vụ: N-X-T, tồn khả dụng, % xuất đúng hạn (U.rebuild)
        ├── charts.js           # Thư viện biểu đồ SVG thuần
        ├── app.js              # Router #/, icon, modal, toast, chọn file (.xlsx nhiều sheet), in phiếu
        └── views/
            ├── dashboard.js    # Bảng điều khiển
            ├── orders.js       # OMS — Đơn đặt hàng + nhập liệu/import/export + SỬA/XOÁ/NHẬT KÝ (v4.8)
            ├── warehouse.js    # WMS — Nhập kho + nhập liệu/import/export
            ├── delivery.js     # ★ PXK — Lệnh giao hàng, phiếu 03/XKNB, % đúng hạn + import packing (v5.0)
            ├── packing.js      # ★ (v5.0) PACKING LIST · CLP — xem theo đợt, import theo mẫu, export, nhật ký
            ├── inventory.js    # N-X-T — Tồn kho (xuất thực từ phiếu XK)
            ├── shipping.js     # TMS — Kế hoạch xuất
            ├── architecture.js # Kiến trúc hệ thống (2 hình tham chiếu)
            └── assistant.js    # Trợ lý AI (Agentic RAG mô phỏng)
```

### 🔧 Sinh lại bản gộp 1 file (sau khi sửa code)

```bash
cd TVS-ADIDAS-WebSystem
python3 tools/build-1file.py --version v5.0
# → TVS-ADIDAS-1FILE.html (gộp 1 CSS + 22 JS, giữ đúng thứ tự nạp script)
```

## 🔄 Cập nhật dữ liệu kỳ sau

| Loại dữ liệu | Cách cập nhật |
|---|---|
| **Đơn đặt hàng** (đợt mới) | Màn hình *Đơn đặt hàng · OMS* → **Import** file `.xlsx/.csv` (size hàng ngang hoặc hàng dọc) — hoặc tái sinh `assets/js/data.js` khi có file Excel gốc mới (giữ nguyên định dạng `TVS_META / TVS_ORDERS / TVS_RECEIPTS`) |
| **Nhập kho theo ngày** | Màn hình *Nhập kho · WMS* → **Import** đúng file mẫu `chi tiet nhap kho theo ngay.xlsx` |
| **Packing List (CLP) đợt 4, 5, 6…** | Màn hình *Packing List · CLP* → **Import packing list** (file CLP gốc `.xlsx` hoặc `.csv` theo mẫu) — **không cần sửa code** |
| **Phiếu xuất kho** | Màn hình *Lệnh giao hàng · PXK* → Tạo lệnh / Import phiếu |

Toàn bộ trang, biểu đồ, cảnh báo, N-X-T, kế hoạch xuất TMS và trợ lý AI **tự tính lại tức thì** sau mỗi lần cập nhật; dữ liệu tự đồng bộ GitHub (`data/tvs-data.json`).

---
© 2026 TVS — Công ty TNHH Giày Tuấn Việt · Xây dựng cho chương trình adidas Rubber Boots NVQ89 · **phiên bản v5.0**

> **Mẹo:** File `TVS-ADIDAS-1FILE.html` là bản gộp toàn bộ hệ thống vào 1 file duy nhất — tiện gửi qua Zalo/Email, mở là chạy. Bản chuẩn nhiều file vẫn là `index.html`.
