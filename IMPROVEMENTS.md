# Mamma's Place — Improvements & Roadmap

## Resume-Worthy Enhancements

### 1. Google Analytics (GA4) — Direct Integration ✅ DONE
Added GA4 via `@next/third-parties/google` with full e-commerce event tracking.
- [x] Add GA4 measurement ID via `@next/third-parties/google`
- [x] Track custom events: add-to-cart, checkout-start, order-complete, promo-code-applied
- [x] Track product views and category browsing
- [x] E-commerce event tracking (view_item, add_to_cart, begin_checkout, purchase)
- [ ] Set up conversion funnels (browse > cart > checkout > purchase) — configure in GA4 dashboard
- [ ] UTM parameter support for marketing campaigns
- [ ] Dashboard with real user behavior data to show in interviews

### 2. Real Authentication & Authorization
Replace hardcoded credentials with a proper auth system:
- [ ] Integrate **NextAuth.js** (or Clerk/Auth0) for OAuth + credentials
- [ ] Google/GitHub social login
- [ ] Password hashing (bcrypt)
- [ ] JWT or session-based tokens
- [ ] Protected API routes with middleware
- [ ] User registration and profile pages
- [ ] Role-based access control (customer, staff, admin) with middleware guards

### 3. Real Database — Neon PostgreSQL (Free Tier: 512 MB)
Replace JSON file storage with a proper database:
- [ ] Set up **Neon** PostgreSQL (free tier, serverless, Vercel integration)
- [ ] **Prisma ORM** for type-safe queries and migrations
- [ ] Schema: Users, Products, Orders, Reviews, CartItems
- [ ] Database migrations and seeding (migrate existing JSON product data)
- [ ] Indexed queries for search and filtering
- [ ] Connection pooling via Neon's serverless driver

### 3b. Cloud Storage — Cloudinary (Free Tier: 25 GB)
Move images (8.3 MB, 360 files) and audio (1.4 GB) out of git into cloud storage:
- [ ] Set up **Cloudinary** account (free 25 GB — handles all current files with room to grow)
- [ ] Upload all product images to Cloudinary
- [ ] Upload all audio files (podcasts, audiobooks) to Cloudinary
- [ ] Update product data to use Cloudinary URLs instead of local `/public/` paths
- [ ] Remove images and audio from git repo (clean git history with `git filter-repo`)
- [ ] Use Cloudinary auto-optimization for images (WebP, responsive sizing)
- [ ] This is how real production sites work — files on a CDN, not in the repo

### 4. API & Data Layer
- [ ] Move from file reads to database queries in API routes
- [ ] Input validation with **Zod** on all API endpoints
- [ ] Proper HTTP status codes and error responses
- [ ] Rate limiting on sensitive endpoints (login, checkout)
- [ ] API response pagination for product listings
- [ ] Search with full-text or fuzzy matching

### 5. Testing — Automated
- [ ] Write **Playwright E2E tests** (framework is installed but no test files exist)
  - Happy path: browse > add to cart > checkout > confirmation
  - Auth flows: portal login, admin login, passcode gate
  - Edge cases: empty cart checkout, invalid promo codes, out-of-stock
- [ ] Add **unit tests** with Vitest for cart logic, promo code validation, product filtering
- [ ] Add **component tests** with React Testing Library
- [ ] Code coverage reporting

### 6. CI/CD Pipeline
- [ ] **GitHub Actions** workflow:
  - Lint on PR
  - Type-check on PR
  - Run tests on PR
  - Build verification
  - Auto-deploy to Vercel on merge to main
- [ ] Branch protection rules on main
- [ ] PR template with checklist

### 7. Search & Filtering
- [ ] Debounced search with URL query params (shareable search URLs)
- [ ] Search suggestions / autocomplete
- [ ] Price range filter (min/max slider)
- [ ] Multi-select category filtering
- [ ] "No results" state with suggestions
- [ ] Search results highlighting

### 8. User Accounts & Order History
- [ ] User registration and login
- [ ] Persistent cart (synced to account, not just localStorage)
- [ ] Order history page with order details
- [ ] Order confirmation emails (Resend or SendGrid)
- [ ] Wishlist / saved items
- [ ] Address book for repeat checkout

