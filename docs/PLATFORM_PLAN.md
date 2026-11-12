# Đề xuất nền tảng Quốc Hưng: Web + App + cân xe tải + cân bàn

Trạng thái: đề xuất kiến trúc, chưa triển khai cân trực tiếp hay mua thiết bị.
Thông tin người dùng cung cấp ngày 17/10/2026: hosting hiện quản lý MySQL bằng phpMyAdmin; đầu cân RS232; đầu đọc RFID; chưa chọn Bluetooth; cần cả Android, iPhone và Windows.

## 1. Phạm vi dự án

Nên phát triển tiếp trong cùng kho mã và nền tảng dữ liệu:
- backend: API, danh tính, quyền theo trạm, giao dịch, đồng bộ và báo cáo.
- mobile: Expo/React Native cho Android và iPhone.
- web: giao diện nghiệp vụ cho máy tính; có thể dùng giao diện Expo web hiện có khi thử nghiệm rồi tách giao diện bàn cân riêng nếu cần.
- shared: kiểu dữ liệu, quy tắc tính và bộ giải mã đã kiểm thử.
- device-agent/gateway: phần đọc thiết bị tại trạm, có thể triển khai trên bộ chuyển đổi phù hợp hoặc máy tính tại trạm.

Hai module nghiệp vụ riêng:
- Cân xe tải: vào/ra, xe, khối lượng lần 1/2, phiếu, phí cân.
- Cân bàn: phiên/lô thu mua, nhiều lượt cân/bao, bì, loại hàng, chất lượng, chủ hàng/thẻ, đơn giá và thanh toán.

Dùng chung trạm, người dùng, quyền, thiết bị và báo cáo; không ép toàn bộ nghiệp vụ cân bàn vào tbweight hiện hữu.
tbweight và phần mềm desktop tiếp tục hoạt động; tạo lớp chuyển đổi đọc dữ liệu cũ. Chỉ chuyển quyền ghi sang API theo từng giai đoạn đã kiểm chứng.

## 2. Phương án thiết bị đề xuất cho cả ba nền tảng

Đầu cân RS232 và đầu đọc RFID -> bộ kết nối tại trạm -> API -> database.
Web trên Windows và App trên Android/iPhone dùng cùng API.

Ưu tiên bộ kết nối có Ethernet/Wi-Fi; Bluetooth BLE là tùy chọn bổ sung. Như vậy việc đọc đầu cân không phụ thuộc một trình duyệt hoặc điện thoại cụ thể.
Nếu Windows đã gắn đầu cân, có thể dùng agent nhỏ trên máy đó; nơi chỉ có cân bàn, chọn gateway độc lập sau khi thử phần cứng.
Không mua module chỉ ghi chung chung Bluetooth: phải biết BLE/GATT hay Classic/SPP, giao thức dữ liệu và quyền truy cập.

RS232 không cắm thẳng vào chân UART của vi điều khiển; chọn bộ chuyển mức và cách ly / nguồn phù hợp theo datasheet, kỹ thuật kiểm tra trước khi nối.
Đầu đọc RFID cần biết loại thẻ và giao tiếp thực tế: USB HID, serial, Wiegand, hoặc loại khác. Không mặc định mọi thẻ RFID đều đọc được bằng NFC điện thoại.

## 3. Bluetooth trực tiếp

- Web Bluetooth xử lý BLE/GATT trên các trình duyệt hỗ trợ; không phủ toàn bộ trình duyệt. Cần HTTPS và thao tác cấp quyền.
- Web Serial là lựa chọn cho serial và một số Bluetooth Classic/RFCOMM trên tổ hợp trình duyệt / hệ điều hành hỗ trợ. Phải thử đúng phiên bản, không đánh đồng với Web Bluetooth.
- Không lấy Safari/iPhone Web Bluetooth làm đường duy nhất. iPhone nên dùng app native qua BLE phù hợp, hoặc kết nối gateway qua mạng.
- Thiết bị Classic dùng với iPhone cần kiểm tra khả năng MFi / SDK của nhà sản xuất; không cam kết mọi bộ chuyển RS232-SPP đều hoạt động.
- Expo hiện tại tái sử dụng được. Module Bluetooth native ngoài Expo Go cần development build và thử trên máy thật.

Nguồn:
- https://developer.chrome.com/docs/capabilities/bluetooth
- https://developer.chrome.com/docs/capabilities/serial
- https://developer.chrome.com/blog/serial-over-bluetooth
- https://github.com/whatwg/bluetooth/blob/main/implementation-status.md
- https://developer.apple.com/bluetooth/
- https://developer.apple.com/documentation/externalaccessory
- https://docs.expo.dev/workflow/customizing/

## 4. Luồng RFID và ghi phiếu

