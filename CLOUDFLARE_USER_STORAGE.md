# Tách website và nơi lưu thiết lập người dùng trên Cloudflare

## Kiến trúc đề xuất

```text
Cloudflare Workers Static Assets
  └─ Website HTML/CSS/JavaScript

Cloudflare Worker API (api.example.com)
  ├─ Xác thực người dùng
  └─ Đọc/ghi thiết lập
       └─ Cloudflare D1
```

Website vẫn là static site. Không đặt khóa bí mật hoặc thông tin kết nối D1 trong JavaScript phía trình duyệt. Chỉ Worker API được phép truy cập D1.

## Dữ liệu đang được tách qua Storage Service

Trang TOEIC hiện sử dụng `FlashCard/toeic-vocabulary/storage-service.js`. Các module không cần truy cập trực tiếp `localStorage` hoặc `sessionStorage`.

Nhóm thiết lập có thể đồng bộ:

- bộ dữ liệu đang chọn;
- ID từ đang học;
- cấu hình Auto Play;
- chế độ giữ màn hình sáng;
- chế độ đoán nghĩa;
- về sau có thể thêm từ đã thuộc, từ cần ôn và lịch sử học.

Hàng đợi ngẫu nhiên chỉ nên lưu trong `sessionStorage`, không cần đồng bộ lên server.

## Vì sao nên dùng D1 thay vì KV

D1 phù hợp hơn cho dữ liệu người dùng vì có thể:

- lưu theo `user_id` và `setting_key`;
- cập nhật từng thiết lập;
- truy vấn lịch sử hoặc thống kê;
- tạo ràng buộc tránh dữ liệu trùng.

KV phù hợp hơn cho cache hoặc dữ liệu cấu hình đọc nhiều, không phù hợp bằng D1 cho cập nhật thiết lập thường xuyên.

## Schema D1 tối thiểu

```sql
CREATE TABLE user_settings (
  user_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, setting_key)
);

CREATE INDEX idx_user_settings_updated_at
ON user_settings(updated_at);
```

Nếu bổ sung tiến độ học, nên tách bảng riêng:

```sql
CREATE TABLE vocabulary_progress (
  user_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  word_rank INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'learning', 'known', 'review')),
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  next_review_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, dataset_id, word_rank)
);
```

## API đề xuất

```text
GET  /v1/settings
PUT  /v1/settings/:key
GET  /v1/progress/:datasetId
PUT  /v1/progress/:datasetId/:rank
```

Ví dụ nội dung cập nhật:

```json
{
  "value": {
    "repeatCount": 3,
    "intervalSeconds": 5
  }
}
```

Worker phải lấy `user_id` từ phiên đăng nhập đã xác thực. Không nhận `user_id` trực tiếp từ request body vì người dùng có thể sửa ID để đọc dữ liệu của người khác.

## Lựa chọn xác thực

### Website cá nhân, chỉ một người dùng

Dùng Cloudflare Access để bảo vệ cả website và API. Worker xác minh Access JWT và lấy email hoặc subject làm `user_id`.

### Website có nhiều người đăng ký

Dùng một dịch vụ xác thực như Clerk, Auth0 hoặc Firebase Authentication. Worker xác minh JWT do dịch vụ đó phát hành trước khi truy cập D1.

Không nên tự viết hệ thống mật khẩu nếu chưa có yêu cầu nghiệp vụ đặc biệt.

## Các bước triển khai

1. Deploy repository hiện tại bằng Workers Static Assets.
2. Tạo một Worker API riêng, ví dụ `nihongo-user-api`.
3. Tạo D1 database và binding tên `DB` cho Worker API.
4. Chạy schema SQL bằng Wrangler.
5. Cấu hình xác thực cho API.
6. Cấu hình CORS chỉ cho domain website của bạn.
7. Tạo `RemoteStorageAdapter` gọi API và thay adapter local trong `storage-service.js` sau khi đăng nhập.
8. Giữ local adapter làm chế độ dự phòng khi mất mạng hoặc chưa đăng nhập.

## Chiến lược đồng bộ an toàn

- Khi mở trang: đọc local trước để giao diện hiển thị ngay, sau đó tải bản server.
- So sánh `updated_at`; bản mới hơn được ưu tiên.
- Khi người dùng thay đổi: lưu local ngay, gửi server ở nền.
- Nếu gửi thất bại: giữ thay đổi trong hàng đợi và thử lại khi online.
- Chỉ đồng bộ thiết lập ổn định; không gửi hàng đợi random hoặc trạng thái UI tạm thời.

## Lưu ý bảo mật

- Không đưa D1 binding, API token hoặc secret vào repository frontend.
- API phải xác minh JWT trên mọi request.
- Giới hạn kích thước `setting_value` và danh sách `setting_key` được phép.
- Dùng prepared statements khi truy cập D1.
- Cấu hình CORS theo domain cụ thể, không dùng `*` cho API có thông tin người dùng.
- Thêm rate limit cho các endpoint ghi dữ liệu.
