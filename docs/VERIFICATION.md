# Kiểm tra hiện hành

## Header ghim và bố cục chính sách trên Mobile — 23/10/2026

- Đã xuất lại website/privacy-policy/index.html: header sticky với Quay lại; nội dung 17 px, line-height 1.85; mục lục Mobile dạng thu gọn. Nội dung chính sách giữ nguyên.
- Back dùng history.back khi có lịch sử; nếu truy cập trực tiếp không có lịch sử, liên kết dự phòng về website công ty. Mục lục cuộn tại chỗ, không thêm bước lịch sử khiến Back mắc lại trong trang.
- Liên kết chính sách từ app web đổi sang cùng tab. Bản nội dung đi kèm app cũng có nút Quay lại trên header và chữ/giãn dòng lớn hơn.
- Chromium local: 18 kiểm tra đạt tại 320×568, 390×844, 1440×1000, gồm không tràn ngang, mục lục thu gọn, header vẫn trên cùng sau cuộn, tiêu đề mục không bị che, bấm Back về đúng trang trước và không lỗi JavaScript. TypeScript mobile đạt.
- Người dùng đã cung cấp nguồn URL tại `../qhs-system/app/privacy-policies/qhs-scales`. Đã đồng bộ index.html mới, so khớp SHA256 với bản đã kiểm tra, giữ nguyên route.ts. Thử GET handler thực tế trả 200, text/html, nội dung đúng file có sticky header / Back / mục lục Mobile. Các phần nội dung pháp lý của bản cũ và mới giống nhau. Chỉ index.html trong thư mục đích thay đổi.
- Chưa triển khai lại qhs-system lên production hoặc thử trên iPhone thật; trang công khai chỉ thay đổi sau khi triển khai.

## Chính sách quyền riêng tư — 21/10/2026

- Đã thêm `/privacy-policy` công khai trong app, liên kết ở màn hình Đăng nhập và Tài khoản. Nội dung dùng chung với hai bản HTML xuất bằng `npm run privacy:export`.
- TypeScript mobile đạt; API + Chrome 127/127 đạt trên database riêng qhs_mobile_test_1792577289692. Kiểm tra mở chính sách trước đăng nhập và từ tài khoản, liên kết email, quay lại đúng màn hình và không tràn ngang ở 320 px.
- HTML độc lập kiểm tra Chromium ở 320/390/1440 px: đủ 8 phần chính và liên hệ, không lỗi JavaScript/tràn ngang. Không thêm analytics hoặc thư viện bên ngoài vào trang tĩnh.
- File để đưa lên hosting/WordPress nằm ở website/privacy-policy; hướng dẫn trong README cùng thư mục. Chưa xuất bản trên website công ty, chưa xác minh URL chính sách công khai để khai App Store Connect.
- Chưa có thay đổi schema/database nghiệp vụ, chưa xây luồng tự động xóa tài khoản và chưa phát hành native.

## Khoảng ngày tổng quan và tìm kiếm thống kê — 21/10/2026

- Backend build / mobile TypeScript đạt; 15 kiểm tra quyền, bộ lọc, tìm kiếm, readiness và 5 kiểm tra xử lý phản hồi API đạt.
- API + Chrome: 123/123 đạt, MariaDB riêng 127.0.0.1:3317, database qhs_mobile_test_1792561055935. Không sửa schema / dữ liệu nghiệp vụ thực tế.
- Khoảng tùy chọn: nhập dd/mm/yyyy, chọn lịch, chặn ngày không tồn tại và đảo ngày; kiểm tra cửa sổ 320×380; đóng mà không áp dụng giữ kỳ cũ. Kỳ áp dụng chung cho tổng quan, biểu đồ và thống kê nhóm.
- API đối chiếu dữ liệu 00:00:00 đầu kỳ / 23:59:59 cuối kỳ / ngày sau kỳ; tổng khớp biểu đồ và thống kê nhóm. Biểu đồ gộp ngày, tháng hoặc năm theo độ dài kỳ.
- Tìm kiếm ba nhóm: có kết quả / không có / xóa từ khóa đạt; tìm tên cũ của khách vẫn giữ tổng của cả mã khách; tìm theo mã; không tìm nhầm trường của nhóm khác; ký tự wildcard được tìm theo nghĩa đen. Truy vấn có tham số và giữ giới hạn trạm.
- Chưa kiểm thử bàn phím trên iPhone/Android thật hoặc phát hành production/native.

## Sửa lỗi HTML thay JSON khi mở thống kê — 21/10/2026