1. Người vận hành mở phiên cân, chọn loại hàng / lô / quy tắc bì và giá nếu có.
2. Đọc số cân liên tục tại chỗ, xác định ổn định, đơn vị và trạng thái quá tải / mất kết nối.
3. Quẹt thẻ xác định đúng khách / chủ hàng / phương tiện theo đăng ký thẻ.
4. Chụp số cân ổn định còn hiệu lực cùng mã thẻ, thiết bị, thời gian và người vận hành.
5. Ghi bền vững ở thiết bị / gateway trước; gán ID sự kiện duy nhất; báo nhận thành công.
6. API kiểm tra quyền và chống gửi trùng rồi ghi giao dịch; đồng bộ báo cáo Web/App.
7. Chỉ mở lượt mới khi đủ điều kiện, tránh quẹt thẻ lặp tạo nhiều phiếu. Không chặn vĩnh viễn cùng một thẻ vì một khách có thể cân nhiều lượt.

Thẻ là khóa nhận dạng, không tự chứng minh số cân hoặc giá. Không ghép thẻ mới với số cân cũ sau khi mất kết nối.
Sửa/hủy phiếu cần quyền và lịch sử, không xóa dấu vết giao dịch.
Cấp số phiếu và chốt tổng phải nguyên tử tại server hoặc có cơ chế số offline đã thiết kế, tránh xung đột với phần mềm desktop cũ.

## 5. Mất mạng và nhiều màn hình

Gateway hoặc app phải có lưu cục bộ bền vững, hàng đợi gửi lại, chống trùng ở API và trạng thái đã đồng bộ.
Không gửi mọi mẫu số cân liên tục vào bảng phiếu. Hiển thị số cân tức thời tại chỗ; lưu bản ghi đã chốt, gửi trạng thái hoặc dữ liệu trực tiếp có giới hạn tần suất nếu cần.
Mỗi thiết bị chỉ có một bộ phận đọc / chốt chính; nhiều Web/App được xem, quyền điều khiển phải tránh hai người cùng ghi một lượt.
Web offline cần thiết kế riêng cache ứng dụng / dữ liệu và đường kết nối thiết bị; không có sẵn chỉ vì dùng trình duyệt.
Nếu Web trên HTTPS gọi gateway mạng nội bộ, cần thiết kế HTTPS/WSS, ghép cặp, xác thực và kiểm thử quyền truy cập mạng của từng nền tảng, không mở cổng điều khiển cân công khai.

## 6. Hosting

phpMyAdmin là công cụ quản lý MySQL, chưa xác định được tài nguyên / quyền chạy dịch vụ của gói hosting.
Trong workspace hiện chỉ xác minh backend Express/Node, MySQL từ xa và cấu hình Docker local; chưa xác minh gói production có Node chạy lâu dài, WebSocket, backup hay SLA.

Đề xuất:
- Giữ hosting website giới thiệu candientuquochung.com nếu đang hoạt động ổn định.
- Web nghiệp vụ có thể ở app.candientuquochung.com, API ở api.candientuquochung.com; đây là phương án đặt tên, chưa đổi DNS.
- API và đồng bộ đặt trên VPS hoặc dịch vụ container / ứng dụng có quản lý, có HTTPS, tự khởi động lại, giám sát và backup.
- DB dùng MySQL/MariaDB tương thích; chưa cần đổi hệ DB chỉ để hỗ trợ Web và Bluetooth. Có thể giữ DB hiện tại trong giai đoạn chuyển tiếp nếu đáp ứng kết nối, độ trễ, backup và quyền.
- Web và App chỉ gọi API; không kết nối MySQL công khai từ client mới. Hạn chế quyền tài khoản DB và bảo toàn kết nối desktop trong giai đoạn chuyển tiếp.
- Chưa chốt nhà cung cấp, cấu hình hoặc chi phí trước khi có số trạm, lượt cân và yêu cầu ảnh / lưu trữ.

## 7. Thứ tự thực hiện

1. Bản thử thiết bị: một đầu cân thật, một đầu RFID thật, lấy mẫu gói RS232, ghi nhận model / baud / parity / dữ liệu ổn định; thử cùng gateway trên Windows, Android và iPhone.
2. Xây phiên cân bàn với nhận thẻ, chốt số ổn định, lưu cục bộ và gửi bù không trùng.
3. Web nghiệp vụ dùng chung API; phân quyền xem / cân / sửa / chốt ca; gộp báo cáo từ module xe tải và cân bàn.
4. Bổ sung cân bao / bì, phẩm cấp, giá mua, thanh toán / công nợ và in phiếu sau khi thống nhất quy trình thực tế.
5. Cảnh báo thiết bị mất kết nối, phiếu bất thường, lịch sử chỉnh sửa, đối soát ca và sao lưu khôi phục.

