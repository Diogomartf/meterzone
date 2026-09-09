CREATE TABLE IF NOT EXISTS daily_events (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  page TEXT NOT NULL,
  placement TEXT NOT NULL,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, page, placement, source, device)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS rate_limits (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
