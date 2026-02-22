# Portal Comparison: Agent vs Manager vs Admin

---

## Visual Dashboard Comparison

### Sales Agent Dashboard (agent1 or agent2)

```
┌─────────────────────────────────────────────────────────────┐
│  [MP] Mamma's Place Staff Portal            👋 Sales Agent 1│
│       Agent Dashboard                           [Sign Out]   │
├─────────────────────────────────────────────────────────────┤
│  Dashboard                                                   │
│  Welcome back, Sales Agent 1. You are signed in as Agent.   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 📦       │ │ 🗂️      │ │ 🏷️      │ │ ⭐       │      │
│  │ 20       │ │ 6        │ │ 9        │ │ 8        │      │
│  │ Products │ │Categories│ │ On Sale  │ │ Featured │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Product Management     │  │ Agent Tools            │    │
│  │                        │  │                        │    │
│  │ 📤 Upload Images       │  │ 🔍 Browse Products     │    │
│  │    (Coming Soon)       │  │                        │    │
│  │                        │  │ 💬 Customer Support    │    │
│  │ 🛍️ View Public Store  │  │    (Coming Soon)       │    │
│  │                        │  │                        │    │
│  └────────────────────────┘  └────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  🎟️ Active Promo Codes                                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │MAMMA10   │PRINCESS20│UNICORN15 │PONY25    │SAVE30    │ │
│  │10% off   │20% off   │15% off   │25% off   │30% off   │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Store Manager Dashboard (manager)

```
┌─────────────────────────────────────────────────────────────┐
│  [MP] Mamma's Place Staff Portal         👋 Store Manager   │
│       Manager Dashboard                         [Sign Out]  │
├─────────────────────────────────────────────────────────────┤
│  Dashboard                                                   │
│  Welcome back, Store Manager. You are signed in as Manager. │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 📦       │ │ 🗂️      │ │ 🏷️      │ │ ⭐       │      │
│  │ 20       │ │ 6        │ │ 9        │ │ 8        │      │
│  │ Products │ │Categories│ │ On Sale  │ │ Featured │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Product Management     │  │ Manager Tools ⭐       │    │
│  │                        │  │                        │    │
│  │ 📤 Upload Images       │  │ 🔐 Promo Codes:        │    │
│  │    (Coming Soon)       │  │    MAMMA10·PRINCESS20· │    │
│  │                        │  │    UNICORN15·PONY25·   │    │
│  │ 🛍️ View Public Store  │  │    SAVE30              │    │
│  │                        │  │                        │    │
│  └────────────────────────┘  │ 📊 Analytics           │    │
│                               │    (Coming Soon)       │    │
│                               │                        │    │
│                               │ 📋 Orders              │    │
│                               │    (Coming Soon)       │    │
│                               │                        │    │
│                               └────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  🎟️ Active Promo Codes                                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │MAMMA10   │PRINCESS20│UNICORN15 │PONY25    │SAVE30    │ │
│  │10% off   │20% off   │15% off   │25% off   │30% off   │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Admin Dashboard (admin) - SEPARATE PORTAL