### 9. Payment Integration (Stripe — Free in Test Mode)
- [ ] **Stripe** test-mode checkout (shows real payment integration skills)
- [ ] Payment intent API route
- [ ] Stripe Elements for card input
- [ ] Webhook handler for order confirmation
- [ ] Receipt generation
- [ ] Error handling for all decline scenarios

**Stripe test mode is 100% free** — no credit card required, no time limit.

| Test Card | Scenario |
|-----------|----------|
| `4242 4242 4242 4242` | Always succeeds |
| `4000 0000 0000 0002` | Card declined (generic) |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 9987` | Lost card |
| `4000 0000 0000 9979` | Stolen card |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |
| `4000 0000 0000 0119` | Processing error |
| `4000 0000 0000 3220` | 3D Secure required (succeeds) |
| `4000 0000 0000 3063` | 3D Secure required (fails) |

Use any future expiry date, any 3-digit CVC, any ZIP code.

### 10. Performance & SEO
- [ ] Dynamic `<meta>` tags and Open Graph for product pages
- [ ] Structured data (JSON-LD) for products (rich Google results)
- [ ] Image optimization — convert product images to WebP, use `next/image` with proper sizing
- [ ] Lazy loading for below-fold content
- [ ] Sitemap generation (`next-sitemap`)
- [ ] robots.txt configuration

### 11. Accessibility (WCAG 2.1 AA)
- [ ] Keyboard navigation audit and fixes
- [ ] Screen reader testing (NVDA or VoiceOver)
- [ ] Focus management on modals and route changes
- [ ] Skip-to-content link
- [ ] Color contrast audit (purple theme may need tweaks)
- [ ] Form error announcements with aria-live regions

### 12. UI/UX Polish
- [ ] Loading skeletons on all data-fetching pages (some exist, extend to all)
- [ ] Toast notifications for all actions (add to cart, remove, errors)
- [ ] Product image zoom on hover/click
- [ ] Breadcrumb navigation
- [ ] Recently viewed products
- [ ] "Back to top" button
- [ ] Empty state designs (empty cart, no search results, no products in category)
- [ ] 404 and error pages with branding

### 13. DevOps & Monitoring
- [ ] Error tracking with **Sentry**
- [ ] Environment variables for all secrets (no hardcoded credentials)
- [ ] Health check endpoint (`/api/health`)
- [ ] Logging strategy (structured logs)
- [ ] Uptime monitoring

### 14. Documentation
- [ ] Rewrite README with:
  - Project description and screenshots
  - Tech stack badges
  - Local setup instructions
  - Environment variables guide
  - Architecture diagram
  - API documentation
- [ ] Contributing guide
- [ ] Changelog

---

## Priority Order (What to Tackle First)

| Priority | Item | Effort | ROI | Why |
|----------|------|--------|-----|-----|
| ~~1~~ | ~~GA4 Direct Integration~~ | ~~Small~~ | ~~High~~ | ✅ DONE — tracking page views, product views, cart events, checkout, purchases |
| 2 | Database — Neon PostgreSQL | Large | High | Foundation for everything else. Free 512 MB. |
| 3 | Cloud Storage — Cloudinary | Medium | High | 1.4 GB audio + 8.3 MB images don't belong in git. Free 25 GB. |
| 4 | Real Auth (NextAuth.js) | Large | High | Replaces biggest security gap, high interview impact |
| 5 | Automated Tests | Medium | High | Shows engineering maturity, Playwright already installed |
| 6 | CI/CD Pipeline | Small | High | GitHub Actions: lint, type-check, test on every PR |
| 7 | Stripe Integration | Medium | High | Most impressive demo feature — real payment forms |
| 8 | README Rewrite | Small | High | First thing recruiters see on GitHub |
| 9 | SEO & Performance | Small | Medium | Meta tags, sitemaps, structured data |
| 10 | Sentry Error Tracking | Small | Medium | Shows observability mindset |
| 11 | User Accounts & Orders | Large | Medium | Depends on Auth + DB being done first |
