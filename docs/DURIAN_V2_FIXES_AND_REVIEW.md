# Sửa lỗi cân bàn và rà soát sau sửa

Ngày: 17/10/2026. Phạm vi: source desktop `durian scale V2`, ưu tiên luồng cân bàn quẹt thẻ ở `frmCans`. Web/App và backend hiện tại không bị thay đổi trong đợt này.

## Kết quả thay đổi

### Nhận gói và giữ dữ liệu tại máy

- Tách stream thành từng gói mới kết thúc `#`, hỗ trợ gói bị cắt qua nhiều lần nhận, nhiều gói nối liền, CR/LF và dòng RFID cũ. Buffer nhiễu có giới hạn và có thể tìm lại đầu gói mới.
- Gói cân bàn đi vào hàng đợi riêng có ID, thứ tự và thời điểm nhận. Không còn phụ thuộc ô nhớ `bResult` của luồng RFID cũ.
- Ghi file bằng flush và thay thế nguyên tử. Chỉ xác nhận lấy gói khỏi hàng đợi sau khi bản nháp phiếu đã được ghi tại máy; giữ raw frame đã xử lý để đối soát. Gói bị từ chối có lý do trong nhật ký nhận.
- Khi ghi đĩa lỗi, dừng gắn lượt vào phiếu, giữ gói chưa xác nhận và cho phép thử lại. ID sự kiện giúp xử lý tình huống đã ghi nháp nhưng chưa xác nhận hàng đợi mà không cộng lại lượt.
- Gói đã gắn nháp không được chuyển sang một phiếu khác khi xác nhận hàng đợi lỗi. Chặn commit phiếu khi lượt của chính phiếu còn chờ xác nhận; khôi phục chỉ mục chủ sở hữu từ các file nháp khi mở lại. File nháp thiếu/sai định danh khóa nhận mới để đối soát.
- Đóng/mở COM không ghép phần gói cũ với kết nối mới. Trạng thái thanh công cụ được cập nhật qua UI context thay vì sửa control trực tiếp từ thread đọc.
- Cổng đọc dùng baudrate kiểu int, tránh tràn UInt16 khi cấu hình 115200. Công cụ dò SDK cũ được chặn ép kiểu vượt giới hạn; chưa chứng minh tương thích phần cứng chỉ bằng việc cấu hình được giá trị này.

### Phiếu và thao tác trên màn hình

- Tự lưu nháp theo trạm và tài khoản; có chọn khôi phục nháp, giữ nháp để tải lại danh sách và ghi nháp khi đóng cửa sổ.
- Phiếu đang thay đổi khóa chuyển dòng/tải đè; phản hồi truy vấn danh sách cũ không được ghi đè một phiếu mới đang mở.
- Chọn phiếu cũ không tự nhận lượt. Nút **Nhận lượt cân** cho phép tạm dừng; gói còn chờ phải được người vận hành xác nhận đúng phiếu nhận. Không tự gán backlog vào phiếu đầu tiên trong danh sách.
- Bỏ nút giả lập khỏi bản vận hành. Kiểm tra đầu cân 1–99 và chữ số ASCII; giữ số âm/0 ở bước giải mã nhưng từ chối đưa vào lượt cân hợp lệ.
- Cân bàn không bị chặn vì chưa chọn model đầu cân của luồng cũ: gói quẹt mới đã chứa số kg. Tài khoản đăng nhập mới tải lại danh mục đúng trạm, không giữ cache từ một lần đăng nhập trước đó.
- Đơn giá sai/âm/quá giới hạn không làm văng ứng dụng hoặc âm thầm đổi thành 0. Khóa Lưu đến khi sửa giá hợp lệ. Bảo vệ các callback binding để không xóa lượt mới hoặc tạo nháp giả khi đổi bản ghi.
- Khóa in khi chưa lưu đầy đủ, đang có nháp hoặc chưa tải đủ chi tiết. Danh sách phiếu dùng LEFT JOIN để không bỏ phiếu cân bàn; màn sửa phiếu tại cấu hình sầu riêng đi qua `frmCans`.
- Phiếu cân bàn mới có dấu nhận dạng để danh sách/in không đưa vào công thức/mẫu cân xe; nút in của màn cân bàn gọi đúng mẫu trực tiếp. Với dữ liệu cũ chưa có dấu nhận dạng vẫn cần xác minh cấu hình và nguồn dữ liệu.

