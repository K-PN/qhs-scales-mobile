# API hiện hành

Base local: http://localhost:4010. Dùng HTTPS khi phát hành.

## Đăng nhập

POST /auth/login: { username, password, stationId? }.
Không cần kind. Server xác minh danh tính rồi xác định giao diện.
stationId chỉ dùng để phân biệt tên tài khoản trùng; 409 yêu cầu bổ sung mã trạm.
Trả user, accessToken, refreshToken. authKind nội bộ phân biệt nguồn danh tính app_users / tbusers với vai trò giao diện admin / station.

Quản trị công ty: đúng cặp cấu hình QHS_COMPANY_STATION_ID + QHS_COMPANY_ADMIN_USER_IDS. Một tài khoản Admin ở trạm khác vẫn thuộc giao diện trạm.
Tài khoản quản trị cũ trong app_users vẫn được hỗ trợ; không tạo mật khẩu mặc định.

POST /auth/refresh: { refreshToken }.
GET /auth/me.
POST /auth/logout.
Các route còn lại dùng Authorization: Bearer <accessToken>.

## Dữ liệu và thống kê

GET /weighings: q, startDate, endDate, stationId, creatorId, status (all|pending|complete), page, limit (1..100).
Trạm luôn giới hạn bằng tbweight.idusergroup; mọi tài khoản trạm được xem toàn trạm. creatorId chỉ thu hẹp kết quả.
GET /weighings/:id: trả 404 nếu phiếu không thuộc trạm.
Chỉ hiển thị enable=1; chờ lần 2 khi weight_2 IS NULL.
Danh sách / chi tiết có price_total.

GET /reports: cùng bộ lọc. summary gồm totalRecords, totalNet, pending, complete, revenue, customers, vehicles.
- revenue: tổng price_total đã lưu trên phiếu. Đây là thành tiền ghi nhận; chưa có trạng thái thu tiền để kết luận doanh thu đã thu.
- customers: đếm mã khách riêng biệt theo trạm; fallback tên đã trim/lower khi không có mã. Không dùng tbcustomer. Cùng một khách xuất hiện với mã khác nhau có thể được tính riêng.
- vehicles: biển số không rỗng riêng biệt trong kỳ.
- trend: khối lượng theo khoảng startDate..endDate đã chọn, giữ phạm vi trạm / người tạo / tìm kiếm / trạng thái. trendUnit = day khi kỳ tối đa 31 ngày, month khi tối đa 731 ngày, year cho kỳ dài hơn. Nếu không gửi khoảng ngày, biểu đồ mặc định 7 ngày gần nhất. Chỉ trả các mốc có dữ liệu.
- today: lượt / khối lượng / thành tiền trong ngày.
- system: số trạm / trạm đang mở / tài khoản; chỉ Admin.

GET /reports/groups: groupBy (customer|item|vehicle), cùng bộ lọc / phân trang của /weighings.
- search: từ khóa tối đa 100 ký tự, tìm đúng nhóm đang chọn (tên/mã khách, tên hàng hoặc biển số). Ký tự % và _ được tìm như ký tự thường. Lọc nhóm trước phân trang và giữ nguyên tổng của mọi phiếu thuộc nhóm khớp, kể cả khách đổi tên trên các phiếu khác nhau.
- Trả items, total (số nhóm trước phân trang), page, limit, groupBy; sắp xếp thành tiền giảm dần, lượt cân giảm dần, khóa nhóm tăng dần.
- Mỗi nhóm có groupKey, label, stationName (chỉ nhóm khách hàng), records, weight (kg), revenue (price_total), pending.
- Khách hàng: mã khách theo trạm, fallback tên trim/lower; cùng tên nhưng khác mã hoặc khác trạm không gộp tùy tiện.
- Hàng hóa: tên snapshot trên phiếu, trim/lower. Biển số: trim/upper, giữ dấu và khoảng trắng bên trong.
- Dữ liệu thiếu được giữ trong nhóm Chưa có khách hàng / hàng hóa / biển số; không loại khỏi tổng.
- Trạm luôn bị giới hạn ở server; stationId do client gửi không mở rộng quyền. Không ghi hay thay đổi phiếu cũ, không cần migration.
- App: Tổng quan → Tùy chọn → nhập từ ngày/đến ngày theo dd/mm/yyyy hoặc chọn lịch → Áp dụng khoảng thời gian. Kỳ áp dụng cho số tổng quan, biểu đồ và thống kê chi tiết. Giữ Hôm nay / 7 ngày / Tháng này.
- Thống kê chi tiết → chọn nhóm → Xem thống kê → tìm tên/mã khách, tên hàng hoặc biển số. Tìm tự động sau 350 ms; đổi từ khóa/kỳ đặt lại trang 1; 10 nhóm mỗi trang, có nút Xóa tìm kiếm thống kê và Ẩn thống kê.

GET /station/profile: trả thông tin trạm của tài khoản (kể cả quản trị công ty). Admin app_users không gán trạm trả station:null.
Không có route xuất Excel/PDF.

## Quản trị

GET /admin/stations: q, page, limit.
POST /admin/stations: name, address, phonenumber, enabled.
PATCH /admin/stations/:id: các trường trên và version.
GET /admin/accounts: q, stationId, page, limit.
GET /admin/roles: vai trò desktop.
POST /admin/accounts: stationId, username, password, roleId, enabled.
PATCH /admin/accounts/:id: version, roleId, enabled, password?.
viewAll là trường tương thích cũ, không thể thu hẹp chính sách xem toàn trạm mới.
GET /admin/audit: page, limit. Không hiển thị nhật ký trong trang tài khoản trên app.

Các thay đổi quản trị dùng transaction, khóa bản ghi, kiểm tra version và audit không chứa mật khẩu.
400 sai dữ liệu; 401 không xác thực; 403 thiếu quyền; 404 không thấy; 409 dữ liệu đã đổi / tên tài khoản trùng; 503 hệ thống chưa sẵn sàng.
GET /health kiểm tra kết nối DB và đầy đủ bảng cho ứng dụng, không chỉ SELECT 1.

