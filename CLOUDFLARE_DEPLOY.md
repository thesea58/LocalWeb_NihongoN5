# Deploy trên Cloudflare Pages

Website là static HTML/CSS/JavaScript, không cần build framework.

## Cấu hình khuyến nghị

- Production branch: `main`
- Build command: để trống
- Build output directory: `.`
- Root directory: để trống

Repo đã có `wrangler.toml` với:

```toml
pages_build_output_dir = "."
```

## Các URL chính

- Menu trang chủ: `/`
- Flash Card: `/FlashCard/` hoặc `/flashcard`
- Luyện Kana: `/FlashCard/hiragana.html` hoặc `/kana`
- TOEIC Vocabulary: `/FlashCard/toeic-vocabulary/` hoặc `/toeic`

Đường dẫn TOEIC cũ `/toeic-vocabulary/` được redirect sang vị trí mới bằng file `_redirects`.

## Kiểm tra local

Chạy web server tại thư mục gốc của repo, ví dụ:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000/`.

Không mở trực tiếp file HTML bằng `file://`, vì trình duyệt có thể chặn việc tải các file JSON bằng `fetch()`.
