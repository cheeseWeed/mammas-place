# Manual Test Scenarios - Portal Authentication

**Test Environment:** http://localhost:3000
**Test Date:** 2026-02-21
**Purpose:** Verify portal and admin authentication separation

---

## Pre-Test Setup

1. Open a web browser (Chrome, Edge, or Firefox)
2. Clear all localStorage for localhost:3000
   - Open DevTools (F12)
   - Go to Application/Storage tab
   - Clear Local Storage
3. Ensure dev server is running: `npm run dev`

---

## Test Scenario 1: Manager Portal Login

**Objective:** Verify manager can log into portal and lands on correct dashboard

### Steps

1. Navigate to: `http://localhost:3000/portal`
2. Verify page shows:
   - Title: "Mamma's Place"
   - Subtitle: "Staff Portal" (in purple)
   - Login form with username/password fields

3. Enter credentials:
   - Username: `manager`
   - Password: `manager`

4. Click "Sign In" button

5. Wait for page to load

### Expected Results

✅ **PASS if:**
- Redirected to: `http://localhost:3000/portal/dashboard`
- Header shows: "Mamma's Place Staff Portal"
- Header shows: "Manager Dashboard"
- Welcome message: "Welcome back, Store Manager"
- "Manager Tools" section is visible
- Promo codes section is visible
- Sign Out button is visible in top-right

❌ **FAIL if:**
- Redirected to `/admin` or `/admin/dashboard`
- Page shows "Admin Portal" branding
- Page shows product management table

### Notes

Record actual URL after login: ___________________________

Record branding text in header: ___________________________

---

## Test Scenario 2: Portal Sign-Out

**Objective:** Verify sign-out clears session and redirects correctly

### Prerequisites

- Completed Test Scenario 1 (logged in as manager)
- Currently on `/portal/dashboard`

### Steps

1. Locate "Sign Out" button in top-right of header
2. Click "Sign Out"
3. Wait for page to load

### Expected Results

✅ **PASS if:**
- Redirected to: `http://localhost:3000/portal`
- Portal login page displays
- No user information visible in header
- Cannot navigate back to `/portal/dashboard` without logging in again

❌ **FAIL if:**
- Still on dashboard
- User information still visible
- Can access dashboard by refreshing page

### Verification

1. Try to navigate directly to: `http://localhost:3000/portal/dashboard`
2. Should be redirected back to `/portal` login page

---

## Test Scenario 3: Admin Access While Portal-Authenticated

**Objective:** Verify portal authentication does NOT grant admin access

### Prerequisites

- Log into portal as manager (see Test Scenario 1)
- Currently on `/portal/dashboard`

### Steps

1. In URL bar, navigate to: `http://localhost:3000/admin`
2. Wait for page to load
3. Observe page content

### Expected Results

✅ **PASS if:**
- Admin login page displays
- Title shows: "Admin Portal"
- Subtitle shows: "System Administration"
- Login form requires credentials
- Portal session is still active (check localStorage)

❌ **FAIL if:**
- Admin dashboard displays immediately
- Product management table is visible
- No login required

### Verification - Check localStorage

1. Open DevTools (F12)
2. Go to Application → Local Storage → http://localhost:3000
3. Should see:
   - Key: `mammas-place-auth` (value: manager session)
   - Key: `mammas-place-admin-auth` should NOT exist

---

## Test Scenario 4: Admin Login (Separate from Portal)

**Objective:** Verify admin login works with admin credentials

### Prerequisites

