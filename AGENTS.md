# AGENTS.md — AutoParts Marketplace (Backend)

This file tells Codex how to work in this repository. Read it fully before generating or
changing code. Follow it for every task.

---

## 0. Current Status & Next Task  ← READ THIS FIRST

**Build order:** Buyer (done) -> Seller (done) -> Admin (done) -> Logistics (done)
-> Payments hardening (done) -> **Blog (current — FINAL MODULE)**.

**Completed**
- [x] Project skeleton (Section 3 layout)
- [x] **Buyer flow** — auth, catalogue browsing, cart & checkout, Paystack payment, order
      tracking & history
- [x] **Seller flow** — registration & CAC verification (Dojah), listing management, order
      management, inventory, sales & payouts
- [x] **Admin flow** — admin auth & RBAC, seller verification, category management,
      user/order oversight, payout approval, disputes & audit log
- [x] **Logistics** — L-A through L-E. All `// LOGISTICS-STUB` markers resolved.
- [x] **Payments hardening** — webhook is now the source of truth (signed, idempotent,
      server-side re-verification, reconciliation job). `callback_url` is redirect-only.

**NEXT TASK → Blog, Milestone B-A — migrations, models/repositories, seeds (Section 15).**
Build, in this order:
1. Migrations for `blog_categories`, `blog_tags`, `blog_posts`, `blog_post_tags`,
   `blog_comments`, `newsletter_subscribers`.
2. Repositories/models for each, following the Section 13 build recipe.
3. Seeds: 5 categories, ~12 published posts, 2 drafts, 1 future-scheduled, ~10 tags,
   ~6 comments (including one reply thread), 3 subscribers.

**Stop after B-A so I can run migrations and review.**

**After this:** B-B (public read endpoints) -> B-C (comments, newsletter, view counter)
-> B-D (admin CRUD + RBAC) -> B-E (sidebar featured listings, sanitization hardening,
rate limits, final test pass).

---

## 1. Project Summary  🔒 KEEP AS-IS

AutoParts Marketplace is a Nigerian B2B & B2C ecommerce platform for auto spare parts. It
connects buyers (car owners, mechanics, fleet operators) with sellers (dealers, distributors,
vendors), with an integrated logistics layer.

This repository is the **backend API only** (no frontend). It is consumed by a responsive web
client.

All core modules are complete. The blog is the final module.

---

## 2. Tech Stack  🔒 KEEP AS-IS
## 3. Folder Layout  🔒 KEEP AS-IS
## 4. Environment & Configuration  🔒 KEEP AS-IS
## 5. Database & Migration Rules  🔒 KEEP AS-IS

> Keep your existing content for 2–5. If Section 4 lists env vars, confirm the Paystack
> keys and `APP_URL` are documented there.

---

## 6. Modules  🔒 KEEP AS-IS (6A Buyer, 6B Seller, 6C Admin, 6D Logistics)

All four are complete. Do not rebuild them. Read them for conventions and for the service
interfaces the blog and payment flows depend on.

---

## 7. Authentication & RBAC  🔒 KEEP AS-IS
## 8. API Conventions  🔒 KEEP AS-IS

> Section 8 defines the pagination envelope and error envelope. **Every new endpoint must
> match it exactly.** If it isn't written down yet, write it down now — the blog task depends
> on it.

---

## 9. Validation  🔒 KEEP AS-IS
## 10. Error Handling & Logging  🔒 KEEP AS-IS
## 11. Media & File Uploads  🔒 KEEP AS-IS
## 12. Testing  🔒 KEEP AS-IS

---

## 13. Build Recipe  🔒 KEEP AS-IS

migration -> repository -> service -> validator -> controller -> route -> tests, then confirm
tests pass.

---

## 14. Payments (Paystack) — INVARIANTS

**Do not modify any of the following without an explicit instruction to do so.** These were
fixed deliberately; reversing them silently breaks live payment confirmation.

- **The signed webhook is the source of truth.** `POST /webhooks/paystack`. `callback_url` is
  a browser redirect for UX only and must never be the sole payment signal.
- **`express.raw({ type: "application/json" })` is mounted on `/webhooks/paystack` BEFORE
  `express.json()`.** Reordering — including when registering new routers — breaks HMAC
  signature verification. Any task that touches `app.js`/`server.js` must preserve this.
- **The webhook route is public.** No JWT, no RBAC, no CSRF, no tenant guard. Paystack does
  not send your token.
- **Signature verification:** HMAC-SHA512 over the raw body with `PAYSTACK_SECRET_KEY`,
  compared to `x-paystack-signature` via `crypto.timingSafeEqual`.