```
┌─────────────────────────────────────────────────────────────┐
│  [MP] Admin Portal                                          │
│       System Administration                     [Sign Out]  │
├─────────────────────────────────────────────────────────────┤
│  Admin Dashboard                                             │
│  (Different system - /admin instead of /portal)              │
│                                                              │
│  Features:                                                   │
│  - Product image uploads (/admin/upload)                    │
│  - System configuration                                      │
│  - Full administrative access                                │
│                                                              │
│  Note: Staff credentials (manager/agent) do NOT work here   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Visual Differences

### 1. Agent Dashboard
**What's There:**
- ✅ Quick stats (4 cards)
- ✅ Product Management panel
- ✅ Agent Tools panel (Browse Products, Customer Support)
- ✅ Active Promo Codes section

**What's NOT There:**
- ❌ Manager Tools panel

**Header Badge:** "Agent Dashboard" (purple)
**Welcome Message:** "You are signed in as Agent"

---

### 2. Manager Dashboard
**What's There:**
- ✅ Quick stats (4 cards)
- ✅ Product Management panel
- ✅ **Manager Tools panel** ⭐ (EXTRA PANEL)
  - Promo code list
  - Analytics (coming soon)
  - Orders (coming soon)
- ✅ Active Promo Codes section

**What's NOT There:**
- ❌ Agent Tools panel (replaced by Manager Tools)

**Header Badge:** "Manager Dashboard" (purple)
**Welcome Message:** "You are signed in as Manager"

---

### 3. Admin Dashboard
**Completely Different:**
- Different URL (/admin vs /portal)
- Different authentication system
- Different localStorage key
- Different features (product uploads, system config)
- Cannot use staff portal credentials

**Header Badge:** "System Administration" (gray)

---

## Side-by-Side Credential Comparison

| Portal | URL | Username | Password | Role |
|--------|-----|----------|----------|------|
| Staff | /portal | agent1 | agent1 | Sales Agent |
| Staff | /portal | agent2 | agent2 | Sales Agent |
| Staff | /portal | manager | manager | Store Manager |
| Admin | /admin | admin | admin | System Admin |

**Cross-Authentication:** ❌ NONE
- Admin cannot log into staff portal
- Staff cannot log into admin portal
- These are isolated systems

---

## Permission Matrix

### Legend
- 🟢 Available Now
- 🟡 Coming Soon (disabled)
- 🔴 Not Available
- ⭐ Manager-Only

| Feature | Agent1 | Agent2 | Manager | Admin |
|---------|:------:|:------:|:-------:|:-----:|
| **Authentication** |
| Login to /portal | 🟢 | 🟢 | 🟢 | 🔴 |
| Login to /admin | 🔴 | 🔴 | 🔴 | 🟢 |
| **Dashboard Views** |
| View quick stats | 🟢 | 🟢 | 🟢 | N/A |
| See product count | 🟢 | 🟢 | 🟢 | N/A |
| See categories | 🟢 | 🟢 | 🟢 | N/A |
| See sale items | 🟢 | 🟢 | 🟢 | N/A |
| See featured | 🟢 | 🟢 | 🟢 | N/A |
| **Product Management** |
| Upload images (staff) | 🟡 | 🟡 | 🟡 | 🔴 |
| Upload images (admin) | 🔴 | 🔴 | 🔴 | 🟢 |
| View public store | 🟢 | 🟢 | 🟢 | N/A |
| Browse products | 🟢 | 🟢 | 🔴 | N/A |
| **Customer Tools** |
| Customer support | 🟡 | 🟡 | 🔴 | N/A |
| **Manager Tools** |
| Manager panel | 🔴 | 🔴 | 🟢⭐ | N/A |
| View promo codes (mgr panel) | 🔴 | 🔴 | 🟢⭐ | N/A |
| Analytics | 🔴 | 🔴 | 🟡⭐ | N/A |
| Orders dashboard | 🔴 | 🔴 | 🟡⭐ | N/A |
| **Promo Codes** |
| View all codes (bottom section) | 🟢 | 🟢 | 🟢 | N/A |
| **Admin Features** |
| System configuration | 🔴 | 🔴 | 🔴 | 🟢 |
| Admin uploads | 🔴 | 🔴 | 🔴 | 🟢 |

---

## Authentication Flow Diagrams

### Staff Portal Flow

```
User navigates to /portal
         ↓
    Login Form
         ↓
Enter username & password
         ↓
    AuthContext checks
         ↓
┌────────┴────────┐
│                 │
Valid          Invalid
│                 │
↓                 ↓
Store in      Show error
localStorage  "Invalid username
(mammas-      or password"
place-auth)        │
│                 │
↓                 ↓
Redirect to   Stay on
/portal/      login page
dashboard
│
↓
Check role
│
┌─────┴─────┐
│           │
agent    manager
│           │
↓           ↓
Show      Show
Agent     Manager
Tools     Tools
```

### Admin Portal Flow

```
User navigates to /admin
         ↓
    Login Form
         ↓