- Portal may or may not be authenticated (doesn't matter)

### Steps

1. Navigate to: `http://localhost:3000/admin`
2. Verify page shows:
   - Title: "Admin Portal"
   - Subtitle: "System Administration" (in gray)

3. Enter credentials:
   - Username: `admin`
   - Password: `admin`

4. Click "Sign In" button

### Expected Results

✅ **PASS if:**
- Redirected to: `http://localhost:3000/admin/dashboard`
- Header shows: "Mamma's Place Admin Portal"
- Header shows: "Product Management Dashboard"
- Product table is visible
- "Upload Images" button visible
- Sign Out button visible

❌ **FAIL if:**
- Redirected to `/portal/dashboard`
- Shows "Staff Portal" branding
- Shows manager tools instead of product table

### Notes

Record actual URL after login: ___________________________

Record branding text in header: ___________________________

---

## Test Scenario 5: Simultaneous Portal and Admin Sessions

**Objective:** Verify both systems can be authenticated simultaneously

### Steps

1. Log into portal as manager (Test Scenario 1)
2. Verify portal dashboard loads correctly
3. In a new tab (same browser), navigate to: `http://localhost:3000/admin`
4. Log into admin with admin/admin
5. Verify admin dashboard loads correctly
6. Switch back to portal tab
7. Refresh the page

### Expected Results

✅ **PASS if:**
- Portal tab still shows portal dashboard (session persists)
- Admin tab shows admin dashboard
- Both sessions active simultaneously
- No interference between sessions

❌ **FAIL if:**
- Portal tab logged out when admin logged in
- Admin tab logged out when portal logged in
- Cannot maintain both sessions

### Verification - Check localStorage

1. Open DevTools (F12)
2. Go to Application → Local Storage → http://localhost:3000
3. Should see BOTH:
   - Key: `mammas-place-auth` (manager session)
   - Key: `mammas-place-admin-auth` (admin session)

---

## Test Scenario 6: Agent Portal Login

**Objective:** Verify agent role gets appropriate dashboard

### Steps

1. Clear all localStorage
2. Navigate to: `http://localhost:3000/portal`
3. Enter credentials:
   - Username: `agent1`
   - Password: `agent1`
4. Click "Sign In"

### Expected Results

✅ **PASS if:**
- Redirected to: `http://localhost:3000/portal/dashboard`
- Header shows: "Agent Dashboard" (not Manager Dashboard)
- Welcome message: "Welcome back, Sales Agent 1"
- "Agent Tools" section visible
- "Manager Tools" section NOT visible
- Promo codes still visible (all staff can see)

❌ **FAIL if:**
- Shows manager-specific tools
- Shows "Manager Dashboard"
- Cannot access promo codes

---

## Test Scenario 7: Invalid Credentials

**Objective:** Verify login rejects invalid credentials

### Test 7A: Invalid Portal Credentials

1. Navigate to: `http://localhost:3000/portal`
2. Enter: `admin` / `admin` (admin credentials on portal)
3. Click "Sign In"

**Expected:** ✅ Error message "Invalid username or password"

### Test 7B: Invalid Admin Credentials

1. Navigate to: `http://localhost:3000/admin`
2. Enter: `manager` / `manager` (portal credentials on admin)
3. Click "Sign In"

**Expected:** ✅ Error message "Invalid credentials"

### Test 7C: Completely Invalid

1. Navigate to: `http://localhost:3000/portal`
2. Enter: `wronguser` / `wrongpass`
3. Click "Sign In"

**Expected:** ✅ Error message displayed

---

## Test Scenario 8: Direct URL Navigation (Protected Routes)

**Objective:** Verify protected routes redirect to login when not authenticated

### Test 8A: Portal Dashboard Without Auth

1. Clear all localStorage
2. Navigate directly to: `http://localhost:3000/portal/dashboard`

**Expected:** ✅ Redirected to `/portal` login page

### Test 8B: Admin Dashboard Without Auth

1. Clear all localStorage
2. Navigate directly to: `http://localhost:3000/admin/dashboard`

**Expected:** ✅ Redirected to `/admin` login page

### Test 8C: Admin Upload Page Without Auth

1. Clear all localStorage
2. Navigate directly to: `http://localhost:3000/admin/upload`

**Expected:** ✅ Redirected to `/admin` login page

---

## Test Scenario 9: Portal Credentials on Admin (Critical)

**Objective:** Verify portal credentials CANNOT access admin system

### Steps

1. Clear all localStorage
2. Navigate to: `http://localhost:3000/admin`
3. Try to log in with:
   - Username: `manager`
   - Password: `manager`
4. Click "Sign In"

### Expected Results

✅ **PASS if:**
- Login fails
- Error message: "Invalid credentials. Please try again."
- Remains on admin login page
- Does NOT redirect to admin dashboard

❌ **FAIL if:**
- Login succeeds
- Redirected to admin dashboard
- Portal credentials grant admin access

**This is a CRITICAL SECURITY TEST**

---

## Test Scenario 10: Admin Credentials on Portal

**Objective:** Verify admin credentials CANNOT access portal system

### Steps

1. Clear all localStorage
2. Navigate to: `http://localhost:3000/portal`
3. Try to log in with:
   - Username: `admin`
   - Password: `admin`
4. Click "Sign In"

### Expected Results

✅ **PASS if:**
- Login fails
- Error message: "Invalid username or password."
- Remains on portal login page
- Does NOT redirect to portal dashboard

❌ **FAIL if:**
- Login succeeds
- Redirected to portal dashboard
- Admin credentials grant portal access

---

## Test Scenario 11: Browser Back Button Behavior

**Objective:** Verify navigation works correctly with browser back/forward

### Steps

1. Log into portal as manager
2. Click browser back button
3. Observe behavior
4. Click browser forward button
5. Observe behavior

### Expected Results

✅ **PASS if:**
- Back button goes to login page but immediately redirects to dashboard (still authenticated)
- Forward button returns to dashboard
- Session persists throughout navigation

---

## Test Scenario 12: Manager Dashboard Features

**Objective:** Verify all manager-specific features are accessible

### Prerequisites

- Logged in as manager on portal dashboard

### Verification Checklist

- [ ] Quick stats section displays (4 stat cards)
- [ ] Product Management section visible
- [ ] "View Public Store" link works
- [ ] Manager Tools section visible
- [ ] Promo codes listed: MAMMA10, PRINCESS20, UNICORN15, PONY25, SAVE30
- [ ] All promo codes display discount percentages
- [ ] User name "Store Manager" appears in header
- [ ] Sign Out button visible and accessible
- [ ] Header shows "Staff Portal" (not "Admin Portal")

---

## Test Results Summary

| Scenario | Expected Result | Actual Result | Pass/Fail | Notes |
|----------|-----------------|---------------|-----------|-------|
| 1. Manager Portal Login | Redirect to /portal/dashboard | | | |
| 2. Portal Sign-Out | Redirect to /portal | | | |
| 3. Admin Access (Portal Auth) | Show admin login | | | |
| 4. Admin Login | Redirect to /admin/dashboard | | | |
| 5. Simultaneous Sessions | Both active | | | |
| 6. Agent Portal Login | Agent dashboard | | | |
| 7A. Invalid Portal Creds | Error message | | | |
| 7B. Invalid Admin Creds | Error message | | | |
| 7C. Wrong Credentials | Error message | | | |
| 8A. Portal Dashboard (No Auth) | Redirect to /portal | | | |
| 8B. Admin Dashboard (No Auth) | Redirect to /admin | | | |
| 8C. Admin Upload (No Auth) | Redirect to /admin | | | |
| 9. Portal Creds on Admin | Login fails | | | |
| 10. Admin Creds on Portal | Login fails | | | |
| 11. Browser Back Button | Session persists | | | |
| 12. Manager Features | All visible | | | |

---

## Bug Reproduction Attempt

**Reported Bug:** "Manager login took me to admin page"

### Reproduction Steps

1. Clear all localStorage
2. Navigate to: `http://localhost:3000/portal`
3. Log in with manager/manager
4. Record exact URL after login
5. Record exact page branding

### Expected (Correct) Behavior

- URL: `http://localhost:3000/portal/dashboard`
- Branding: "Mamma's Place Staff Portal"
- Header: "Manager Dashboard"

### If Bug Exists (Incorrect) Behavior

- URL: `http://localhost:3000/admin/dashboard`
- Branding: "Mamma's Place Admin Portal"
- Header: "Product Management Dashboard"

### Result

**Bug Reproduced:** Yes / No

**Evidence:**
- URL after login: ___________________________
- Page branding: ___________________________
- Screenshot: ___________________________

---

## Testing Environment

- **Browser:** ___________________________ (Chrome/Firefox/Edge/Safari)
- **Browser Version:** ___________________________
- **Operating System:** ___________________________
- **Dev Server Port:** 3000
- **Node Version:** ___________________________ (`node --version`)
- **NPM Version:** ___________________________ (`npm --version`)

---

## localStorage Inspection Guide

**How to view localStorage:**

1. Open DevTools (F12 or right-click → Inspect)
2. Go to "Application" tab (Chrome/Edge) or "Storage" tab (Firefox)
3. Expand "Local Storage" in left sidebar
4. Click on `http://localhost:3000`
5. View all key-value pairs

**Expected keys:**
- `mammas-place-auth` - Portal session
- `mammas-place-admin-auth` - Admin session

**To clear localStorage:**
- Right-click on domain → Clear
- Or use: `localStorage.clear()` in console

---

## Manual Code Verification

**Files to check:**

1. **Portal Login Redirect:**
   - File: `app/portal/page.tsx`
   - Line: 18
   - Code: `router.push('/portal/dashboard');`
   - Verify: NO conditions that would redirect to admin

2. **Admin Login Redirect:**
   - File: `app/admin/page.tsx`
   - Line: 17
   - Code: `router.push('/admin/dashboard');`
   - Verify: NO shared logic with portal

3. **Authentication Contexts:**
   - Portal: `context/AuthContext.tsx`
   - Admin: `context/AdminAuthContext.tsx`
   - Verify: Different storage keys, no cross-reference

---

## Testing Notes

**Important Points:**

1. Portal and admin are completely separate systems
2. Different credentials for each
3. Different localStorage keys
4. Different React contexts
5. No code path connects them

**If any test fails:**

1. Document exact steps to reproduce
2. Take screenshots
3. Check browser console for errors (F12 → Console)
4. Record actual vs. expected behavior
5. Note any error messages

**Common issues to watch for:**

- Browser caching old version
- Dev server not running
- localStorage not cleared between tests
- Network tab showing failed requests

---

## Post-Testing Checklist

After completing all scenarios:

- [ ] All critical security tests passed (scenarios 9, 10)
- [ ] Portal login redirects correctly (scenario 1)
- [ ] Admin login redirects correctly (scenario 4)
- [ ] Sign-out works for both systems (scenario 2)
- [ ] Bug reproduction attempted (unsuccessful = good)
- [ ] localStorage keys verified as separate
- [ ] Documentation updated with any findings

---

## Report Findings

**Test Conducted By:** ___________________________

**Date:** ___________________________

**Overall Result:** PASS / FAIL / NEEDS INVESTIGATION

**Critical Failures:** ___________________________

**Recommendations:** ___________________________

---

**Next Steps:**

If all tests pass → System is functioning correctly
If any test fails → Document and report to development team
If bug reproduced → Investigate root cause with code analysis
