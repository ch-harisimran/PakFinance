-- PSX trading sessions, Asia/Karachi (UTC+5, no DST).
--
-- In a table rather than in code because PSX shortens hours through Ramadan
-- every year and closes for Eid, Ashura and Independence Day. Hardcoded hours
-- are wrong for roughly a month a year and silently wrong on every holiday.
--
--   Mon–Thu   09:30 – 15:30   (one session)
--   Fri       09:30 – 12:00   (session 1, breaks for Jumu'ah)
--             14:30 – 16:30   (session 2)

INSERT INTO "market"."sessions" ("weekday", "seq", "opens_at", "closes_at", "label") VALUES
  (1, 1, '09:30', '15:30', 'Monday'),
  (2, 1, '09:30', '15:30', 'Tuesday'),
  (3, 1, '09:30', '15:30', 'Wednesday'),
  (4, 1, '09:30', '15:30', 'Thursday'),
  (5, 1, '09:30', '12:00', 'Friday morning'),
  (5, 2, '14:30', '16:30', 'Friday afternoon')
ON CONFLICT ("weekday", "seq") DO UPDATE
  SET "opens_at" = EXCLUDED."opens_at",
      "closes_at" = EXCLUDED."closes_at",
      "label"     = EXCLUDED."label";
--> statement-breakpoint

-- Fixed-date national holidays. Islamic-calendar dates (Eid al-Fitr, Eid
-- al-Adha, Ashura, Eid Milad un-Nabi) shift each year and are announced by PSX,
-- so they are added as they are notified rather than computed.
INSERT INTO "market"."market_holidays" ("holiday_date", "reason") VALUES
  ('2026-02-05', 'Kashmir Day'),
  ('2026-03-23', 'Pakistan Day'),
  ('2026-05-01', 'Labour Day'),
  ('2026-08-14', 'Independence Day'),
  ('2026-12-25', 'Quaid-e-Azam Day / Christmas')
ON CONFLICT ("holiday_date") DO NOTHING;
