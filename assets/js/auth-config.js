/* ═══════════════════════════════════════════════════════════════════
   auth-config.js — CẤU HÌNH TÀI KHOẢN & PHÂN QUYỀN
   • 3 tài khoản NHẬP LIỆU (role "editor") — được thêm/sửa/xoá/xuất kho
   • Không đăng nhập (hoặc sai) = CHỈ XEM (viewer)
   Mật khẩu lưu dạng SHA-256. Đổi mật khẩu: chạy lệnh sau rồi thay hash:
     python3 -c "import hashlib;print(hashlib.sha256('MẬT_KHẨU_MỚI'.encode()).hexdigest())"
   Mật khẩu mặc định ban đầu:
     thukho / thukho@2026 · kinhdoanh / kinhdoanh@2026 · quanly / quanly@2026
   ⚠ Hãy đổi cả 3 mật khẩu sau lần đăng nhập đầu tiên!
   Lưu ý bảo mật: lớp mật khẩu chỉ là lớp giao diện; quyền GHI THẬT SỰ
   được bảo vệ bởi GitHub Token (chỉ ai có token mới ghi được dữ liệu).
   ═══════════════════════════════════════════════════════════════════ */
window.TVS_AUTH_CONFIG = {
  users: [
    { u: "thukho",    name: "Thủ kho",        role: "editor", sha256: "5f8ccde9659472d2555de186ad50f0024b762e7cb476b7c31d0286e5f363d430" },
    { u: "kinhdoanh", name: "Phòng NVKD",     role: "editor", sha256: "a1d484ec6652483e1eb4cd3c7dceed24d11294bfda0549e573019d52c58cd983" },
    { u: "quanly",    name: "Quản lý kho",    role: "editor", sha256: "82f646f7e21a3a430deadaa1f2c8361dc7c630837c5fbed2d9276787a1312f5b" },
  ],
};

/* Cấu hình kho dữ liệu GitHub (dùng cho đồng bộ online) */
window.TVS_GH = {
  owner: "mrbit4578",
  repo: "QL-KHOTP-TVS-ADIDAS",
  branch: "main",
  dataPath: "data/tvs-data.json",
};
