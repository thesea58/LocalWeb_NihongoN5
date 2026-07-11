# Ý tưởng game: **Deadline Dash – Giải cứu văn phòng TOEIC**

Đây là trò chơi học từ vựng theo bối cảnh công việc. Người chơi phải khôi phục các email, hợp đồng, hóa đơn và thông báo bị mất từ trước khi “hệ thống công ty” ngừng hoạt động.

Game phù hợp với dữ liệu hiện tại vì bộ từ đã có 500 từ, ba ngôn ngữ Anh–Nhật–Việt, IPA, câu ví dụ mức khoảng TOEIC 450 và một số collocation.  Trang hiện tại cũng đã có phát âm, câu ví dụ, lựa chọn bộ dữ liệu và random không lặp nên phần lớn chức năng có thể tái sử dụng. 

---

## 1. Cơ sở thiết kế

Game không chỉ cho người dùng nhìn từ rồi chọn đáp án, mà buộc họ **tự nhớ lại từ**. Nghiên cứu về retrieval practice cho thấy việc cố gắng truy xuất thông tin từ trí nhớ giúp ghi nhớ lâu hơn so với chỉ đọc lại nhiều lần. ([PubMed][1])

Những từ trả lời sai sẽ xuất hiện lại sau một số câu khác thay vì lặp ngay lập tức. Nghiên cứu về học từ vựng ngôn ngữ thứ hai cho thấy việc giãn khoảng ôn tập có ảnh hưởng lớn đến khả năng ghi nhớ dài hạn. ([Cambridge University Press & Assessment][2])

Ở mức TOEIC khoảng 450, phần đầu game nên ưu tiên hướng **English → Vietnamese**. Khi người học tiến bộ, game tăng dần câu hỏi **Vietnamese → English**. Một nghiên cứu với người Nhật học tiếng Anh cho thấy người học trình độ thấp có thể hưởng lợi nhiều hơn từ hướng L2→L1, trong khi người học khá hơn phù hợp hơn với hướng L1→L2. ([Cambridge University Press & Assessment][3])

Các đáp án sai không được lấy hoàn toàn ngẫu nhiên. Chúng nên cùng loại từ, cùng chủ đề và có quan hệ ý nghĩa gần với đáp án đúng. Nghiên cứu về tạo distractor cho câu hỏi từ vựng cũng sử dụng độ tương đồng ngữ nghĩa và thông tin collocation để xếp hạng đáp án sai. ([Springer Link][4])

---

# 2. Cốt truyện

Hệ thống dữ liệu của một công ty quốc tế bị lỗi trước giờ làm việc.

Mỗi phòng ban là một nhiệm vụ:

* Purchasing – Mua hàng
* Contracts – Hợp đồng
* Marketing – Tiếp thị
* Meetings – Cuộc họp
* Shipping – Vận chuyển
* Customer Service – Chăm sóc khách hàng
* Office Technology – Công nghệ văn phòng

Người chơi đóng vai nhân viên khôi phục dữ liệu. Mỗi câu trả lời đúng sẽ sửa một email, hóa đơn hoặc hồ sơ.

---

# 3. Luật chơi chính

## Một nhiệm vụ

Mỗi nhiệm vụ gồm **12 từ** và kéo dài khoảng 3–5 phút.

### Giai đoạn 1: Context Repair

Một câu TOEIC bị mất một từ:

> Please pay the attached ______ by Friday.

Các lựa chọn:

* invoice
* receipt
* warranty
* brochure

Người chơi chạm hoặc kéo từ vào chỗ trống.

Sau khi trả lời:

* Đúng: phát âm từ và hiển thị nghĩa ngắn.
* Sai: giải thích sự khác nhau giữa đáp án đúng và từ đã chọn.
* Từ sai được đưa vào **Repair Queue** để xuất hiện lại sau 2–4 câu.

Ví dụ phản hồi:

> **invoice** /ˈɪnvɔɪs/: hóa đơn yêu cầu thanh toán
> **receipt**: giấy xác nhận rằng tiền đã được thanh toán

Như vậy người chơi không chỉ biết đáp án mà còn hiểu tại sao đáp án còn lại sai.

---

### Giai đoạn 2: Recall Gate

Sau mỗi 3 câu, game mở một cửa kiểm tra không có lựa chọn.

Ví dụ:

> Hóa đơn yêu cầu thanh toán
> `i _ _ _ _ _ _`

Người chơi nhập:

> invoice

