# Quyết định thiết kế hiện hành

Cập nhật theo yêu cầu 17/10/2026; thay thế chính sách chỉ xem phiếu của mình ở v2.

- Một đăng nhập, tự điều hướng. Không cấp quyền từ lựa chọn giao diện hoặc kind của client.
- Tài khoản quản trị công ty dùng chính tbusers và liên kết trạm của công ty. Cấu hình server chỉ định đúng ID tài khoản và trạm; không nâng mọi vai trò Admin của desktop thành Admin toàn hệ thống.
- Nguồn danh tính và vai trò giao diện là hai thuộc tính độc lập: một người dùng tbusers có thể là quản trị toàn hệ thống nhưng phiên vẫn xác thực từ tbusers.
- Mọi tài khoản trạm xem cùng dữ liệu toàn trạm. Điều kiện trạm áp ở server cho danh sách, chi tiết và thống kê. Không cập nhật hàng loạt mobile_user_access.
- Logo gốc ở mobile/assets/logo.png; màu chủ đạo xanh #298E40, xanh đậm #185C2C và vàng #DFE62D.
- Trang tài khoản chỉ có thông tin trạm / gọi điện và đăng xuất.
- Tìm kiếm debounce; bộ lọc nâng cao trong sheet; chọn ngày bằng lịch; danh sách cân tải thêm khi cuộn, loại trùng ID giữa các trang.
- Thanh tab có khoảng an toàn dưới cùng, ẩn khi bàn phím mở. Đăng nhập hỗ trợ hiện/ẩn mật khẩu và nút Go trên bàn phím.
- Không áp thêm migration, không đổi mật khẩu / cấu trúc legacy trong lần cập nhật này.

## Doanh thu và khách hàng

Doanh thu lấy từ price_total, cùng trường Thành Tiền của phần mềm máy tính, không tính lại price * net_weight và không suy diễn là tiền đã thu.
Khách hàng đếm theo snapshot trong phiếu (mã, fallback tên). Danh mục tbcustomer không tham gia.
Các chỉ tiêu luôn dùng chung phạm vi dữ liệu như danh sách cân.

## Trước khi phát hành

- Xác minh đúng tài khoản / trạm công ty và cấu hình server.
- Kiểm thử thiết bị Android/iOS thật, bàn phím, mất mạng và cử chỉ Back.
- Giữ cấu hình API HTTPS theo môi trường; không đóng gói thông tin DB vào mobile.
- Nâng SDK / rà dependency hiện hữu trong một đợt riêng.
- Đối chiếu dữ liệu thực tế weight_2=0 và NULL, mã khách trùng tên và quy tắc thu phí.
- App không sửa / xóa phiếu và không thay thế phần mềm cân.

## Đề xuất tiếp theo

1. Cảnh báo phiếu chờ cân lần 2 lâu, dữ liệu trạm ngừng cập nhật.
2. Biểu đồ doanh thu theo ngày, hàng hóa, khách và biển số.
3. Ảnh camera tải khi mở chi tiết.
4. Hồ sơ thiết bị / lịch bảo trì / hỗ trợ từng trạm.
5. Phân trang cursor và đo truy vấn trên dữ liệu lớn trước khi bổ sung index.

