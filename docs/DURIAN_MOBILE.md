# Theo dõi cân sầu riêng trên Quốc Hưng Scales

## Cấu hình trạm

Backend xác thực qua **tbusers** và lấy trạm từ **tbusers.idusergroup**. Admin đặt loại **Xe tải** hoặc **Sầu riêng** trong **Quản trị → Trạm cân**. Loại này được lưu trong **mobile_station_config** và áp dụng cho mọi tài khoản đang hoạt động của trạm. Trạm chưa phân loại mặc định là xe tải. Trạm 52 đã được đối chiếu là trạm thử sầu riêng.

Tài khoản sầu riêng dùng cùng tên đăng nhập và mật khẩu trên desktop và điện thoại. Vai trò trong **qhs_durian_user_access** dành cho máy cân Windows. Trên điện thoại, quyền xem sầu riêng đi theo trạm. Backend trả **stationType** và **permissions** ở các luồng đăng nhập, làm mới token và **/auth/me**. Phiên hiện tại của trạm sẽ cần đăng nhập lại sau khi admin đổi cấu hình trạm.

Cấu hình phát hành dùng duy nhất **can22456_canquochung** qua **DB_NAME**. Bỏ **DB2_NAME** khỏi môi trường production để App dùng một nguồn. Bản cài trỏ tới backend điện thoại qua **EXPO_PUBLIC_API_URL**. Dữ liệu xe tải hiện có tiếp tục được đọc từ **tbweight**.

## Cách đọc và tính số liệu

`/durian/overview`, `/durian/gates`, `/durian/tickets`, `/durian/tickets/:id` và `/durian/reports` đều lấy phạm vi từ phiên. Backend đọc `gate`, `ticket` và `event` theo `GroupId` trong `qhs_durian_records`. Chi tiết dùng `RecordId` của phiếu. `Payload.TicketId` nối lượt cân với phiếu, còn `Number` được giữ nguyên như chuỗi hiển thị.

App lấy danh sách cửa qua `/durian/gates?format=items` để nhận đối tượng có trường `items`. Đường dẫn mặc định vẫn trả mảng cho các client cũ.

- Tổng quan và báo cáo cộng phiếu thật đã kết thúc. Kỳ báo cáo theo ngày xe đến kho (`Arrival`), gồm cả ngày cuối, như desktop. Tổng quan dùng ngày hiện tại tại Việt Nam.
- `/durian/overview` trả thêm `purchases.amount` là tiền hàng hôm nay trước thuế và `purchases.missingPrices` là số phiếu kết thúc chưa đủ đơn giá.
- Tổng kg lấy từ lượt hợp lệ. Backend bỏ lượt giả lập, đã hủy hoặc cần kiểm tra. Tiền hàng cộng thành tiền đã làm tròn theo từng phân loại của từng phiếu. Chi tiết phiếu tách tiền hàng và thuế. Diễn giải và đơn giá lấy từ các trường đã lưu trên phiếu.
- Khi mất mạng, màn hình đang dùng tiếp tục hiển thị những kết quả đã tải trong phiên và thời điểm điện thoại lấy dữ liệu. Cache nằm trong bộ nhớ của app và được xóa khi đăng xuất. Dữ liệu máy cân xuất hiện sau khi desktop đồng bộ tới CloudNetwork. Thời điểm máy cân đồng bộ không có trong schema nguồn.

## Kiểm thử

`npm run test:durian` cần MariaDB thử nghiệm ở `127.0.0.1:3317`, tài khoản root thử nghiệm và mật khẩu `QHS_TEST_DB_PASSWORD` (mặc định `test-root-only`). Script tạo cơ sở dữ liệu giả lập mới rồi dọn sau khi chạy. Để kiểm tra giao diện, chạy Expo Web cổng 8088 với `EXPO_PUBLIC_API_URL=http://127.0.0.1:4027`, đặt `PLAYWRIGHT_PATH` đến module Playwright và `CHROME_PATH` nếu dùng Chrome cài sẵn. Ảnh giao diện được lưu trong `artifacts/ui-polish`.

Chạy `npm run test:durian -- --dual-db` với cùng thiết lập để thử đăng nhập trùng tên, đổi nguồn hoặc loại trạm, cách ly phiên và lấy dữ liệu đúng nguồn từ hai database giả lập. Khi có Playwright, lệnh cũng thử thao tác lưu cấu hình từ giao diện Admin.

Trên Windows, đặt `QHS_DESKTOP_EXE` đến bản build desktop có `DurianReporting` để đối chiếu cùng bộ dữ liệu. Script gọi hàm báo cáo từ assembly desktop bằng dữ liệu thử nghiệm, không mở giao diện desktop hay kết nối CloudNetwork.

Kết quả nghiệm thu local: API và bản desktop cùng cho 914 kg, 2 chuyến đã kết thúc, 43.494.876 ₫ tiền hàng và tổng cộng 33.807.876 ₫ cho phiếu mẫu 0001. Chrome đã kiểm tra màn hình 320 px với 9 cửa, lọc báo cáo theo tháng, liên kết từ nhóm sang phiếu, mất mạng, đồng bộ lượt mới và đổi tài khoản. Expo đã xuất bundle Hermes cho Android và iOS.
