# message_log: outbound WhatsApp and OTP audit trail

Every outbound WhatsApp message (OTPs, payment and savings notices, reminders, wishes, broadcasts, ops alerts) and every OTP email gets one row, whether it was sent or failed. Rows are written by `recordMessage()` in `src/utils/messageLog.ts`. Writing a row is best-effort: if the insert fails, the error is logged and the message still goes out.

OTP codes are **never** stored. For WhatsApp OTPs, `body` holds only the template name (`template:kv_otp`).

## DDL (apply once, idempotent)

```sql
CREATE TABLE IF NOT EXISTS message_log (
  id                  BIGSERIAL PRIMARY KEY,
  channel             VARCHAR(20)  NOT NULL,   -- 'whatsapp' | 'email'
  kind                VARCHAR(60)  NOT NULL,   -- e.g. otp_login, otp_enroll_confirm, payment_success, broadcast
  recipient           VARCHAR(320) NOT NULL,   -- WhatsApp: number as sent to Meta (91XXXXXXXXXX); email: address
  status              VARCHAR(20)  NOT NULL,   -- 'sent' | 'failed'
  provider_message_id VARCHAR(255),            -- Meta wamid, when sent
  body                TEXT,                    -- message text; template name for OTPs
  error               TEXT,                    -- failure reason, when failed
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_log_created_at ON message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_recipient ON message_log (recipient);
```

## `kind` values

| kind | Sent when |
|---|---|
| `otp_login` | Mobile-number login code (WhatsApp, or email when WhatsApp OTP is off) |
| `otp_phone_verify` | Phone verification after signup / from Profile |
| `otp_enroll_confirm` | Savings-scheme enrollment confirmation |
| `otp_password_reset` | Password reset code (email) |
| `payment_success` | Order payment confirmed |
| `savings_payment_success` | Savings installment recorded |
| `savings_reminder_day1` / `_day5` / `_day10` / `_missed` | Installment due / overdue reminders |
| `diwali_scheme_dropped` | Diwali scheme discontinued for missed payments |
| `diwali_scheme_completed` | Ops alert: Diwali scheme ready for redemption |
| `diwali_redemption_ready` | Customer: Diwali redemption computed |
| `birthday_wish` / `anniversary_wish` | Daily wishes |
| `broadcast` | Admin broadcast |
| `rate_update_reminder` / `rate_update_success` | Ops alerts for the daily metal-rate guard |

## Example report queries

```sql
-- Everything sent to one customer (any number format)
SELECT created_at, channel, kind, status, error
FROM message_log WHERE recipient LIKE '%8190858375' ORDER BY created_at DESC;

-- Daily counts by kind and status for a month
SELECT created_at::date AS day, kind, status, count(*)
FROM message_log
WHERE created_at >= '2026-09-01' AND created_at < '2026-10-01'
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
```
