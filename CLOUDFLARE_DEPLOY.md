# Deploy trên Cloudflare Workers Static Assets

Website là static HTML/CSS/JavaScript, không cần build framework hay Worker script riêng.

## Cấu hình đang dùng

Cloudflare pipeline hiện chạy:

```bash
npx wrangler deploy
```

Vì vậy repo được cấu hình theo Workers Static Assets:

```toml
name = "localweb-nihongo-n5"
compatibility_date = "2026-07-07"
workers_dev = true
preview_urls = true

[assets]
directory = "."
html_handling = "auto-trailing-slash"
not_found_handling = "none"
```

Không dùng `pages_build_output_dir`, vì thuộc cấu hình Cloudflare Pages và không tương thích với lệnh `wrangler deploy`.

## Cấu hình Cloudflare Builds

- Production branch: `main`
- Build command: để trống
- Deploy command: `npx wrangler deploy`
- Root directory: để trống

Repo có `package.json` để cố định phiên bản Wrangler và cung cấp các lệnh:

```bash
npm run dev
npm run deploy
```

## Các URL chính

- Menu trang chủ: `/`
- Flash Card: `/FlashCard/` hoặc `/flashcard`
- Luyện Kana: `/FlashCard/hiragana.html` hoặc `/kana`
- TOEIC Vocabulary: `/FlashCard/toeic-vocabulary/` hoặc `/toeic`

Các file `_redirects` và `_headers` nằm trong thư mục assets gốc và được Workers Static Assets xử lý khi deploy.

## Kiểm tra local bằng Wrangler

```bash
npm install
npm run dev
```

Hoặc dùng web server Python:

```bash
python -m http.server 8000
```

Không mở trực tiếp file HTML bằng `file://`, vì trình duyệt có thể chặn việc tải các file JSON bằng `fetch()`.

## Trường hợp vẫn muốn dùng Cloudflare Pages

Đổi Deploy command trên Cloudflare thành:

```bash
npx wrangler pages deploy . --project-name localweb-nihongo-n5
```

Tuy nhiên repo hiện được tối ưu cho `npx wrangler deploy` theo Workers Static Assets để khớp pipeline hiện tại.
