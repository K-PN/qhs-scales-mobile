# Đánh giá chuẩn bị App Store — 21/10/2026

Đánh giá mã nguồn và yêu cầu công khai; chưa có kết quả xét duyệt Apple, chưa build iOS/TestFlight hay kiểm thử iPhone thật trong lần này.

## Phạm vi chức năng

App React Native có đăng nhập theo trạm, tra cứu/lọc/xem chi tiết phiếu, tổng quan theo kỳ, thống kê khách hàng/hàng hóa/biển số, quản trị trạm/tài khoản theo quyền và hỗ trợ. Đây là tiện ích nghiệp vụ phục vụ hoạt động hằng ngày. Đánh giá: có cơ sở đáp ứng mục 4.2 về giá trị sử dụng; không có quy định số lượng chức năng bảo đảm được duyệt. Không cần thêm cân trực tiếp, Bluetooth, thanh toán hoặc thông báo chỉ để tăng số tính năng.

Apple vẫn đánh giá chất lượng native thực tế, dữ liệu hữu ích và mức độ hoàn chỉnh của bản gửi. Lỗi menu bị che chữ phải được kiểm chứng đã hết trên iPhone thật.

## Việc còn thiếu / cần xác minh

1. **2.1 — Hoàn chỉnh và truy cập review:** API HTTPS hoạt động liên tục; tài khoản demo tách dữ liệu thật, đủ dữ liệu minh họa và hướng dẫn thử. Có cả luồng trạm và quản trị nếu cả hai nằm trong bản gửi. Kiểm thử mất mạng, hết phiên, thu hồi quyền, bàn phím, màn nhỏ và bản Release.
2. **5.1.1(i) — Quyền riêng tư:** hai liên kết Đăng nhập và Tài khoản đã trỏ đến https://www.doluongquochung.com/privacy-policies/qhs-scales, kiểm tra HTTPS 200 ngày 23/10/2026. Điền URL này vào App Store Connect; đối chiếu nội dung lưu trữ/chia sẻ với vận hành thực tế. Khai App Privacy theo dữ liệu backend và SDK thực sự xử lý; không tự khai không thu thập chỉ vì app không dùng quảng cáo.
3. **5.1.1(v) — Tài khoản:** người dùng trạm đăng nhập bằng tài khoản được cấp, nhưng Admin có thể tạo tài khoản trong app. Chưa có luồng người dùng khởi tạo yêu cầu xóa tài khoản. Cần đối chiếu chính sách doanh nghiệp và hướng dẫn Apple; không mặc định khóa tài khoản là xóa. Không triển khai xóa hàng loạt phiếu cân lịch sử để đáp ứng mục này.
4. **2.3 — Hồ sơ chính xác:** mô tả rõ cần tài khoản trạm do Quốc Hưng cấp, phạm vi chỉ theo dõi dữ liệu cân và quản trị được phân quyền. Chuẩn bị icon, ảnh chụp bản iOS thật, URL hỗ trợ, phân loại độ tuổi và thông tin liên hệ review. Không quảng bá cân trực tiếp/Bluetooth/offline khi chưa có.
5. **Build và dependency:** dự án dùng Expo SDK 52, còn lệch phiên bản và cảnh báo dependency từ đợt rà trước. Cần chuẩn hóa, build bằng Xcode/SDK đáp ứng yêu cầu Apple, cấu hình bundleIdentifier/icon/build number và EAS production, thử TestFlight.
6. **Phân phối:** nếu chủ yếu dùng cho khách hàng/trạm được cấp tài khoản, cân nhắc Unlisted (qua liên kết) hoặc Custom Apps cho tổ chức phù hợp. Unlisted vẫn qua App Review và không thay cơ chế xác thực; bất kỳ ai có liên kết đều có thể tải.

## Nguồn chính thức

- Apple App Review Guidelines (2.1, 2.3, 4.2, 5.1.1): https://developer.apple.com/app-store/review/guidelines/
- Account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- App Review preparation: https://developer.apple.com/app-store/review/
- Unlisted distribution: https://developer.apple.com/support/unlisted-app-distribution/
- SDK minimum requirements: https://developer.apple.com/news/upcoming-requirements/?id=04282026a

Kết luận phát hành: có thể giữ phạm vi nghiệp vụ này cho bản 1.0; chưa đủ bằng chứng để xác nhận bản hiện tại sẵn sàng gửi hoặc chắc chắn được Apple chấp thuận.
