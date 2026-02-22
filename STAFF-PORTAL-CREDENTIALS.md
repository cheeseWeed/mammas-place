# Staff Portal - Demo Credentials

⚠️ **DEMO ONLY - NOT FOR PRODUCTION USE**

---

## Staff Portal Access
**URL:** http://localhost:3000/portal

### Available Accounts:

#### Sales Agent 1
- **Username:** `agent1`
- **Password:** `agent1`
- **Access Level:** Sales Agent
- **What you can see:**
  - Product statistics
  - Active promo codes
  - Link to public store
  - Customer support tools (coming soon)

#### Sales Agent 2
- **Username:** `agent2`
- **Password:** `agent2`
- **Access Level:** Sales Agent
- **What you can see:**
  - Same as Agent 1 (identical permissions)

#### Store Manager
- **Username:** `manager`
- **Password:** `manager`
- **Access Level:** Manager
- **What you can see:**
  - Everything agents can see, PLUS:
  - Manager Tools panel
  - Promo code management
  - Analytics (coming soon)
  - Orders dashboard (coming soon)

---

## Admin Portal Access (SEPARATE SYSTEM)
**URL:** http://localhost:3000/admin

#### System Administrator
- **Username:** `admin`
- **Password:** `admin`
- **Access Level:** System Admin
- **What you can do:**
  - Product image uploads
  - System configuration
  - Full administrative access

**Note:** Staff credentials (manager/agent) will NOT work on the admin portal.
Admin credentials will NOT work on the staff portal. These are separate systems.

---

## Quick Start Guide for Sales Agents

1. Open browser to: http://localhost:3000/portal
2. Enter your username (agent1 or agent2)
3. Enter your password (same as username)
4. Click "Sign In"
5. You'll be redirected to your dashboard

### What Can I Do As A Sales Agent?

Currently available features:
- View product statistics (20 products, 6 categories, 9 on sale)
- See all active promo codes to help customers:
  - MAMMA10 (10% off)
  - PRINCESS20 (20% off)
  - UNICORN15 (15% off)
  - PONY25 (25% off)
  - SAVE30 (30% off)
- Browse the public store
- Sign out

Coming soon:
- Upload product images
- Customer support tools

### What Can Managers Do That I Can't?

Managers have an additional "Manager Tools" panel with:
- Promo code management interface
- Analytics dashboard (coming soon)
- Orders management (coming soon)

Everything else is the same.

---

## Security Note

This is a DEMO system with intentionally simple passwords for testing purposes.

**Do NOT use this approach in production:**
- Passwords are the same as usernames
- No encryption
- No security features
- Stored in browser (anyone with access to your computer can see them)

This would need a complete security overhaul before being used in a real business environment.

---

## Troubleshooting

**"Invalid username or password" error?**
- Make sure you're typing the username exactly (lowercase, no spaces)
- Password is the same as the username
- Example: username `agent1` → password `agent1`

**Can't access manager tools?**
- This is correct if you're logged in as agent1 or agent2
- Only the "manager" account can see manager tools
- Log out and log in as "manager/manager" to test manager view

**Logged out automatically?**
- Your session persists in the browser
- You shouldn't be logged out unless you click "Sign Out"
- If this happens, there may be a browser issue

**Trying to use staff credentials on /admin?**
- Won't work - these are separate systems
- Use admin/admin for the admin portal
- Use manager/agent1/agent2 for the staff portal

---

**Last Updated:** 2026-02-21
**For Questions:** See full test report in `agent-login-experience.md`
