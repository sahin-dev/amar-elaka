# Manual test checklist

Run on: (1) a low-end Android phone (Chrome, 360 px wide) with DevTools "Slow 3G" / real mobile data, (2) iPhone Safari, (3) desktop Chrome/Firefox at 1366 px, (4) keyboard only, (5) a screen reader (TalkBack / VoiceOver / NVDA). Test in **both Bangla and English**.

## Navigation & shell
- [ ] Bottom nav visible on mobile with central Report button; header nav on desktop.
- [ ] "Skip to main content" appears on first Tab and works.
- [ ] Language toggle switches every visible string; numbers/dates show Bangla digits in Bangla.
- [ ] Offline: toggle airplane mode → offline banner; actions show network errors with retry.
- [ ] Footer shows the 999 emergency disclaimer.

## Explore
- [ ] Map loads with tiles and markers; pan/zoom updates the list and summary (no request flood — debounced).
- [ ] Category chips and Open/Resolved/All filters change both markers and list.
- [ ] Area search (try "mir", "মিরপুর") jumps the map; ↑/↓/Enter/Escape work.
- [ ] "Use my location": allow → map flies to you and distances update; deny → friendly message.
- [ ] Mobile Map/List switch; bottom sheet scrolls; "Show list" works.
- [ ] Empty area shows the empty state with a Report action; server down shows error + retry.
- [ ] "Load more" appends without duplicates.
- [ ] Copy the URL after moving the map; opening it restores the view.

## Report
- [ ] Signed out → sign-in prompt; after sign-in returns to /report.
- [ ] Submitting empty → errors announced and focused; category/title/location flagged.
- [ ] Phone number / email / link in text → rejected with explanation.
- [ ] Tap map to place pin; drag adjusts; dashed box shows the public cell; manual coordinates work.
- [ ] Photo: camera opens on mobile; >5 MB/unsupported type rejected; preview + remove work.
- [ ] Download the published photo after approval and confirm it has **no EXIF/GPS** (e.g. exiftool).
- [ ] Report near an existing open report of the same type → duplicate warning; "submit anyway" works.
- [ ] Success screen shows next steps, link and share.

## Issue detail
- [ ] Map shows a circle, not a precise pin; text explains the approximation.
- [ ] Confirm present (as another user) → count increases; repeat → "already responded".
- [ ] Reporter can't confirm own report.
- [ ] Guest "appears fixed" → asked to sign in.
- [ ] Two different accounts report fixed → "Community-reported resolved" (never "officially resolved"); two new confirmations reopen it.
- [ ] Flag dialog: keyboard focus trapped in dialog, Escape closes, reasons selectable, success message.
- [ ] Freshness label changes for old reports ("Possibly outdated").
- [ ] Shared link preview in WhatsApp shows title/description.

## Areas
- [ ] /areas lists cities and counts; /areas/<slug> shows counts, lists, category bars.
- [ ] Share button: native share on mobile, copy on desktop; WhatsApp/Facebook links open.
- [ ] Paste area URL into a messaging app → share card image appears.

## Moderation (as moderator)
- [ ] Resident visiting /moderation sees "moderator access required"; anonymous is redirected to sign in.
- [ ] Queues show pending, flagged, duplicates, review, photos.
- [ ] Approve/reject photo; approved photo appears publicly, rejected one is gone.
- [ ] Hide → public 404; reporter still sees it with a notice; Approve restores.
- [ ] Merge into another ID → merged notice with link.
- [ ] Archive/Restore return to the previous status. Each action appears in the audit log with the internal note (note never visible publicly).
- [ ] Exact location visible to moderators only.

## Account
- [ ] Update display name/language.
- [ ] My reports list shows visibility states.
- [ ] Download data → JSON without password hash.
- [ ] Delete account (wrong password rejected) → signed out; with "remove reports", reports disappear publicly.

## Accessibility
- [ ] All interactive elements reachable by keyboard with visible focus.
- [ ] Screen reader announces form errors, vote results, list counts.
- [ ] Text contrast ≥ 4.5:1 (check status badges and grey text) and zoom to 200% without loss of content.
- [ ] `prefers-reduced-motion` disables shimmer/animations.
