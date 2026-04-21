# Authentication Flow Diagram - Mamma's Place

## Portal vs Admin - Complete Separation

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROOT LAYOUT (app/layout.tsx)                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AdminAuthProvider (Outer)                       │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │           AuthProvider (Inner)                         │  │  │
│  │  │                                                        │  │  │
│  │  │  Both contexts available to all pages                 │  │  │
│  │  │  but each page uses ONLY its appropriate context      │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Portal Authentication Flow

```
┌─────────────────┐
│ User navigates  │
│ to /portal      │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  Portal Login Page                         │
│  (app/portal/page.tsx)                     │
│                                            │
│  Uses: AuthContext (useAuth)              │
│  Storage: mammas-place-auth                │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Username: [manager]                  │ │
│  │ Password: [••••••••]                 │ │
│  │                                      │ │
│  │        [Sign In]                     │ │
│  └──────────────────────────────────────┘ │
└────────────────┬───────────────────────────┘
                 │
                 │ login('manager', 'manager')
                 ▼
┌────────────────────────────────────────────┐
│  AuthContext.login()                       │
│  (context/AuthContext.tsx)                 │
│                                            │
│  Validates against USERS array:            │
│  - manager/manager ✓                       │
│  - agent1/agent1                           │
│  - agent2/agent2                           │
│                                            │
│  If valid:                                 │
│  1. setUser({ username, role, name })      │
│  2. localStorage.setItem(                  │
│       'mammas-place-auth',                 │
│       JSON.stringify(user)                 │
│     )                                      │
│  3. return true                            │
└────────────────┬───────────────────────────┘
                 │
                 │ isAuthenticated = true
                 ▼
┌────────────────────────────────────────────┐
│  useEffect in Portal Login Page            │
│                                            │
│  if (isAuthenticated) {                    │
│    router.push('/portal/dashboard')        │  ← HARDCODED
│  }                                         │     PORTAL ROUTE
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  Portal Dashboard                          │
│  (app/portal/dashboard/page.tsx)           │
│                                            │
│  Uses: AuthContext (useAuth)              │
│  Checks: isAuthenticated                   │
│                                            │
│  Shows:                                    │
│  - Staff Portal branding (purple)          │
│  - Welcome, Store Manager                  │
│  - Manager Tools (if role === 'manager')   │
│  - Promo codes                             │
│  - Quick stats                             │
│  - [Sign Out] button                       │
└────────────────────────────────────────────┘
```

---

## Admin Authentication Flow

```
┌─────────────────┐
│ User navigates  │
│ to /admin       │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  Admin Login Page                          │
│  (app/admin/page.tsx)                      │
│                                            │
│  Uses: AdminAuthContext (useAdminAuth)     │  ← DIFFERENT CONTEXT
│  Storage: mammas-place-admin-auth          │  ← DIFFERENT KEY
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Username: [admin]                    │ │
│  │ Password: [•••••]                    │ │
│  │                                      │ │
│  │        [Sign In]                     │ │
│  └──────────────────────────────────────┘ │
└────────────────┬───────────────────────────┘
                 │
                 │ adminLogin('admin', 'admin')
                 ▼
┌────────────────────────────────────────────┐
│  AdminAuthContext.adminLogin()             │
│  (context/AdminAuthContext.tsx)            │
│                                            │
│  Validates against:                        │
│  - ADMIN_USERNAME: 'admin'                 │
│  - ADMIN_PASSWORD: 'admin'                 │
│                                            │
│  If valid:                                 │
│  1. setAdminUser({ username, auth: true }) │
│  2. localStorage.setItem(                  │
│       'mammas-place-admin-auth',           │  ← DIFFERENT KEY
│       JSON.stringify(adminUser)            │
│     )                                      │
│  3. return true                            │
└────────────────┬───────────────────────────┘
                 │
                 │ isAdminAuthenticated = true
                 ▼
┌────────────────────────────────────────────┐
│  useEffect in Admin Login Page             │
│                                            │
│  if (isAdminAuthenticated) {               │
│    router.push('/admin/dashboard')         │  ← HARDCODED
│  }                                         │     ADMIN ROUTE
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│  Admin Dashboard                           │
│  (app/admin/dashboard/page.tsx)            │
│                                            │
│  Uses: AdminAuthContext (useAdminAuth)     │
│  Checks: isAdminAuthenticated              │
│                                            │
│  Shows:                                    │
│  - Admin Portal branding (gray)            │
│  - Product Management Dashboard            │
│  - Full product CRUD operations            │
│  - Upload Images link                      │
│  - [Sign Out] button                       │
└────────────────────────────────────────────┘
```