### Lưu database

- Header, nhóm hàng, lượt cân và cấp số phiếu được xử lý trong một transaction Serializable.
- Khóa dòng trạm khi cấp số, xét cả số phiếu lịch sử khi bộ đếm bị tụt; cập nhật cấu hình trạm theo từng cột để tránh ghi đè bộ đếm bằng cả đối tượng cũ.
- Tải một snapshot nhất quán, kiểm tra tổng header/nhóm/lượt và dấu vân tay dữ liệu trước khi cập nhật/xóa. Nếu máy khác đã sửa, giữ nháp và từ chối ghi đè.
- Giữ ID nhóm/lượt cũ, chỉ thêm lượt mới; không xóa toàn bộ chi tiết rồi tạo lại.
- Kiểm tra lại tài khoản, trạm, role và quyền thêm/sửa/xóa trong giao dịch. Bản MySQL kiểm tra các bảng tham gia dùng InnoDB trước khi cho ghi.
- Tính lại tổng ở lớp lưu và đọc lại để phát hiện database làm tròn số kg/tiền. Schema không đủ độ chính xác bị chặn, không âm thầm nhận dữ liệu đã sai.
- Đối chiếu từng lượt và metadata sau ghi, không chỉ đối chiếu tổng: trường hợp 5,2 + 4,8 bị làm tròn thành 5 + 5 vẫn bị phát hiện; metadata bị cắt không được commit mất mã chống trùng. Lượt mới phải khớp loại/người/đầu cân/kg trong raw frame.
- Mỗi lần lưu có mã giao dịch bền vững trong nháp và metadata phiếu. Nếu database đã commit nhưng ứng dụng mất phản hồi, thử lại tra mã cũ thay vì tạo thêm phiếu. Giữ lịch sử mã để thử lại vẫn nhận ra giao dịch sau một lần sửa tiếp theo.
- Lưu cả ID nháp logic: bản backup cũ lấy trước khi sinh mã giao dịch cũng không được tạo lại một phiếu đã có trên server; giữ nháp để đối soát thay vì tự bỏ các lượt khác biệt.
- Chỉ gửi lệnh kết thúc cân sau khi DB commit; không xếp lệnh này vào hàng đợi khi IO đang mất kết nối. Trạng thái đã lưu dữ liệu được phân biệt với lỗi gửi lệnh IO; giao tiếp/ACK của các mode tự động vẫn cần thử thiết bị thật.
- Thêm nhật ký trước/sau và người thao tác trong metadata; xóa phiếu là xóa mềm, giữ các lượt và ghi dấu xóa. Đây chưa phải hệ audit bất biến tại server vì desktop vẫn có quyền DB trực tiếp.
- Lưu tên khách, mặt hàng, loại và người quẹt vào snapshot khi lưu. Đổi danh mục sau đó không tự đổi tên của snapshot đã có; đổi khách/mặt hàng trên phiếu thì cập nhật đúng snapshot tương ứng. Mẫu in lấy dữ liệu cân nhất quán và ưu tiên snapshot.

### Cấu hình và quyền

