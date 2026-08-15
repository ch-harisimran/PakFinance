# Supabase email templates

Paste each block into **Supabase → Authentication → Emails**, in the matching
tab. Kept here so they are version-controlled rather than living only in a
dashboard nobody diffs.

## Why these look the way they do

Email is not the web. Every template below obeys four constraints that the app
itself does not:

- **Tables, not flex or grid.** Outlook renders through Word's HTML engine and
  ignores modern layout entirely.
- **Inline styles, hardcoded hex.** No CSS custom properties — `var(--brass)`
  resolves to nothing in every mail client, so the palette is written out
  literally. Values match `design/tokens.css`; if the brand colour changes,
  change it here too.
- **System fonts.** Instrument Serif and Manrope will not load, so the wordmark
  falls back to a serif stack and the rest to the system UI font.
- **A light-mode fallback.** Some clients (notably Gmail on Android) forcibly
  invert dark palettes. Text colours are chosen to stay legible either way.

The code block uses `letter-spacing` rather than six separate boxes: a table of
cells is what breaks first in Outlook, and a spaced monospace string reads just
as clearly.

---

## 1. Confirm signup

Supabase issues a **6-digit** token. `components/auth/OtpOrbit.tsx` is currently
built for **4 slots** — set `SLOTS = 6` there, and retune `TURN` from `450` to
`420` (360° plus one seat, where a seat is 60° on a six-slot ring).

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0B0D;padding:40px 16px">
  <tr>
    <td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#101318;border:1px solid #1E212A;border-radius:16px">
        <tr>
          <td style="padding:36px 32px 0">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#EAE7E0">PakFinance</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0">
            <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A227">Verify your email</div>
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#B4B0A8;padding-top:14px">
              Enter this code to finish creating your account. It expires in ten minutes.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 0">
            <div style="background:#181B22;border:1px solid #4A3F14;border-radius:12px;padding:20px;text-align:center;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#EAE7E0">{{ .Token }}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 36px">
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#65625C">
              If you didn't request this, ignore this email — no account will be created.
            </div>
          </td>
        </tr>
      </table>
      <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#4A4842;padding-top:20px">
        PakFinance · a personal finance tracking tool. Not investment advice.
      </div>
    </td>
  </tr>
</table>
```

---

## 2. Reset password

Also a code, so the reset flow can stay inside the app instead of bouncing
through a link. **A `/forgot-password` page does not exist yet** — the login
screen links to it, so that route needs building before this template is
reachable.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0B0D;padding:40px 16px">
  <tr>
    <td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#101318;border:1px solid #1E212A;border-radius:16px">
        <tr>
          <td style="padding:36px 32px 0">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#EAE7E0">PakFinance</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0">
            <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A227">Reset your password</div>
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#B4B0A8;padding-top:14px">
              Use this code to set a new password. It expires in ten minutes.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 0">
            <div style="background:#181B22;border:1px solid #4A3F14;border-radius:12px;padding:20px;text-align:center;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#EAE7E0">{{ .Token }}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 36px">
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#65625C">
              Didn't ask for this? Your password is unchanged and your account is safe — you can ignore this email.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## 3. Magic Link

Kept as a link, because that is the whole point of this one. Unused while
signup uses a code, but Supabase falls back to it in some flows.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0B0D;padding:40px 16px">
  <tr>
    <td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#101318;border:1px solid #1E212A;border-radius:16px">
        <tr>
          <td style="padding:36px 32px 0">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#EAE7E0">PakFinance</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0">
            <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A227">Sign in</div>
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#B4B0A8;padding-top:14px">
              Tap below to sign in to PakFinance. The link works once and expires in an hour.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#C9A227;border-radius:999px">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 26px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;color:#0A0B0D;text-decoration:none">Sign in to PakFinance</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 36px">
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#65625C">
              If the button doesn't work, paste this into your browser:<br>
              <span style="color:#8E8A80;word-break:break-all">{{ .ConfirmationURL }}</span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## 4. Change email address

Sent to **both** the old and new addresses, so the copy names them explicitly —
otherwise the recipient cannot tell which side of the change they are on.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0B0D;padding:40px 16px">
  <tr>
    <td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#101318;border:1px solid #1E212A;border-radius:16px">
        <tr>
          <td style="padding:36px 32px 0">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#EAE7E0">PakFinance</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0">
            <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A227">Confirm email change</div>
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#B4B0A8;padding-top:14px">
              Confirming the change from <span style="color:#EAE7E0">{{ .Email }}</span> to <span style="color:#EAE7E0">{{ .NewEmail }}</span>.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 0">
            <div style="background:#181B22;border:1px solid #4A3F14;border-radius:12px;padding:20px;text-align:center;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#EAE7E0">{{ .Token }}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 36px">
            <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#65625C">
              If you didn't request this, someone may have access to your account — sign in and change your password.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Subject lines

| Template | Subject |
|---|---|
| Confirm signup | `{{ .Token }} is your PakFinance code` |
| Reset password | `{{ .Token }} — reset your PakFinance password` |
| Magic link | `Sign in to PakFinance` |
| Change email | `Confirm your new email address` |

Leading with the code means it shows in the notification preview, so on a phone
it can often be read without opening the email at all.

## After pasting

1. **Authentication → Providers → Email → Confirm email → on**
2. Sign up at `/signup` with a real address
3. If nothing arrives, check **Brevo → Transactional → Logs** — it distinguishes
   a rejected send from an unverified sender or an unactivated account