---

## The Critical Separation

### Why Manager CANNOT Access Admin

```
┌────────────────────────────────────────────────────────────┐
│  Manager logs into PORTAL                                  │
│                                                            │
│  localStorage:                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Key: "mammas-place-auth"                             │ │
│  │ Value: {username: "manager", role: "manager", ...}   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Manager navigates to /admin                               │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Admin page checks isAdminAuthenticated               │ │
│  │   ↓                                                  │ │
│  │ AdminAuthContext looks for:                          │ │
│  │   localStorage.getItem('mammas-place-admin-auth')    │ │  ← DIFFERENT KEY
│  │   ↓                                                  │ │
│  │ NOT FOUND! (only 'mammas-place-auth' exists)         │ │
│  │   ↓                                                  │ │
│  │ isAdminAuthenticated = false                         │ │
│  │   ↓                                                  │ │
│  │ Admin LOGIN page displays                            │ │  ← USER SEES LOGIN
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Manager cannot access admin dashboard without            │
│  entering admin credentials (admin/admin)                 │
└────────────────────────────────────────────────────────────┘
```

---

## Sign-Out Flows

### Portal Sign-Out

```
Portal Dashboard
      │
      │ User clicks [Sign Out]
      ▼
handleLogout() executes
      │
      ├─→ logout() from AuthContext
      │        │
      │        ├─→ setUser(null)
      │        │
      │        └─→ localStorage.removeItem('mammas-place-auth')
      │
      └─→ router.push('/portal')
            │
            ▼
      Portal Login Page
```

### Admin Sign-Out

```
Admin Dashboard
      │
      │ User clicks [Sign Out]
      ▼
handleLogout() executes
      │
      ├─→ adminLogout() from AdminAuthContext
      │        │
      │        ├─→ setAdminUser(null)
      │        │
      │        └─→ localStorage.removeItem('mammas-place-admin-auth')
      │
      └─→ router.push('/admin')
            │
            ▼
      Admin Login Page
```

**Note:** Signing out of portal does NOT sign out of admin, and vice versa.

---

## Simultaneous Sessions

```
┌──────────────────────────────────────────────────────────────┐
│  localStorage (Browser Storage)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Key: "mammas-place-auth"                               │ │
│  │ Value: {username: "manager", role: "manager", ...}     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Key: "mammas-place-admin-auth"                         │ │
│  │ Value: {username: "admin", authenticated: true}        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Both can exist simultaneously!                              │
│  User can be logged into BOTH portal AND admin at same time │
│  Each system reads only its own key                          │
└──────────────────────────────────────────────────────────────┘

When visiting /portal/* → Checks mammas-place-auth
When visiting /admin/*  → Checks mammas-place-admin-auth

NO CROSS-REFERENCE!
```

---

## Protection Mechanisms

### Portal Dashboard Protection

```typescript
// app/portal/dashboard/page.tsx, lines 12-16
useEffect(() => {
  if (!isAuthenticated) {  // ← From AuthContext
    router.push('/portal');  // ← Redirect to portal login
  }
}, [isAuthenticated, router]);
```

**Protects:** Portal dashboard from unauthenticated users
**Checks:** `mammas-place-auth` localStorage key
**Redirects to:** Portal login page

### Admin Dashboard Protection

```typescript
// app/admin/dashboard/page.tsx, lines 63-67
useEffect(() => {
  if (!isAdminAuthenticated) {  // ← From AdminAuthContext
    router.push('/admin');  // ← Redirect to admin login
  }
}, [isAdminAuthenticated, router]);
```

**Protects:** Admin dashboard from unauthenticated users
**Checks:** `mammas-place-admin-auth` localStorage key
**Redirects to:** Admin login page

**Critical:** These are INDEPENDENT checks using DIFFERENT contexts!

---

## Route Protection Summary

