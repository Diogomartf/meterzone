-- Run with: bunx wrangler d1 execute meterzone-website-analytics --remote --file analytics.sql
-- Events are counts, not unique visitors or confirmed app installs.
SELECT
  event, page, placement AS button, source, device,
  SUM(count) AS events
FROM daily_events
WHERE day >= date('now', '-27 days')
GROUP BY event, page, placement, source, device
ORDER BY events DESC;