- Backend local cổng 4010 đang chạy `node dist/server.js` từ trước khi API nhóm được thêm/build; tiến trình không tự nạp bản build mới. Đã build và khởi động lại đúng backend local. Không sửa schema hoặc dữ liệu nghiệp vụ.
- Trước sửa: route không tồn tại trả HTML 404 của Express. Sau sửa: JSON 404 với message; `/health` backend local trả 200.
- Mobile đọc phản hồi có kiểm tra: HTML 404, HTML 200 do sai địa chỉ API, HTML lỗi proxy, rate limit dạng text, JSON lỗi định dạng/null/array đều có thông báo phù hợp; không hiển thị lỗi `Unexpected token '<'`.
- Backend build và mobile TypeScript đạt; 14 kiểm tra quyền/readiness + 5 kiểm tra phản hồi API đạt.
- API + Chrome trên MariaDB riêng: 95/95 đạt, database qhs_mobile_test_1792560516471. Đã thử ba nhóm thống kê; giả lập HTML 404 trong trình duyệt, xác minh thông báo rồi bỏ giả lập và nhấn Thử lại, dữ liệu tải thành công.
- Kiểm tra API có xác thực và UI dùng dữ liệu giả trong DB riêng; không đăng nhập thay người dùng hoặc tạo/sửa phiếu trên DB thực tế. Chưa phát hành bản native/production.

## Menu dưới và thống kê nhóm — 21/10/2026

- Backend build và mobile TypeScript: đạt.
- Unit test quyền / bộ lọc thống kê / readiness: 14/14 đạt.
- Tích hợp API + Chrome: 91/91 đạt trên MariaDB riêng 127.0.0.1:3317, dữ liệu giả, database qhs_mobile_test_1792553784842.
- Thống kê khách hàng / hàng hóa / biển số: tổng thành tiền và số phiếu, giới hạn trạm, bộ lọc ngày, phân trang, mã khách trùng giữa trạm, tên khách trùng nhưng khác mã, trim/case và nhóm thiếu dữ liệu đều đạt.
- Trình duyệt: chỉ tải thống kê khi mở; chuyển ba nhóm và ẩn kết quả đạt; kiểm tra nhãn menu không vượt khung hoặc bị ellipsis ở 320×568, 390×844, 812×375, 1440×1000 cho cả quản trị và trạm. Không có lỗi JavaScript trong luồng đã kiểm tra.
- Ảnh bổ sung artifacts/v3/admin-tabs-320.png, station-tabs-320.png, grouped-statistics-mobile.png; kết quả máy artifacts/v3/verification.json.
- Không cần migration; không truy cập / sửa DB production. Chưa triển khai backend/frontend, build iOS hay thử iPhone thật.
- Đánh giá yêu cầu Apple và việc còn thiếu: docs/APP_STORE_REVIEW.md.

## Bằng chứng phiên trước — 17/10/2026

## Bản giao diện Quốc Hưng và chính sách toàn trạm

- Backend build và mobile TypeScript: đạt.
- Unit test quyền / dữ liệu đầu vào / readiness: 12/12 đạt.
- Tích hợp API và Chrome: 49/49 đạt, database riêng qhs_mobile_test_<timestamp> trên 127.0.0.1:3317, dữ liệu giả.
- Kiểm tra: đăng nhập tự nhận diện; tài khoản công ty quản trị toàn hệ thống; Admin trạm khác không được nâng quyền; tài khoản trạm xem phiếu của mọi người trong trạm; chặn phiếu trạm khác; doanh thu / số khách / số xe đúng fixture; refresh / revoke / stale write; tên đăng nhập trùng; quản trị tạo trạm / tài khoản.
- Giao diện kiểm tra ở 390×844, 320×568, 320×380 (khung nhìn thu hẹp), 1440×1000.
- Không có lỗi JavaScript trong luồng trình duyệt đã kiểm tra.
- Expo web export: đạt, artifacts/v3/web-export.
- Expo Android Hermes bundle: đạt, artifacts/v3/android-bundle. Đây chưa phải APK và chưa kiểm thử thiết bị thật.
- Ảnh: artifacts/v3/login-mobile.png, station-overview.png, weighings-mobile.png, detail-mobile.png, station-profile.png, admin-overview.png, admin-accounts-desktop.png.
- Báo cáo máy: artifacts/v3/verification.json.

## Cấu hình đang dùng tại máy phát triển

Người dùng xác nhận admin thuộc trạm 1.
backend/.env đã cấu hình QHS_COMPANY_STATION_ID=1 và QHS_COMPANY_ADMIN_USER_IDS=1.
Đã xác minh đọc danh tính từ DB đang cấu hình:
- tbusers ID 1: admin, trạm 1, quyền quản trị toàn hệ thống.
- tbusers ID 2: station, trạm 1, xem toàn trạm.
- tbusers ID 29: station, trạm 30; vai trò Admin desktop không cấp quyền toàn hệ thống.

API đang chạy cổng 4010: health 200, đăng nhập tự nhận diện tài khoản quản trị tương thích cũ 200, thống kê có revenue/customers và logout thành công.
Không thử đoán mật khẩu của các tài khoản trạm thực tế.

Ba bảng mobile v2 đã được thêm vào DB từ xa trong lần sửa đăng nhập trước, theo phê duyệt người dùng. Lần cập nhật này không thay đổi schema / dữ liệu tài khoản / dữ liệu cân; chỉ sửa mã và cấu hình quyền tại backend local.
Chưa triển khai production frontend/backend hay phát hành APK/iOS.