Có ba mức hỗ trợ:

1. Hiện chữ cái đầu.
2. Phát âm từ.
3. Hiện số ký tự.

Sử dụng gợi ý sẽ giảm điểm, nhưng không làm mất tiến độ học.

---

### Giai đoạn 3: Final Recovery

Cuối nhiệm vụ, game chọn lại ba từ yếu nhất:

* Từ đã trả lời sai.
* Từ trả lời quá chậm.
* Từ đã sử dụng gợi ý.
* Từ thường bị nhầm với một từ khác.

Phần này không có đáp án lựa chọn. Người chơi phải nhập từ tiếng Anh hoặc chọn từ sau khi nghe âm thanh.

Chỉ những từ vượt qua Final Recovery mới được đánh dấu là **đã nhớ trong phiên**.

---

# 4. Giao diện đề xuất

```text
┌────────────────────────────────────────────┐
│ DEADLINE DASH          Purchasing – 5/12   │
│ Data Integrity  ███████░░     Combo ×1.5   │
├────────────────────────────────────────────┤
│                                            │
│  🔊 Please pay the attached ______         │
│     by Friday.                             │
│                                            │
│  [ invoice ]       [ receipt ]             │
│  [ warranty ]      [ brochure ]            │
│                                            │
├────────────────────────────────────────────┤
│ Repair Queue: 2 từ       Điểm: 780          │
└────────────────────────────────────────────┘
```

Trên điện thoại, người chơi chỉ cần chạm đáp án. Trên máy tính có thể hỗ trợ phím `1–4`.

---

# 5. Hệ thống điểm

| Hành động              |                         Điểm |
| ---------------------- | ---------------------------: |
| Đúng ngay lần đầu      |                         +100 |
| Đúng trong Recall Gate |                         +150 |
| Đúng không dùng gợi ý  |                          +50 |
| Đúng liên tiếp         |              Combo tối đa ×2 |
| Dùng gợi ý             |        Không cộng điểm gợi ý |
| Trả lời sai            | 0 điểm, đưa vào Repair Queue |

Không nên trừ quá nhiều điểm khi sai vì mục tiêu chính là giúp người học nhận ra từ yếu.

## Xếp hạng nhiệm vụ

* **Bronze:** hoàn thành nhiệm vụ.
* **Silver:** đúng ít nhất 80%.
* **Gold:** đúng ít nhất 90% và vượt qua Final Recovery.
* **Perfect:** không sai, không dùng gợi ý.

Điểm số chỉ dùng tạo cảm giác chơi game. Trạng thái “đã thuộc” phải dựa trên lịch sử trả lời, không dựa vào tổng điểm.

---

# 6. Thuật toán chọn từ

Mỗi nhiệm vụ lấy từ theo tỷ lệ:

* 50%: từ đến hạn ôn hoặc từng trả lời sai.
* 30%: từ mới.
* 20%: từ đã học nhưng chưa chắc chắn.

Ví dụ nhiệm vụ 12 từ:

```text
6 từ yếu hoặc đến hạn ôn
4 từ mới
2 từ ngẫu nhiên đã học
```

## Ôn lại trong cùng phiên

| Kết quả               | Khi xuất hiện lại    |
| --------------------- | -------------------- |
| Sai                   | Sau 2 câu            |
| Đúng nhưng dùng gợi ý | Sau 4 câu            |
| Đúng nhưng chậm       | Trong Final Recovery |
| Đúng nhanh            | Phiên sau            |

## Ôn giữa các ngày

Cấu hình MVP có thể dùng:

```text
Lần 1 đúng: sau 1 ngày
Lần 2 đúng: sau 3 ngày
Lần 3 đúng: sau 7 ngày
Lần 4 đúng: sau 14 ngày
Lần 5 đúng: sau 30 ngày
```

Đây là lịch đơn giản để triển khai ban đầu, không phải một khoảng cách khoa học cố định cho mọi người.

---

# 7. Tạo đáp án sai thông minh

Đây là phần quan trọng nhất để tránh tình trạng đáp án quá dễ đoán.

Ví dụ từ đúng là `invoice`.

Không nên lấy các từ hoàn toàn không liên quan như:

```text
invoice
airport
happy
quickly
```

Nên dùng:

```text
invoice
receipt
warranty
contract
```

## Thứ tự chọn distractor

