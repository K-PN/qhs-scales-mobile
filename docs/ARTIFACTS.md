# Thư mục artifacts dùng để làm gì?

Tên đúng là `artifacts`. Đây là đầu ra và tài liệu phục vụ quá trình phát triển, không phải thư mục dữ liệu nghiệp vụ đang chạy. `.gitignore` loại thư mục này khỏi Git.

Trong workspace hiện tại:

| Nhóm | Nội dung | Khi dọn |
|---|---|---|
| `v2`, `v3`, `support`, `login-fix` | Ảnh chụp UI, kết quả kiểm thử, bản export/bundle | Có thể xóa nếu không cần bằng chứng kiểm tra; script kiểm thử có thể sinh lại đầu ra mới |
| `android-bundle`, `web-export` | Đầu ra đóng gói thử | Có thể xóa; cần build lại nếu muốn dùng |
| `durian-fixes` | Compiler/thư viện tải về, exe kiểm thử, log, dấu vân tay mã đã kiểm tra | Chiếm phần lớn dung lượng. Có thể bỏ đầu ra tạm; lưu báo cáo và dấu vân tay cần đối chiếu trước khi xóa toàn bộ |
| `durian-source-review` | Tài liệu/đầu ra rà soát desktop | Lưu riêng nếu còn cần tham chiếu kết quả rà soát |
| `migrations` | before.json, after.json, applied.log, result.json của lần thay đổi schema trước | Nên sao chép sang nơi lưu hồ sơ kỹ thuật trước; xóa sẽ mất bằng chứng, không hoàn tác migration trong DB |
| File `.cjs`, `.txt` ở gốc | Công cụ sửa mã/thử nghiệm tạm của các phiên trước | Không được app/backend import khi chạy. Một số công cụ có khả năng sửa mã hoặc kết nối DB; không chạy lại tùy tiện |
| `backend-local.*.log` | Log stdout/stderr của backend local | Dừng backend trước khi xóa; Windows có thể khóa file đang ghi |

Xóa artifacts không xóa bảng MySQL, file `.env` hoặc mã nguồn `mobile`/`backend`. Tuy vậy, toàn bộ hồ sơ, công cụ và đầu ra duy nhất còn nằm ở đó sẽ mất nếu chưa lưu bản khác. Không coi thư mục này là một bộ backup đầy đủ của hệ thống.

Không đưa artifacts lên website công khai hoặc đính kèm gói phát hành. Ảnh/log/hồ sơ cũ có thể chứa dữ liệu nội bộ. Bản Chính sách quyền riêng tư cần đăng nằm riêng ở `website/privacy-policy/`.

Người dùng mới hỏi về khả năng xóa; chưa thực hiện xóa thư mục.
