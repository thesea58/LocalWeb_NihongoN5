# Cloudflare D1: đăng nhập và đồng bộ thiết lập

Website sử dụng một Cloudflare Worker cho cả static assets và API. Nếu chưa gắn D1, website vẫn hoạt động ở chế độ lưu cục bộ.

```text
Browser
  ├─ HTML/CSS/JavaScript → Workers Static Assets
  └─ /api/* → Worker API → D1
```

## Thành phần đã triển khai

- `worker/index.js`: API đăng nhập, phiên, thiết lập và tiến độ học.
- `migrations/0001_user_storage.sql`: schema D1.
- `scripts/create-user.mjs`: tạo hash mật khẩu và câu SQL thêm người dùng.
- `FlashCard/toeic-vocabulary/remote-storage.js`: đồng bộ local-first.
- `FlashCard/toeic-vocabulary/auth-client.js`: giao diện đăng nhập/đăng xuất.

Mật khẩu dùng PBKDF2-SHA256 với salt riêng. Phiên đăng nhập dùng token ngẫu nhiên, chỉ lưu hash trong D1 và gửi token bằng cookie `HttpOnly; Secure; SameSite=Strict`.

## 1. Cài dependencies

```bash
npm install
```

Đăng nhập Cloudflare nếu máy chưa đăng nhập:

```bash
npx wrangler login
```

## 2. Tạo D1

```bash
npm run db:create
```

Cloudflare sẽ trả về cấu hình tương tự:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nihongo-user-data"
database_id = "ID_DO_CLOUDFLARE_CAP"
```

Thêm đúng block Cloudflare trả về vào cuối `wrangler.toml`. Tên binding bắt buộc là `DB`.

## 3. Tạo bảng

```bash
npm run db:migrate
```

Schema tạo các bảng:

- `users`;
- `user_sessions`;
- `user_settings`;
- `vocabulary_progress`;
- `login_attempts`.

## 4. Tạo 2–3 người dùng cố định

### PowerShell

```powershell
$env:NIHONGO_USERNAME="user01"
$env:NIHONGO_PASSWORD="mat-khau-dai-va-kho-doan"
$env:NIHONGO_DISPLAY_NAME="Người học 1"
npm run user:sql | Out-File -Encoding utf8 user01.sql
npx wrangler d1 execute nihongo-user-data --remote --file=user01.sql
Remove-Item user01.sql
Remove-Item Env:NIHONGO_PASSWORD
```

Lặp lại với `user02`, `user03`. Không commit file SQL chứa password hash vào GitHub.

### Bash

```bash
NIHONGO_USERNAME=user01 \
NIHONGO_PASSWORD='mat-khau-dai-va-kho-doan' \
NIHONGO_DISPLAY_NAME='Người học 1' \
npm run user:sql > /tmp/user01.sql

npx wrangler d1 execute nihongo-user-data --remote --file=/tmp/user01.sql
rm /tmp/user01.sql
```

Chạy lại với cùng username sẽ cập nhật mật khẩu thay vì tạo tài khoản trùng.

## 5. Chạy local

Áp dụng migration cho D1 local:

```bash
npx wrangler d1 execute nihongo-user-data --local --file=migrations/0001_user_storage.sql
```

Tạo user local bằng cách đổi `--remote` thành `--local`, sau đó:

```bash
npm run dev
```

## 6. Deploy

```bash
npm run deploy
```

Nếu repository đã kết nối Cloudflare Builds, chỉ cần push `main`; pipeline hiện tại chạy `npx wrangler deploy`.

## API

```text
GET  /api/health
POST /api/login
POST /api/logout
GET  /api/session
GET  /api/settings
PUT  /api/settings
GET  /api/progress/:datasetId
PUT  /api/progress/:datasetId/:rank
```

API không nhận `user_id` từ trình duyệt. Worker luôn lấy người dùng từ cookie phiên đã được xác minh.

## Cách đồng bộ hoạt động

1. Giao diện đọc local storage trước nên không phải chờ mạng.
2. Sau khi xác nhận phiên đăng nhập, trang tải thiết lập từ D1.
3. Nếu D1 chưa có thiết lập, dữ liệu local hiện tại được dùng để khởi tạo.
4. Khi thay đổi, local được cập nhật ngay.
5. Các thay đổi được gộp trong 1,5 giây rồi gửi lên D1.
6. Khi offline, dữ liệu local vẫn dùng được và hệ thống thử lại khi online.
7. Hàng đợi random chỉ lưu theo phiên, không đồng bộ.

## Thiết lập đang đồng bộ

- bộ dữ liệu được chọn;
- ID từ đang học;
- cấu hình Auto Play;
- giữ màn hình sáng;
- chế độ đoán nghĩa.

## Bảo vệ đăng nhập

- Sau 5 lần nhập sai theo username và IP, đăng nhập bị khóa 15 phút.
- Không có đăng ký công khai hoặc quên mật khẩu.
- Mật khẩu không được lưu trong repository hay frontend.
- Request thay đổi dữ liệu bị kiểm tra `Origin`.
- Dữ liệu SQL dùng prepared statements.
- Cookie không thể đọc bằng JavaScript.

Turnstile là tùy chọn. Nếu muốn bật, đặt secret:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Chỉ bật secret sau khi đã thêm widget Turnstile và truyền token từ giao diện đăng nhập.

## Domain riêng hoặc API khác origin

Thiết kế mặc định dùng cùng origin và không cần CORS. Nếu API chạy trên domain khác, đặt:

```toml
[vars]
ALLOWED_ORIGIN = "https://ten-mien-website-cua-ban.example"
```

Ưu tiên cùng một Worker/cùng origin vì cookie hoạt động ổn định hơn và cấu hình đơn giản hơn.

## Chi phí

Với 2–3 người, mức sử dụng dự kiến nằm rất xa giới hạn Workers Free và D1 Free. Static assets miễn phí; D1 Free hiện có 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày và tổng 5 GB storage.
