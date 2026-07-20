/* ═══════════════════════════════════════════════════════════════════
   views/architecture.js — KIẾN TRÚC HỆ THỐNG
   Tái hiện 2 sơ đồ tham chiếu người dùng cung cấp:
   ① Warehouse Robotics Software (ERP ↔ WMS ↔ WCS/OMS/TMS)
   ② Top 5 RAG Architectures 2026 → thiết kế Trợ lý AI TVS
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.Views = window.Views || {};

  const arrow = `<div class="arch-link"><svg viewBox="0 0 20 26"><line x1="10" y1="1" x2="10" y2="19" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><polygon points="10,25 5,17 15,17" fill="currentColor"/></svg></div>`;

  window.Views.architecture = {
    title: "Kiến trúc hệ thống",
    render(root) {
      root.innerHTML = `
        <div class="card">
          <div class="card-h"><h3>① Sơ đồ tổng thể theo mô hình Warehouse Robotics Software</h3>
            <span class="sub">ánh xạ từ hình tham chiếu → các phân hệ thật của web TVS</span></div>
          <div class="card-b"><div class="arch">

            <div class="arch-node" style="max-width:520px;margin:0 auto;width:100%">
              <h4><span class="tag">ERP</span> Lớp kế hoạch doanh nghiệp — TVS</h4>
              <ul>
                <li><b>Orders</b> — đơn đặt hàng adidas (sheet Data · 95 đơn · 40.027 đôi)</li>
                <li><b>Inventory</b> — tổng hợp N-X-T thành phẩm NVQ89</li>
                <li><b>Finance / Procurement</b> — (phạm vi mở rộng giai đoạn 2)</li>
              </ul>
            </div>
            ${arrow}
            <div class="arch-flow">Order Data · Inventory & Status</div>

            <div class="arch-node hub">
              <h4><span class="tag" style="background:#ffffff22;color:#fff">WMS</span> LÕI HỆ THỐNG — QUẢN LÝ KHO THÀNH PHẨM RUBBER BOOTS</h4>
              <div class="arch-hub-grid">
                <div class="hub-mod">${App.icon("box", "hm-ico")}<div class="hm-t">Warehouse<br>Management<br><a href="#/warehouse" style="color:#8fb3ff">→ Nhập kho</a></div></div>
                <div class="hub-mod">${App.icon("layers", "hm-ico")}<div class="hm-t">Inventory<br>Tracking<br><a href="#/inventory" style="color:#8fb3ff">→ N-X-T</a></div></div>
                <div class="hub-mod">${App.icon("clip", "hm-ico")}<div class="hm-t">Order<br>Fulfillment<br><a href="#/orders" style="color:#8fb3ff">→ Đơn hàng</a></div></div>
                <div class="hub-mod">${App.icon("gauge", "hm-ico")}<div class="hm-t">Analytics &<br>Dashboard<br><a href="#/" style="color:#8fb3ff">→ Bảng điều khiển</a></div></div>
                <div class="hub-mod">${App.icon("bot", "hm-ico")}<div class="hm-t">AI<br>Orchestration<br><a href="#/assistant" style="color:#8fb3ff">→ Trợ lý AI</a></div></div>
              </div>
              <ul style="margin-top:12px">
                <li>Real-Time Inventory — tồn kho tính trực tiếp từ dữ liệu nhập/xuất thật</li>
                <li>Automated Picking / Fleet Optimization — lộ trình robot kho (giai đoạn 2)</li>
                <li>Warehouse Analytics — cảnh báo thiếu hàng theo mốc xuất KD</li>
              </ul>
            </div>

            ${arrow}
            <div class="arch-row r3">
              <div class="arch-node">
                <h4><span class="tag">WCS</span> Warehouse Control System</h4>
                <ul>
                  <li>Material Flow Control — dòng thành phẩm từ chuyền → đóng thùng (6 đôi/thùng)</li>
                  <li>Equipment Control — băng tải, xe nâng khu kho TVS</li>
                  <li>Real-Time Monitoring — nhật ký nhập kho từng ngày (ChitietNK)</li>
                </ul>
              </div>
              <div class="arch-node">
                <h4><span class="tag">OMS</span> Order Management System</h4>
                <ul>
                  <li>Order Processing — 549 dòng size từ khách adidas</li>
                  <li>Order Prioritization — ưu tiên theo "Ngày xuất KD" gần nhất</li>
                  <li>Fulfillment Management — đối chiếu thiếu/đủ từng size</li>
                </ul>
              </div>
              <div class="arch-node">
                <h4><span class="tag">TMS</span> Transport Management System</h4>
                <ul>
                  <li>Shipment Planning — 15 mốc xuất (25/07/2026 → 09/01/2027)</li>
                  <li>Carrier Management — booking container xuất khẩu</li>
                  <li>Delivery Tracking — theo "Ngày thực xuất" khi phát sinh</li>
                </ul>
              </div>
            </div>
            <div class="arch-flow">Material Flow Data · Equipment Signals — Order Data — Dispatch Data · Shipment Tracking</div>
          </div></div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>② Lớp AI — áp dụng "Top 5 RAG Architectures 2026" cho Trợ lý TVS</h3>
            <span class="sub">tri thức = dữ liệu N-X-T thật; truy xuất trước, trả lời sau</span></div>
          <div class="card-b">
            <div class="grid g-2" style="gap:12px">
              <div class="rag-card"><div class="rag-num">01</div><div>
                <h4>Hybrid RAG — Dense vectors meet sparse keywords</h4>
                <p>Kết hợp tìm theo từ khoá (mã đơn AE…, PO 09030…) và tìm theo ngữ nghĩa ("đơn đi Mỹ tháng 9").</p>
                <div class="use">→ Dùng cho ô tìm kiếm toàn cục của web TVS</div></div></div>
              <div class="rag-card"><div class="rag-num">02</div><div>
                <h4>GraphRAG — Answers live in the relationships</h4>
                <p>Đồ thị Quốc gia → Đơn hàng → PO → Màu → Size phản ánh đúng quan hệ dữ liệu 2 sheet Excel.</p>
                <div class="use">→ Nền tảng cho trang chi tiết đơn & đối chiếu N-X-T</div></div></div>
              <div class="rag-card"><div class="rag-num">03</div><div>
                <h4>Agentic RAG — Retrieval becomes a plan, not a step</h4>
                <p>Trợ lý lập kế hoạch: Planner → chọn công cụ (Tra đơn / Gộp số liệu / Lịch xuất) → tổng hợp trả lời.</p>
                <div class="use">→ Chính là cơ chế của Trợ lý AI TVS (xem tab Trợ lý AI)</div></div></div>
              <div class="rag-card"><div class="rag-num">04</div><div>
                <h4>Corrective RAG (CRAG) — Grade the retrieval before you trust it</h4>
                <p>Chấm điểm kết quả truy xuất; nếu mơ hồ thì viết lại truy vấn, nếu sai thì hỏi lại người dùng.</p>
                <div class="use">→ Trợ lý TVS xác nhận lại khi không tìm thấy mã đơn</div></div></div>
              <div class="rag-card" style="grid-column:1/-1"><div class="rag-num">05</div><div>
                <h4>Multimodal RAG — One index across text, images, and tables</h4>
                <p>Một chỉ mục chung cho chữ (ghi chú "UK 9 = 15"), bảng (549 dòng đơn hàng) và hình (ảnh thùng carton, tem size).
                Giai đoạn 2: quét tem thùng bằng camera để nhập kho tự động.</p>
                <div class="use">→ Lộ trình nâng cấp khi kết nối hệ thống camera kho</div></div></div>
            </div>
            <div class="note mt">Ghi chú: bản web tĩnh này mô phỏng luồng Agentic RAG ngay trên trình duyệt (không cần máy chủ) — toàn bộ "tri thức" là dữ liệu thật đã nhúng từ file Excel.</div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-h"><h3>③ Luồng dữ liệu thật của bản web này</h3></div>
          <div class="card-b">
            <div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Tầng</th><th>Thành phần</th><th>Nguồn dữ liệu thật</th><th>Vai trò</th></tr></thead>
              <tbody>
                <tr><td><b>Dữ liệu</b></td><td class="mono">assets/js/data.js</td><td>THEO DOI CHI TIET N-X-T ADIDAS.xlsm</td><td>549 dòng đơn hàng (Data) + 11 dòng nhập kho (ChitietNK) trích xuất nguyên trạng</td></tr>
                <tr><td><b>Nghiệp vụ</b></td><td class="mono">assets/js/utils.js</td><td>—</td><td>Gom 95 đơn, đối chiếu nhập ↔ đặt, tính N-X-T, thiếu/đủ, lịch xuất</td></tr>
                <tr><td><b>Trực quan</b></td><td class="mono">assets/js/charts.js</td><td>—</td><td>Biểu đồ SVG thuần: cột, thanh, tròn, đường (chạy offline)</td></tr>
                <tr><td><b>Giao diện</b></td><td class="mono">assets/js/views/*.js</td><td>—</td><td>7 phân hệ: Dashboard · OMS · WMS · N-X-T · TMS · Kiến trúc · Trợ lý AI</td></tr>
                <tr><td><b>Điều phối</b></td><td class="mono">assets/js/app.js</td><td>—</td><td>Định tuyến #/, tìm kiếm toàn cục, modal chi tiết đơn</td></tr>
              </tbody>
            </table></div>
          </div>
        </div>`;
    }
  };
})();
