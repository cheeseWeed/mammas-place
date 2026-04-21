# Test Credentials - Quick Reference

---

## Portal Login (Staff Access)

**URL:** http://localhost:3000/portal

### Manager Account
```
Username: manager
Password: manager
Role: Store Manager
Expected Dashboard: /portal/dashboard
Features: Manager Tools, Promo Codes, Analytics (coming soon)
```

### Agent Account 1
```
Username: agent1
Password: agent1
Role: Sales Agent 1
Expected Dashboard: /portal/dashboard
Features: Agent Tools, Browse Products, Customer Support (coming soon)
```

### Agent Account 2
```
Username: agent2
Password: agent2
Role: Sales Agent 2
Expected Dashboard: /portal/dashboard
Features: Agent Tools, Browse Products, Customer Support (coming soon)
```

---

## Admin Login (System Administration)

**URL:** http://localhost:3000/admin

### Admin Account
```
Username: admin
Password: admin
Expected Dashboard: /admin/dashboard
Features: Product Management, Image Upload, Full CRUD Operations
```

---

## Critical Security Notes

### Portal Credentials DO NOT Work on Admin
- Attempting to log into `/admin` with `manager/manager` → **FAILS**
- Attempting to log into `/admin` with `agent1/agent1` → **FAILS**

### Admin Credentials DO NOT Work on Portal
- Attempting to log into `/portal` with `admin/admin` → **FAILS**

### Separate Authentication Systems
- **Portal uses:** `AuthContext` with storage key `mammas-place-auth`
- **Admin uses:** `AdminAuthContext` with storage key `mammas-place-admin-auth`
- **Result:** Complete isolation between systems

---

## Authentication Storage Keys

### Portal Session
```javascript
localStorage.getItem('mammas-place-auth')
// Returns: {"username":"manager","role":"manager","name":"Store Manager"}
```

### Admin Session
```javascript
localStorage.getItem('mammas-place-admin-auth')
// Returns: {"username":"admin","authenticated":true}
```

### Check Current Authentication Status
```javascript
// Open browser console (F12) and run:

// Check portal authentication
console.log('Portal Auth:', localStorage.getItem('mammas-place-auth'));

// Check admin authentication
console.log('Admin Auth:', localStorage.getItem('mammas-place-admin-auth'));
```

### Clear All Sessions
```javascript
// Open browser console (F12) and run:
localStorage.clear();
```

---

## Quick Test Commands

### Test Portal Login
1. Navigate to: http://localhost:3000/portal
2. Use: `manager` / `manager`
3. Should redirect to: http://localhost:3000/portal/dashboard
4. Should see: "Mamma's Place Staff Portal" in header

### Test Admin Login
1. Navigate to: http://localhost:3000/admin
2. Use: `admin` / `admin`
3. Should redirect to: http://localhost:3000/admin/dashboard
4. Should see: "Mamma's Place Admin Portal" in header

### Test Portal Sign-Out
1. From portal dashboard, click "Sign Out" button
2. Should redirect to: http://localhost:3000/portal

### Test Admin Sign-Out
1. From admin dashboard, click "Sign Out" button
2. Should redirect to: http://localhost:3000/admin

---

## Expected Redirect Behavior

| Starting Point | Credentials Used | Expected Result |
|----------------|------------------|-----------------|
| /portal | manager/manager | → /portal/dashboard |
| /portal | agent1/agent1 | → /portal/dashboard |
| /portal | admin/admin | ❌ Error: Invalid credentials |
| /admin | admin/admin | → /admin/dashboard |
| /admin | manager/manager | ❌ Error: Invalid credentials |
| /admin | agent1/agent1 | ❌ Error: Invalid credentials |

---

## Role-Based Features

### Manager Role Features (Portal)
- ✅ Quick Stats Dashboard
- ✅ Manager Tools Section
- ✅ Promo Codes: MAMMA10, PRINCESS20, UNICORN15, PONY25, SAVE30
- ✅ Analytics Section (coming soon)
- ✅ Orders Section (coming soon)
- ✅ View Public Store Link

### Agent Role Features (Portal)
- ✅ Quick Stats Dashboard
- ✅ Agent Tools Section
- ✅ Browse Products
- ✅ Customer Support Section (coming soon)
- ✅ Promo Codes Visibility
- ✅ View Public Store Link
- ❌ Manager Tools (not visible to agents)

### Admin Features
- ✅ Full Product CRUD
- ✅ Product Search and Filtering
- ✅ Stock Management
- ✅ Image Upload
- ✅ Category Management
- ✅ Toggle Features (Sale, Featured, Available)
- ✅ Real-time Product Updates

---

## Active Promo Codes (Visible to All Staff)

| Code | Discount | Status |
|------|----------|--------|
| MAMMA10 | 10% off | Active |
| PRINCESS20 | 20% off | Active |
| UNICORN15 | 15% off | Active |
| PONY25 | 25% off | Active |
| SAVE30 | 30% off | Active |

**Note:** All portal users (manager and agents) can see these codes.

---

## File Locations (For Code Reference)

### Portal Files
- Login: `app/portal/page.tsx`
- Dashboard: `app/portal/dashboard/page.tsx`
- Context: `context/AuthContext.tsx`

### Admin Files
- Login: `app/admin/page.tsx`
- Dashboard: `app/admin/dashboard/page.tsx`
- Upload: `app/admin/upload/page.tsx`
- Context: `context/AdminAuthContext.tsx`

### Root Layout
- Providers: `app/layout.tsx` (lines 38-50)

---

## Troubleshooting

### Can't Log In to Portal
1. Verify you're at: http://localhost:3000/portal (not /admin)
2. Check credentials: manager/manager or agent1/agent1
3. Clear localStorage: `localStorage.clear()`
4. Refresh page and try again

### Can't Log In to Admin
1. Verify you're at: http://localhost:3000/admin (not /portal)
2. Check credentials: admin/admin
3. Clear localStorage: `localStorage.clear()`
4. Refresh page and try again

### Stuck on Dashboard After Logout
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check localStorage is actually cleared

### Portal Credentials Work on Admin (BUG!)
- **This should NEVER happen**
- Document exact reproduction steps
- Check browser console for errors
- Report to development team immediately

---

## Quick Copy-Paste Credentials

**Portal Manager:**
```
manager
manager
```

**Portal Agent:**
```
agent1
agent1
```

**Admin:**
```
admin
admin
```

---

## Testing Status

**Last Tested:** 2026-02-21
**Test Status:** ✅ All authentication systems working correctly
**Known Issues:** None
**Security Status:** ✅ Portal and admin properly isolated

---

**For detailed testing instructions, see:**
- `MANUAL-TEST-SCENARIOS.md` - Step-by-step test scenarios
- `manager-experience.md` - Full test report
- `PORTAL-TEST-SUMMARY.md` - Quick test summary
- `AUTH-FLOW-DIAGRAM.md` - Authentication flow diagrams
