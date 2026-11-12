# Bản phát hành Quốc Hưng Scales — 23/10/2026

## Thư mục build

`release/store-20261023` là bản mobile riêng để nâng Expo SDK 54 / React Native 0.81.5 / React 19.1, dùng Node 22. Không đóng gói backend, SQL dump, artifacts hoặc .env từ workspace gốc. Bản dev SDK 52 hiện có được giữ; tên app, icon và splash được cấu hình thêm ở mobile/app.json.

- Tên hiển thị: **Quốc Hưng Scales**.
- Mã ứng dụng dự kiến cho cả hai nền tảng: `com.doluongquochung.scales`. Nếu app đã có mã trên App Store Connect/Play Console thì phải dùng đúng mã đó trước build/ký lần đầu.
- Android production: AAB, compile/target API 36, EAS image ubuntu-24.04-jdk-17-ndk-r27b.
- iOS production: thiết bị thật/store, Xcode 26.0 / SDK iOS 26, EAS image macos-sequoia-15.6-xcode-26.0. BuildNumber/versionCode được EAS quản lý tăng dần sau khi liên kết project.
- Icon 1024×1024 không alpha; adaptive foreground có khoảng an toàn, nền trắng. Icon dùng phần biểu tượng QHS từ logo gốc 2048×636 có trong dự án; splash giữ logo ngang Quốc Hưng. Các file nằm ở mobile/assets và được sao chép vào bản release.

## Cần có trước khi gửi build cloud

1. **API HTTPS production** của backend Node này, truy cập được /health và appReady=true. Hiện chưa có địa chỉ được cung cấp; không dùng API local, domain trang chính sách hoặc URL giả thay thế.
2. **Expo/EAS đăng nhập và project được liên kết**. Lần kiểm tra đầu tiên trên máy: `eas whoami` báo Not logged in. Không gửi mật khẩu hoặc token vào chat.
3. **Ký iOS:** Apple Developer còn hiệu lực, quyền tạo/sử dụng Bundle ID và certificate/provisioning profile. **Ký Android:** keystore cho package; giữ đúng keystore cũ nếu đây là bản cập nhật. Lần đầu có thể dùng EAS quản lý credentials qua phiên CLI tương tác của chủ tài khoản.

## Lệnh tiếp tục

Tại `release/store-20261023`, đăng nhập bằng runtime Node 22:

```powershell
npx --yes --package=node@22 --package=eas-cli@25.3.0 eas login
npx --yes --package=node@22 --package=eas-cli@25.3.0 eas init
```

Thiết lập EXPO_PUBLIC_API_URL cho môi trường production hoặc cung cấp URL thực tế để cấu hình public env trong eas.json. Đây là biến được đóng gói trong app, không chứa mật khẩu/token hay thông tin kết nối DB.

Sau khi project/credentials đã thiết lập, tại gốc qhs-scales-mobile:

```powershell
npm run store:build
```

Lệnh kiểm tra API rồi mới yêu cầu EAS build iOS và Android production. Nếu EAS cần tạo credentials lần đầu, thực hiện `eas build --platform all --profile production` trong thư mục release bằng phiên tương tác của chủ tài khoản. Project không có Git nên đặt EAS_NO_VCS=1 trong terminal đó.

Không tự upload lên App Store/Play Console trong bước này. Sau build thành công, tải .ipa/.aab từ EAS, thử trên thiết bị/TestFlight/internal testing trước khi gửi xét duyệt. Web export, Hermes bundle và prebuild native project không phải IPA/AAB đã ký.

## Kết quả chuẩn bị hiện tại

- Node 22.23.3, Expo 54.0.38, React Native 0.81.5, React 19.1.0 đã được cài trong thư mục release riêng.
- TypeScript đạt, expo install --check đạt, Expo Doctor 18/18 đạt.
- Đã xuất bundle Hermes iOS và Android, web export ở release/store-20261023/build-artifacts/export. Đây là đầu ra kiểm tra; chưa được gắn API production, không dùng để upload store.
- Android prebuild đạt, app_name là Quốc Hưng Scales, compile/target API 36, New Architecture và edge-to-edge bật. Lần đầu Node 22 trên Windows không sao chép được template native bằng fs.cpSync; dùng Node 18 sao chép template Expo đã giải nén rồi chạy lại prebuild thành công. Thư mục native này bị loại khỏi EAS upload; cloud sẽ sinh lại từ config.
- Cấu hình iOS introspection đạt: Bundle ID, tên hiển thị và splash đã được áp dụng. Chưa chạy CocoaPods/Xcode hoặc tạo archive iOS trên máy Windows.
- Kiểm tra API + Chrome với giao diện SDK 54: 128/128 đạt, MariaDB riêng qhs_mobile_test_1792697450191, không dùng DB nghiệp vụ thật.
- Kiểm tra EAS lần cuối vẫn Not logged in. `npm run store:build` đã được thử và dừng đúng tại điều kiện thiếu API production. Chưa gửi job cloud, chưa tạo IPA/AAB đã ký.
- Hồ sơ máy và hash các đầu vào build: docs/store-build-status-20261023.json. Bản release là snapshot; nếu đổi mã nguồn mobile sau lần này cần đồng bộ và kiểm tra lại trước build.

## Nguồn chính thức

- https://expo.dev/changelog/sdk-54
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build-reference/infrastructure/
- https://developer.android.com/google/play/requirements/target-sdk
- https://developer.apple.com/news/upcoming-requirements/?id=04282026a