| Route | Protected By | Storage Key Checked | Redirect on Fail |
|-------|--------------|---------------------|------------------|
| `/portal` | None (public login) | - | - |
| `/portal/dashboard` | AuthContext | `mammas-place-auth` | `/portal` |
| `/admin` | None (public login) | - | - |
| `/admin/dashboard` | AdminAuthContext | `mammas-place-admin-auth` | `/admin` |
| `/admin/upload` | AdminAuthContext | `mammas-place-admin-auth` | `/admin` |

---

## Credentials Reference

### Portal Users (AuthContext)

| Username | Password | Role | Name |
|----------|----------|------|------|
| manager | manager | manager | Store Manager |
| agent1 | agent1 | agent | Sales Agent 1 |
| agent2 | agent2 | agent | Sales Agent 2 |

**Validated in:** `context/AuthContext.tsx`, USERS array

### Admin User (AdminAuthContext)

| Username | Password |
|----------|----------|
| admin | admin |

**Validated in:** `context/AdminAuthContext.tsx`, constants

**Key Point:** These credential stores are COMPLETELY SEPARATE.
Portal credentials do NOT work on admin login, and vice versa.

---

## Visual Distinction

### Portal Branding

```
┌─────────────────────────────────────────────────────┐
│  🟣 MP                                              │
│  Mamma's Place Staff Portal | Manager Dashboard    │
│                                   👋 Store Manager  │
│                                   [Sign Out]        │
├─────────────────────────────────────────────────────┤
│  Purple theme (#7c3aed, #a855f7)                    │
│  "Staff Portal" subtitle on login                   │
│  Welcoming, friendly tone                           │
└─────────────────────────────────────────────────────┘
```

### Admin Branding

```
┌─────────────────────────────────────────────────────┐
│  ⚫ MP                                              │
│  Mamma's Place Admin Portal                         │
│  Product Management Dashboard                       │
│                                   Admin: admin      │
│                                   [Sign Out]        │
├─────────────────────────────────────────────────────┤
│  Gray theme (#374151, #4b5563)                      │
│  "Admin Portal" subtitle on login                   │
│  Technical, professional tone                       │
└─────────────────────────────────────────────────────┘
```

---

## Bug Investigation Flow

```
Bug Report: "Manager login took me to admin page"
       │
       ▼
Code Analysis: Check Portal Login Redirect
       │
       ├─→ Line 18: router.push('/portal/dashboard')  ← HARDCODED TO PORTAL
       │
       ▼
Code Analysis: Check if role affects redirect
       │
       ├─→ NO conditional logic based on role
       ├─→ ALL portal users go to /portal/dashboard
       │
       ▼
Code Analysis: Check if AuthContext can access admin
       │
       ├─→ AuthContext uses 'mammas-place-auth' key
       ├─→ AdminAuthContext uses 'mammas-place-admin-auth' key
       ├─→ COMPLETELY SEPARATE SYSTEMS
       │
       ▼
Conclusion: Bug DOES NOT EXIST in code
       │
       ▼
Hypothesis: User confusion or browser caching
       │
       ├─→ User navigated to /admin instead of /portal
       ├─→ Browser had cached admin session
       ├─→ User bookmarked wrong URL
       │
       ▼
Recommendation: Improve UI clarity to prevent confusion
```

---

## Testing Checklist

- [✅] Portal login redirects to /portal/dashboard
- [✅] Admin login redirects to /admin/dashboard
- [✅] Portal uses AuthContext
- [✅] Admin uses AdminAuthContext
- [✅] Portal stores session in mammas-place-auth
- [✅] Admin stores session in mammas-place-admin-auth
- [✅] Portal credentials don't work on admin
- [✅] Admin credentials don't work on portal
- [✅] Portal sign-out redirects to /portal
- [✅] Admin sign-out redirects to /admin
- [✅] Portal dashboard shows "Staff Portal" branding
- [✅] Admin dashboard shows "Admin Portal" branding
- [✅] Manager role gets manager-specific tools
- [✅] Agent role gets agent-specific tools
- [✅] No code path redirects manager to admin

**ALL TESTS PASS ✅**

---

## End of Diagram

For detailed test results, see:
- `manager-experience.md` - Full test report
- `PORTAL-TEST-SUMMARY.md` - Quick summary
