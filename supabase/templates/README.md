# Supabase auth email templates

Branded templates for Supabase Auth emails (sent via Resend from `no-reply@thediveclub.org`).
Paste each file's full HTML into **Supabase → Authentication → Emails → Templates**, with the subject below.
These files are the record; the dashboard is where they actually live.

## Templates and subjects

| File | Supabase template | Subject |
|---|---|---|
| `confirmation.html` | Confirm sign up | Confirm your email. |
| `recovery.html` | Reset password | Reset your password. |
| `email_change.html` | Change email address | Confirm your new email. |
| `reauthentication.html` | Reauthentication | Your verification code. |
| `password_changed_notification.html` | Password changed (security notification) | Your password was changed. |
| `email_changed_notification.html` | Email address changed (security notification) | Your account email was changed. |
| `identity_linked_notification.html` | Sign-in method linked (security notification) | A sign-in method was added. |
| `identity_unlinked_notification.html` | Sign-in method removed (security notification) | A sign-in method was removed. |

Not used (left as Supabase defaults): Invite user, Magic link, phone changed, MFA added/removed.

## Images (must be live on the site before testing)

- `src/resources/branding/email-dive.gif`: diver animation, 560 × 1200, loops (starts on the logo pose, 1 s pause between drops)
- `src/resources/branding/email-wordmark.png`: wordmark shown behind the GIF, 1200 px wide

Both are referenced by full `https://thediveclub.org/resources/branding/...` URLs.

## Layout notes

- Diver GIF: 200 px wide on desktop, 60% of the email width on phones (`@media (max-width: 600px)`).
- Wordmark: background of the GIF's box, `background-size: contain`. The box is the card width (up to 600 px) on desktop and the GIF width on phones.
- Inboxes that strip `<style>` keep the desktop sizes. Older Outlook desktop shows the GIF's first frame (the logo pose) without the wordmark.
- `{{ .Data.display_name }}` can be empty (Google signups): the greeting falls back to "Hi there,".
- `{{ .Provider }}` arrives lowercase (e.g. `google`) and is capitalised with CSS.