Enter username & password
         ↓
  AdminAuthContext checks
         ↓
┌────────┴────────┐
│                 │
Valid          Invalid
(admin/admin)     │
│                 ↓
↓            Show error
Store in     "Invalid
localStorage  credentials"
(mammas-           │
place-            │
admin-auth)       ↓
│            Stay on
↓            login page
Redirect to
/admin/
dashboard
│
↓
Admin view
(no role check -
only one admin)
```

---

## What Makes Manager Different from Agent?

### Visual Differences
1. **Header badge:** "Manager Dashboard" vs "Agent Dashboard"
2. **Welcome message:** "signed in as Manager" vs "signed in as Agent"
3. **Panel layout:** Manager Tools vs Agent Tools

### Functional Differences
1. **Manager Tools Panel** (Manager ONLY)
   - Inline promo code reference (MAMMA10, PRINCESS20, etc.)
   - Analytics link (coming soon)
   - Orders link (coming soon)

2. **Agent Tools Panel** (Agents ONLY)
   - Browse Products button
   - Customer Support link (coming soon)

### What's The Same
1. Quick stats cards (all 4)
2. Product Management panel
3. Promo Codes section at bottom (all staff can see)
4. View Public Store button
5. Sign Out functionality

---

## Real-World Testing Scenarios

### Scenario 1: Sales Agent Helping Customer
```
Customer: "Do you have any discount codes?"
Agent: Logs into /portal as agent1
Agent: Sees promo codes section at bottom
Agent: "Yes, we have PRINCESS20 for 20% off or SAVE30 for 30% off"
✅ Works perfectly
```

### Scenario 2: Manager Reviewing Promo Codes
```
Manager: Logs into /portal as manager
Manager: Sees Manager Tools panel
Manager: Views promo codes in Manager Tools
Manager: Also sees same codes in bottom section
✅ Works (codes shown twice - in panel and bottom section)
```

### Scenario 3: Agent Trying Manager Features
```
Agent: Logs into /portal as agent1
Agent: Looks for Manager Tools panel
Agent: ❌ Panel not visible (correct behavior)
Agent: Cannot access analytics or orders
✅ Security working as intended
```

### Scenario 4: Staff Trying Admin Portal
```
Agent/Manager: Goes to /admin
Agent/Manager: Enters staff credentials (manager/manager)
Agent/Manager: ❌ "Invalid credentials"
✅ Portals properly separated
```

### Scenario 5: Simultaneous Sessions
```
User: Opens Tab 1 → logs into /portal as agent1
User: Opens Tab 2 → logs into /admin as admin
Both sessions active simultaneously
localStorage has two keys:
  - mammas-place-auth (agent1 session)
  - mammas-place-admin-auth (admin session)
✅ Both work independently
```

---

## Common Confusion Points

### "Why can't I see Manager Tools?"
**Answer:** You're logged in as an agent (agent1 or agent2). Only the "manager" account has access to the Manager Tools panel. This is intentional role-based access control.

### "Are agent1 and agent2 different?"
**Answer:** No, they're functionally identical. Only the display name differs ("Sales Agent 1" vs "Sales Agent 2"). Both have exact same permissions and see the exact same dashboard.

### "Why are promo codes shown twice for managers?"
**Answer:** Once in the Manager Tools panel (compact list) and once in the yellow promo codes section at the bottom (detailed badges). The bottom section is visible to ALL staff (agents too), while the Manager Tools panel is manager-only.

### "Can I log into both portals at once?"
**Answer:** Yes, you can be logged into /portal as a staff member AND /admin as admin simultaneously in different tabs. They use separate authentication systems.

### "Where do I upload product images?"
**Answer:** Currently "Coming Soon" in staff portal. The admin portal (/admin) has an upload feature at /admin/upload, but you need admin credentials to access it.

---

**Summary:** The main visual difference between agent and manager dashboards is the presence of the Manager Tools panel vs Agent Tools panel. Everything else (stats, promo codes, product management) is identical. The admin portal is a completely separate system with different features.
