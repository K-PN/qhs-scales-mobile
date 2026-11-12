# QHS Scales Mobile

Ứng dụng theo dõi trạm cân của Cân điện tử Quốc Hưng.

## Phiên bản hiện tại

- Một màn hình đăng nhập bằng tên tài khoản / mật khẩu. Server xác định giao diện quản trị hay trạm.
- Tài khoản trạm lấy từ tbusers, trạm từ tbusers_group, phiếu từ tbweight. Không dùng tbcustomer.
- Mọi tài khoản được xem tất cả phiếu enable=1 thuộc trạm mình. Không lọc theo người tạo, không cần cấp quyền view_all.
- Quản trị toàn hệ thống là tài khoản công ty được khai báo cụ thể ở backend; vai trò Admin của trạm khác không tự có quyền này.
- Tài khoản quản trị app_users của bản cũ vẫn đăng nhập được qua cùng màn hình.
- Logo Quốc Hưng, màu xanh lá / vàng, bộ lọc trong sheet, lịch chọn ngày, tìm kiếm tự động và tải thêm khi cuộn.
- Tổng quan: doanh thu, lượt cân, khối lượng, khách hàng, biển số và phiếu chờ lần 2.
- Tab tài khoản: thông tin trạm và đăng xuất. Không có các ghi chú giải thích kỹ thuật.
- App không ghi / sửa / xóa phiếu cân và không xuất Excel/PDF.

## Chạy local

Cần Node.js 20+, npm, cơ sở dữ liệu MySQL/MariaDB tương thích phần mềm máy tính.

    npm install
    npm run backend:dev

Terminal thứ hai:

    npm run mobile:web

Chạy điện thoại bằng Expo Go:

    npm run mobile:start

Điền kết nối MySQL và JWT_ACCESS_SECRET trong backend/.env (tham khảo .env.example).
Đặt EXPO_PUBLIC_API_URL trong mobile/.env là địa chỉ API; điện thoại thật dùng IP LAN, bản phát hành dùng HTTPS.
Backend mặc định 4010, Expo web thường 8081.

Lưu ý: backend chạy local có thể trỏ DB từ xa. Kiểm tra đích kết nối trước khi quản trị dữ liệu.

## Tài khoản quản trị công ty

Khai báo backend/.env theo ID đã xác minh:

    QHS_COMPANY_STATION_ID=<ID trạm công ty>
    QHS_COMPANY_ADMIN_USER_IDS=<ID tài khoản tbusers được phép quản trị>

Chỉ khi cả ID tài khoản và ID trạm khớp, tài khoản đó mới có quyền toàn hệ thống.
Không suy diễn quyền nhà cung cấp từ tên đăng nhập admin, tên vai trò, hoặc dữ liệu do client gửi.
Cấu hình này không đổi thông tin tài khoản hay phân quyền của phần mềm cân máy tính.
Khởi động lại backend sau khi thay cấu hình .env. Phiên cũ cần đăng nhập lại sau khi đổi chính sách quyền.

Nếu trùng tên tài khoản giữa các trạm, app sẽ yêu cầu thêm mã trạm khi đăng nhập.
Mật khẩu tài khoản máy tính được xác minh bằng thuật toán legacy hiện có, không chuyển đổi mật khẩu hàng loạt.

## Schema

Chạy theo thứ tự trên cơ sở dữ liệu đích đã duyệt:
1. backend/database/auth-migration.sql
2. backend/database/mobile-v2.sql

Các migration chỉ thêm bảng. Bản cập nhật giao diện / chính sách toàn trạm không yêu cầu migration mới.
mobile_user_access.view_all được giữ để tương thích dữ liệu cũ, không còn điều khiển phạm vi xem.
Trạng thái / mật khẩu / vai trò quản lý trong Admin vẫn dùng chung với phần mềm cân máy tính.

## Kiểm tra

    npm run backend:build
    npm --workspace mobile run typecheck
    npm run test:access

Kiểm tra tích hợp với MariaDB riêng 127.0.0.1:3317 và dữ liệu giả:

    npm run test:integration

scripts/verify-v3.cjs không đọc backend/.env, luôn tạo database mới có tiền tố qhs_mobile_test_.
Để chạy trình duyệt, đặt PLAYWRIGHT_PATH tới module playwright-core và chạy Expo web cổng 8088.
Bằng chứng phiên bản mới nằm ở artifacts/v3.

Xem docs/API.md, docs/DEVELOPMENT.md và docs/VERIFICATION.md.

Liên kết Chính sách quyền riêng tư ở Đăng nhập và Tài khoản: https://www.doluongquochung.com/privacy-policies/qhs-scales (cấu hình tại `mobile/lib/links.ts`). Bản nội dung đi kèm app vẫn ở `/privacy-policy`. Chạy `npm run privacy:export` để xuất HTML cùng nội dung; xem `website/privacy-policy/README.md`. Giải thích và lưu ý dọn thư mục đầu ra: `docs/ARTIFACTS.md`.

