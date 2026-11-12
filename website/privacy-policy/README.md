# Trang Chính sách quyền riêng tư QHS Scales

## URL công khai hiện hành — 23/10/2026

https://www.doluongquochung.com/privacy-policies/qhs-scales

Đã xác minh phản hồi HTTPS 200, có tiêu đề Chính sách quyền riêng tư QHS Scales, không cần đăng nhập. Hai liên kết ở Đăng nhập và Tài khoản mở URL này; bản web mở cùng tab để giữ đường quay lại. Dùng URL này cho Privacy Policy URL trên App Store Connect. Địa chỉ cấu hình chung ở `mobile/lib/links.ts`. Nội dung đi kèm app tại `/privacy-policy` vẫn được giữ.

## Cập nhật header và bố cục Mobile — 23/10/2026

File `index.html` mới có header sticky và nút Quay lại, cỡ chữ nội dung 17 px/giãn dòng 1.85, mục lục Mobile thu gọn, chia mục rõ ràng. Bấm mục lục không thêm lịch sử trang; Back dùng lịch sử trình duyệt để quay về trang trước. Nếu truy cập trực tiếp và không có lịch sử trước đó, liên kết dự phòng mở website công ty. Nút này không tự đưa trình duyệt ngoài về app native; trong app native người dùng vẫn dùng điều khiển quay về của trình duyệt/hệ điều hành.

Nội dung pháp lý giữ nguyên. CSS nguồn ở `styles.css` được nhúng vào `index.html` khi chạy `npm run privacy:export`.

Nguồn phục vụ URL hiện hành do người dùng xác nhận: `../qhs-system/app/privacy-policies/qhs-scales/index.html`. Đã đồng bộ bản HTML mới vào đúng file này, giữ nguyên `route.ts` đọc HTML trả Content-Type text/html. Kiểm tra GET handler trả 200, nội dung trùng file và có header sticky / Back / mục lục Mobile. Cần triển khai lại qhs-system để cập nhật trang công khai; lần này chưa triển khai production.

Các bước bên dưới là tài liệu xuất HTML và phương án hosting từ trước; URL hiện hành ở trên thay thế địa chỉ dự kiến cũ.

## Bản đã chuẩn bị

- `index.html`: trang độc lập có giao diện responsive, không cần database, thư viện ngoài hoặc đăng nhập. Mở trực tiếp để xem; có thể đặt trên hosting tĩnh.
- `wordpress-content.html`: nội dung cùng phiên bản, để dán vào khối Custom HTML của WordPress; giao diện theo theme website.
- Nguồn nội dung dùng chung: `mobile/content/privacy-policy.ts`. App đọc trực tiếp nguồn này qua `/privacy-policy`. Khi sửa nội dung, chạy `npm run privacy:export` tại gốc dự án để cập nhật hai file HTML.

## Đưa lên website công ty

Các file xuất có thể dùng khi cần cập nhật nội dung website; trang công khai hiện hành do người dùng cung cấp nằm trên `www.doluongquochung.com`.

Nếu website dùng WordPress: tạo Trang mới tên “Chính sách quyền riêng tư QHS Scales”, đặt slug `qhs-scales-privacy-policy`, thêm khối Custom HTML và dán nội dung `wordpress-content.html`. Nếu theme đã hiển thị tiêu đề trang, bỏ thẻ h1 đầu tiên trong khối nội dung để tránh tiêu đề lặp.

Nếu quản lý bằng File Manager/FTP: tải `index.html` vào thư mục công khai `qhs-scales-privacy-policy/` trên hosting. Không ghi đè mã nguồn/trang chủ hiện có. Đường dẫn dự kiến sau xuất bản: `https://candientuquochung.com/qhs-scales-privacy-policy/`.

Trước gửi App Store: kiểm tra URL thực tế trên cửa sổ ẩn danh và điện thoại, HTTPS hợp lệ, không yêu cầu đăng nhập, không bị trang chống bot/cookie che nội dung. Điền URL hiện hành ở trên vào Privacy Policy URL trên App Store Connect. Khi cập nhật chính sách, đối chiếu bản công khai và nội dung đi kèm app để giữ nhất quán.

## Đối chiếu trước khi công khai

Nội dung được soạn theo mã nguồn hiện có, cùng tên đơn vị, địa chỉ, email và điện thoại công bố trên website công ty ngày 21/10/2026. Xác nhận hộp thư info@candientuquochung.com đang được tiếp nhận; đối chiếu nhà cung cấp hạ tầng/sao lưu, vị trí xử lý dữ liệu, thời gian lưu/xóa theo vận hành thực tế và thỏa thuận của trạm. Chính sách chưa thay thế việc hoàn thiện luồng xóa tài khoản theo yêu cầu Apple.

Không tải thư mục artifacts, SQL dump, backend/.env hay thông tin phiên đăng nhập lên website cùng trang này.
