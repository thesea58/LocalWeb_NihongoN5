ALTER TABLE vocabulary_progress ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary_progress ADD COLUMN last_reviewed_at TEXT;
ALTER TABLE vocabulary_progress ADD COLUMN last_result TEXT;
ALTER TABLE vocabulary_progress ADD COLUMN last_review_mode TEXT;
ALTER TABLE vocabulary_progress ADD COLUMN last_response_ms INTEGER;
ALTER TABLE vocabulary_progress ADD COLUMN interval_days REAL NOT NULL DEFAULT 0;
ALTER TABLE vocabulary_progress ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;

CREATE TABLE IF NOT EXISTS review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  dataset_id TEXT NOT NULL,
  word_rank INTEGER NOT NULL,
  review_result TEXT NOT NULL CHECK (review_result IN ('forgot', 'hard', 'good', 'easy')),
  review_mode TEXT NOT NULL DEFAULT 'flashcard',
  response_ms INTEGER,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  previous_interval_days REAL,
  next_interval_days REAL NOT NULL,
  previous_ease_factor REAL,
  next_ease_factor REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_events_user_dataset_created
ON review_events(user_id, dataset_id, created_at);

CREATE INDEX IF NOT EXISTS idx_review_events_word
ON review_events(user_id, dataset_id, word_rank, created_at);