- **Respond 200 immediately**, then process.
- **Idempotency:** every event is recorded in `payment_webhook_events`. Never fulfil an order
  twice — Paystack retries.
- **Always re-verify server-side** with `GET /transaction/verify/:reference` before fulfilling.
  Never trust the webhook payload's amount or status.
- **Amounts are integers in kobo.** ₦25,000 is `2500000`. Never floats, never naira.
- **Fulfilment is one shared idempotent path**, used by both the webhook and
  `GET /payments/verify/:reference`. Whichever arrives first wins; the second is a no-op.
- On successful fulfilment: mark payment `success`, advance order status, decrement inventory,
  notify the seller, and **create the delivery job via the real logistics service** (logistics
  is complete — do not stub).
- A reconciliation job settles or expires payments stuck `pending` beyond ~15 minutes.
- Never log the secret key or full request headers.

**Dashboard note:** the webhook URL must be configured separately in Paystack **test** and
**live** modes: `https://<railway-domain>/webhooks/paystack`. Localhost cannot receive
webhooks.

---

## 15. Blog Module

Public-facing blog. Three client pages: **List**, **Grid**, **Detail** (Figma exists). List and
Grid share one endpoint. Backend-only; no SSR, no templating.

**Tables:** `blog_categories`, `blog_tags`, `blog_posts`, `blog_post_tags`, `blog_comments`,
`newsletter_subscribers`.

**Public visibility scope — write once, never duplicate the condition:**
```
status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()
```

**Public routes (no auth)**
- `GET /blog/posts` — `page`, `per_page` (default 9, max 50), `category`, `tag`, `search`,
  `sort`. No `body` field in list items.
- `GET /blog/posts/:slug` — full post + `comment_count` (approved only). 404 (never 403) for
  draft, archived, or future-dated.
- `GET /blog/posts/:slug/related` — up to 3, same category, backfilled with recent.
- `GET /blog/categories` — with `post_count`, one grouped query, no N+1.
- `GET /blog/tags/popular`
- `GET /blog/posts/:slug/comments` — approved only, threaded one level deep.
- `POST /blog/posts/:slug/comments` — no login required.
- `POST /blog/posts/:slug/view` — 204, rate-limited per IP per post.
- `POST /newsletter/subscribe`, `GET /newsletter/unsubscribe/:token`

**Admin routes** (existing auth + RBAC guard, permissions named per Section 7)
- `/admin/blog/posts` — CRUD + `publish` / `unpublish`
- `/admin/blog/categories`, `/admin/blog/tags` — CRUD
- `/admin/blog/comments` — approve / spam / delete
- `/admin/newsletter/subscribers` — list + CSV export

**Invariants**
- Slugs are **immutable once published** (live URLs) unless explicitly overridden by an admin
  flag. Redirects are the client's concern.
- **`body` is sanitized HTML on write** — allowlist only (`h2 h3 h4 p strong em u ul ol li a
  img blockquote figure figcaption br hr`), `rel="noopener noreferrer"` forced on external
  links. Never store raw admin HTML.
- `read_time_minutes` computed at save (~200 wpm, min 1); stored, not recomputed per request.
- `excerpt` derived from the first ~200 chars of stripped body when omitted.
- Comments default to `pending`. **Public responses must never expose `author_email` or
  `ip_address`** — enforced in a serializer, not by query selection.
- Comment counts are approved-only. Replies are one level deep; reply-to-reply is rejected.
- Spam defences (no auth exists): pending default, per-IP rate limit, honeypot accepted and
  silently discarded, ~2000 char cap, reject link-only bodies.
- Search uses MySQL FULLTEXT boolean mode; falls back to `LIKE` under 3 chars. Escape
  boolean operators in user input.
- **Sidebar "Featured Listings" reuses the existing product repository and DTO.** The blog
  must not duplicate product data.
- Scheduled posts (future `published_at` + `status=published`) stay hidden until due.
- Public author exposure is display name + avatar only.
- Timestamps stored UTC; clients render `Africa/Lagos`.
- Featured images use the **existing** upload handler (Section 11). No second upload path.

**Milestones:** B-A schema/seeds -> B-B public reads -> B-C comments/newsletter/views
-> B-D admin CRUD + RBAC -> B-E sidebar listings, sanitization, rate limits, final tests.

---

## 16. General Rules  🔒 KEEP AS-IS

> If you have a final "rules / do not do" section, keep it and append this line:
> - Never reorder middleware in `app.js`/`server.js` without checking Section 14.