1. Cùng loại từ: noun, verb, adjective hoặc adverb.
2. Cùng chủ đề: Finance, Contracts, Meetings…
3. Gần mức độ khó hoặc tần suất.
4. Có nghĩa dễ nhầm.
5. Người dùng đã từng nhầm hai từ với nhau.
6. Không được tạo ra hai đáp án đều đúng với câu.

Dữ liệu nên bổ sung:

```json
{
  "rank": 120,
  "english": "invoice",
  "part_of_speech": "noun",
  "word_category": "finance",
  "confusion_group": [
    "receipt",
    "bill",
    "statement"
  ]
}
```

Không cần AI hoặc API trả phí để chạy thuật toán này. Có thể tạo distractor trực tiếp từ danh sách `part_of_speech`, `word_category` và lịch sử nhầm của người dùng.

---

# 8. Dữ liệu tiến độ cần lưu

```json
{
  "user_id": "user01",
  "dataset_id": "toeic_500",
  "word_rank": 120,
  "level": 2,
  "correct_count": 5,
  "wrong_count": 2,
  "correct_streak": 1,
  "average_time_ms": 4300,
  "hint_count": 1,
  "last_seen_at": "2026-07-12T10:00:00Z",
  "due_at": "2026-07-15T10:00:00Z",
  "confused_with": [145, 208]
}
```

Ban đầu có thể lưu bằng `localStorage`. Sau đó đồng bộ lên Cloudflare D1 để hai hoặc ba người dùng có tiến độ riêng.

---

# 9. Cấu trúc tích hợp vào dự án

```text
FlashCard/toeic-vocabulary/
├── games/
│   └── deadline-dash/
│       ├── index.html
│       ├── deadline-dash.css
│       ├── deadline-dash.js
│       ├── game-engine.js
│       ├── question-builder.js
│       ├── distractor-service.js
│       └── progress-service.js
├── shared/
│   ├── speech-service.js
│   ├── vocabulary-repository.js
│   └── storage-service.js
└── data/
```

Game nên dùng chung `speech-service` với flashcard, tránh tiếp tục duy trì hai hệ thống phát âm riêng như hạn chế đã được phát hiện ở trang hiện tại. 

---

# 10. Phạm vi phiên bản đầu tiên

Phiên bản MVP chỉ cần:

1. Chọn bộ từ và chủ đề.
2. Tạo 12 câu từ dữ liệu JSON.
3. Chọn đáp án trong câu ví dụ.
4. Tạo ba distractor cùng nhóm.
5. Đưa từ sai trở lại Repair Queue.
6. Recall Gate bằng nhập bàn phím.
7. Phát âm từ và câu.
8. Lưu tiến độ bằng `localStorage`.
9. Màn hình kết quả: đã nhớ, chưa nhớ, từ thường nhầm.

**Điểm nổi bật của Deadline Dash** là biến flashcard thụ động thành một vòng học gồm: hiểu trong ngữ cảnh → tự nhớ từ → sửa lỗi → ôn lại có khoảng cách. Các yếu tố điểm, combo và nhiệm vụ hỗ trợ động lực, nhưng không thay thế hoạt động nhớ lại thực sự; các tổng quan về gamification trong EFL/ESL cũng cho thấy gamification có thể hỗ trợ động lực và sự tham gia, đồng thời hiệu quả còn phụ thuộc cách thiết kế từng thành phần. ([Frontiers][5])

Bước tiếp theo phù hợp là triển khai bản MVP của **Deadline Dash** trực tiếp trong thư mục `FlashCard/toeic-vocabulary/`, sử dụng bộ JSON 500 từ hiện có.

[1]: https://pubmed.ncbi.nlm.nih.gov/18276894/?utm_source=chatgpt.com "The critical importance of retrieval for learning"
[2]: https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-expanding-and-equal-spacing-on-second-language-vocabulary-learning/D1D796306985C52F9BE7A1200AC50DB9?utm_source=chatgpt.com "EFFECTS OF EXPANDING AND EQUAL SPACING ON ..."
[3]: https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-learning-direction-in-retrieval-practice-on-efl-vocabulary-learning/159EE50F4B8835207764FB1B11077F29?utm_source=chatgpt.com "EFFECTS OF LEARNING DIRECTION IN RETRIEVAL ..."
[4]: https://link.springer.com/article/10.1186/s41039-018-0082-z?utm_source=chatgpt.com "Automatic distractor generation for multiple-choice English ..."
[5]: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.1030790/full?utm_source=chatgpt.com "Gamification in EFL/ESL instruction: A systematic review of ..."