- Đưa chuỗi kết nối MySQL cố định ra khỏi source; đọc từ `QHS_MYSQL_CONNECTION` hoặc cấu hình mã hóa bằng Windows DPAPI theo tài khoản Windows.
- Đã chuyển cấu hình kết nối cũ của checkout này sang file được bảo vệ trên máy hiện tại, không kết nối DB để làm việc đó. Không thay đổi mật khẩu DB hoặc thông số kết nối cũ.
- Màn cấu hình build APP hỗ trợ MySQL và yêu cầu TLS cho cấu hình mới. Build SQL Server chọn Windows/SQL authentication theo việc có nhập tên đăng nhập.
- Mật khẩu ghi nhớ được bảo vệ bằng DPAPI; giá trị cũ được chuyển khi đọc. Reader INI tăng buffer để không cắt chuỗi mã hóa dài, và báo lỗi ghi cấu hình.
- Bỏ đường vào cân thủ công bằng mã cố định và đường dòng lệnh tự đổi ngày dùng; yêu cầu đăng nhập. Đăng nhập kiểm tra trạm và role còn hợp lệ.
- Chặn TRUNCATE dữ liệu cân trên màn cấu hình. Công cụ SQL và sửa định nghĩa quyền dùng chung chỉ dành cho phạm vi quản trị phù hợp; build APP áp dụng tài khoản công ty đã xác nhận (`admin`, ID 1, trạm 1).
- Danh sách tài khoản được giới hạn theo trạm, trừ quản trị công ty. Sửa lỗi chọn tài khoản bằng ID nhưng tìm theo username; khóa tài khoản thay cho xóa mất liên kết lịch sử; chỉnh thông tin không bắt buộc đổi mật khẩu.
- Sửa các helper scalar để build APP dùng MySQL; bỏ schema database cố định trong mapping bảng quyền APP.
- Dùng Newtonsoft.Json 13.0.4 với alias `qhsjson`, tách khỏi bản JSON nhúng trong OzekiSDK để tránh xung đột kiểu. [Tài nguyên NuGet](https://www.nuget.org/packages/Newtonsoft.Json/13.0.4).

## Kiểm chứng

Lệnh từ thư mục `qhs-scales-mobile`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-durian-reliability.ps1 -CompileDesktop -UiSmoke
```

Script khôi phục công cụ kiểm thử cố định từ NuGet khi thiếu, dưới `artifacts/durian-fixes`; không chạy chương trình cân, không gọi DB production. Phần biên dịch desktop dùng các DLL đi kèm source tại `CanQuocHung/bin/Release/lib`.

Kết quả cuối: **95 kiểm tra đạt**, gồm 47 kiểm tra parser/lưu bền vững, 28 kiểm tra repository và 20 kiểm tra WinForms. Cả hai nhánh local/APP qua kiểm tra biên dịch. Gói thử là dữ liệu mô phỏng; database repository là SQLite tạm, không xác minh được semantics khóa của SQL Server/MySQL thật.

Các nhóm đã kiểm tra:

1. Parser và stream: mọi điểm cắt của gói mẫu, 1.000 gói nối liền, 1.000 gói chia/nối ngẫu nhiên, nhiễu, reconnect, ASCII và số đầu cân.
2. Lưu tại máy: 1.000 sự kiện tồn tại sau khi tạo lại bộ nhận; hai lượt có raw giống nhau vẫn là hai sự kiện hợp lệ; khôi phục nháp và nhận ra sự kiện đã gắn trước khi ack; file lỗi/temp không bị coi là nháp hợp lệ; mã hóa Windows roundtrip.
3. Repository dùng database SQLite tạm: rollback header/bộ đếm khi lỗi chi tiết, append giữ ID cũ, retry, mất phản hồi sau commit, retry sau lần sửa tiếp theo, quyền bị thu hồi, tài khoản bị khóa, sửa/xóa stale, khác trạm, audit, tổng không khớp do cột làm tròn và bộ đếm tụt sau nhập dữ liệu lịch sử.
4. Màn WinForms thật ở chế độ ẩn: binding, tính tiền, lưu nháp qua chỉnh header/giá, lỗi ghi nháp và thử lại, không cộng sự kiện hai lần, quyền thao tác và đổi bản ghi không tạo nháp giả. Không mở COM, máy in, camera hoặc DB thật.
5. Biên dịch toàn bộ nguồn được khai báo cho cả nhánh local và `APP` bằng Roslyn. Đây là kiểm tra source và kiểu dữ liệu; chưa phải build gói cài đặt đầy đủ resource/native runtime.

Log kết quả cuối: `artifacts/durian-fixes/verification.log`. Source kiểm thử: `scripts/durian-tests`. SQLite chỉ dùng trong bài thử, không thay DB của phần mềm.

## Rà lại lần hai: các việc cần phòng bị

| Mức | Việc còn phải kiểm chứng hoặc chuẩn bị | Cách xử lý |
|---|---|---|
| Trước khi đưa vào trạm | Chưa chạy với MDF/MySQL thật, hai đầu cân thật, máy in hay camera | Dùng bản sao dữ liệu; kiểm tra schema, độ chính xác kg/tiền, bảng quyền và InnoDB; cân/in đối chiếu rồi mới thay bản đang dùng |
| Trước khi đưa vào trạm | DLL native, x86/x64, SDK camera và bản quyền/runtime chưa được xác nhận bằng gói cài đặt | Build/đóng gói bằng môi trường có dependency hợp lệ; thử trên máy trạm. Không dùng các EXE có tên `SourceCheck` làm bản vận hành |
| Trước khi đưa vào trạm | Nháp xung đột hoặc phiếu cũ thiếu mã loại/tổng sai cần đối soát | Giữ nguyên dữ liệu và nháp; xử lý trên bản sao trước. Không tự đoán mapping loại cũ theo số đầu cân, không xóa nháp để làm hết lỗi |
| Khi dùng chung với Web/App | Dashboard hiện tại chưa tách tiền hàng cân bàn với phí cân xe, và còn suy trạng thái từ lần cân 2 | Đợt này không sửa backend/mobile. Trước khi cho bản APP ghi chung DB, thêm adapter/phân loại module và đối soát báo cáo; không coi tổng giá trị hàng mua là doanh thu dịch vụ cân |
| Khi chuyển phiên bản | Bản desktop cũ vẫn có thể ghi đè metadata hoặc xóa/tạo lại lượt nếu cùng sửa phiếu cân bàn | Nâng đồng bộ các máy cùng ghi module này; quy định nguồn ghi chính và thử quay lại. Cấp số nguyên tử ở nhánh cân bàn mới không sửa toàn bộ cách cấp số của các mode cũ |
| Vận hành | Giao thức hiện không có sequence thiết bị, CRC, ACK, dấu ổn định hoặc UID thẻ trong gói mới | ID phần mềm chống gửi lại trong ứng dụng; chưa phân biệt được firmware phát lại cùng một lượt với hai lượt thật giống nhau. Cần ghi mẫu thật và nâng firmware nếu cần mức bảo đảm cao hơn |
| Vận hành | Đầy/hỏng ổ đĩa, mất điện, tài khoản Windows khác hoặc máy hỏng | Theo dõi dung lượng, UPS và backup/khôi phục đã thử; giữ cả nháp lẫn hàng đợi. Flush không thay được bảo đảm phần cứng. Không tự dọn/xóa lịch sử nhận khi chưa có chính sách lưu trữ |
| Vận hành | Hai bản EXE khác tên chạy cùng thư mục khôi phục; hoặc trộn riêng file pending từ backup cũ với DB mới | Chỉ mở một phiên ghi cho cùng tài khoản/trạm. Cơ chế chặn tiến trình cũ theo tên EXE chưa phải khóa thư mục liên tiến trình; khôi phục cả bộ và đối soát DB, không nhập lại raw cũ theo suy đoán |
| Vận hành | Lượt chưa gắn phiếu sau khi form đóng, kết nối lại hoặc đổi phiên | Kiểm tra số gói chờ và xác nhận đúng phiếu trước khi nhận; gói không có mã phiếu nên không tự gán theo suy đoán |
| Vận hành | Điện thoại/firmware có thể dùng thẻ theo nghĩa khác với mã người quẹt | Xác nhận loại thẻ, vai trò mã và giao thức thật. Không dùng mã trong gói như bằng chứng đăng nhập/quyền hệ thống |
| Bảo mật | Desktop còn kết nối DB trực tiếp, hash đăng nhập MD5 được giữ để tương thích các hệ đang dùng | Lộ trình tiếp theo là API xác thực/phân quyền, credential riêng và nâng hash có kế hoạch. Không coi khóa nút hoặc metadata audit là ranh giới bảo mật chống client bị sửa |
| Bảo mật | Credential từng có trong source/Git/binary cũ; kết nối cũ có thể còn tắt SSL | Lên lịch xoay credential phối hợp với các desktop, bật TLS và xác minh chứng chỉ máy chủ. Mã hóa file local không thu hồi credential cũ và không tự bảo vệ đường truyền |
| Bảo mật | DPAPI gắn với tài khoản Windows | Máy/tài khoản Windows mới cần cấu hình DB lại; không sao chép file được mã hóa rồi cho rằng tự đăng nhập được. Nháp/raw không mã hóa theo mật khẩu app, cần bảo vệ quyền truy cập/backup tại máy |
| Hiệu năng | Thiếu index trên `idusergroup/date_in`, `weight_id`, `detail_id` có thể khiến khóa/tra cứu chậm | Kiểm tra index thực tế và duplicate trước khi thêm. Không tự áp DDL vào DB đang chạy |
| Hiệu năng | Ghi file bền vững trong callback COM và nhiều câu INSERT khi lưu phiếu lớn có thể gây chậm/buffer quá tải | Đo với tốc độ gói thật, burst, ổ đĩa và antivirus thật; kiểm tra lỗi driver/overrun. Replay chuỗi trong bộ thử không thay cho phép thử cổng COM. Nếu vượt tải, tách worker ghi đĩa/batch và thiết kế shutdown an toàn trước khi tăng số đầu cân |
| Mode cũ | Cân tự động, điểm bột, barrier/cảm biến còn code thread và chờ ACK kiểu cũ | Thử riêng trên bàn thử thiết bị, gồm timeout/dừng khẩn, trước khi dùng chung với bản sửa. Không suy từ việc cân bàn qua kiểm thử rằng các mode này đã được nghiệm thu |

## Đường dẫn dữ liệu khôi phục

Mặc định:

```text
%LOCALAPPDATA%\QHSWeight\BenchRecovery\<mã trạm>\<mã tài khoản>\
  pending\   Gói chưa xác nhận gắn phiếu
  received\  Raw gói đã xử lý, gồm gói bị từ chối và lý do
  drafts\    Phiếu nháp và file dự phòng .bak
```

Có thể đổi thư mục gốc qua biến môi trường `QHS_BENCH_RECOVERY_ROOT`; phải chọn nơi ghi bền vững, có quyền truy cập và backup phù hợp. Công cụ kiểm thử dùng thư mục temp riêng.

Metadata phiếu có thêm mã giao dịch, snapshot và audit, nên cũng cần kiểm tra dung lượng/kiểu của `externdata`. Không tự xóa metadata cũ để làm hết lỗi độ dài.

Thao tác bản mới: tạo phiếu; xác nhận đúng phiếu nếu có backlog; bấm **Nhận lượt cân** để tiếp tục/tạm dừng. Sau Lưu, nhận lượt được tạm dừng; muốn cân tiếp cùng phiếu thì bật nhận lại. Khi giao dịch chưa xác nhận kết quả, dùng **Kiểm tra / lưu lại**; không tạo lại cùng phiếu bằng tay.

Cấu hình MySQL được bảo vệ nằm dưới `%LOCALAPPDATA%\QHSWeight\settings\mysql.json`. Không đưa file này vào Git hoặc gửi cùng log hỗ trợ.

## Trạng thái bàn giao

- Đã sửa source và thêm kiểm thử; giữ các thay đổi có sẵn trong checkout.
- Không sửa MDF/LDF, dữ liệu lịch sử, schema hay mật khẩu database production; không triển khai hoặc thay EXE đang chạy tại trạm.
- Bước xác minh thực địa tiếp theo là bản sao DB + đầu cân/RFID thật + in đối chiếu và thử mất mạng/mất cổng COM. Các câu kiểm tra schema chỉ đọc nằm ở `docs/sql/bench-preflight.*.sql`.
