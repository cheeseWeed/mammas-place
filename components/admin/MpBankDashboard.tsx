'use client';

// Parent / MP Bank admin dashboard. Three sections:
//   1. Learner balances — top-up / deduct inline forms per kid
//   2. All recent orders — global feed
//   3. Per-kid transaction log — dropdown + table
//
// Auth is enforced server-side in app/admin/mp-bank/page.tsx. The endpoints
// this component calls are ALSO parent-gated, so any cookie expiry mid-session
// surfaces as a 401 (we redirect to /admin/mp-bank/login on that).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { centsToMP, dollarsInputToCents } from '@/lib/money/format';
import AdminProductsTab from '@/components/admin/AdminProductsTab';
import AdminFeedbackTab from '@/components/admin/AdminFeedbackTab';
import FamiliesAdminTab from '@/components/admin/FamiliesAdminTab';
import { LEARNING_SECTIONS, isSectionEnabled, type LearningSection } from '@/lib/sections';

type DashboardTab = 'money' | 'products' | 'feedback' | 'families' | 'sections' | 'settings';
const VALID_TABS: DashboardTab[] = ['money', 'products', 'feedback', 'families', 'sections', 'settings'];
function parseTab(raw: string | null): DashboardTab {
  return raw && (VALID_TABS as string[]).includes(raw) ? (raw as DashboardTab) : 'money';
}

// Inline display formatter — lib/money/card.ts is server-only (uses node:crypto)
// so we can't import it into this client component.
function formatCardLocal(n: string): string {
  return `MP·${n}`;
}

interface Learner {
  name: string;
  displayName: string | null;
  balanceCents: number;
  updatedAt: string;
  // Phase 6a — kid's MP account card number ("7821"). Null until first issued.
  mpCardNumber?: string | null;
}

interface OrderRow {
  id: string;
  userName: string;
  // items is JSON in DB — we only render a count summary, so accept unknown.
  items: unknown;
  totalCents: number;
  status: string;
  createdAt: string;
}

interface TransactionRow {
  id: string;
  userName: string;
  cents: number;
  type: string;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

// Phase 6c — single-use printable gift card. Status is derived server-side.
interface GiftCardRow {
  code: string;
  cents: number;
  status: 'unredeemed' | 'redeemed' | 'revoked';
  note: string | null;
  createdAt: string;
  redeemedByName: string | null;
  redeemedAt: string | null;
}

// A kid-filed "I forgot my PIN" request awaiting the admin.
interface PinResetRow {
  id: string;
  user: string;
  createdAt: number;
}

type FormMode = 'topup' | 'deduct';

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function displayLabel(l: Learner): string {
  return l.displayName?.trim() || l.name;
}

// Best-effort items summary — works whether items is an array or a JSON value.
function itemsSummary(items: unknown): string {
  if (Array.isArray(items)) {
    const totalQty = items.reduce<number>((sum, it) => {
      if (it && typeof it === 'object' && 'qty' in it) {
        const q = (it as { qty?: unknown }).qty;
        return sum + (typeof q === 'number' ? q : 0);
      }
      return sum + 1;
    }, 0);
    const count = items.length;
    return totalQty && totalQty !== count
      ? `${count} line${count === 1 ? '' : 's'} · ${totalQty} item${totalQty === 1 ? '' : 's'}`
      : `${count} item${count === 1 ? '' : 's'}`;
  }
  return '—';
}

export default function MpBankDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state — persisted via ?tab= so a refresh stays put. We read once from
  // the URL on mount and push history updates when the user clicks a tab.
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    parseTab(searchParams?.get('tab') ?? null),
  );
  // Re-sync when the URL changes (e.g. browser back/forward).
  useEffect(() => {
    setActiveTab(parseTab(searchParams?.get('tab') ?? null));
  }, [searchParams]);

  const switchTab = useCallback(
    (tab: DashboardTab) => {
      setActiveTab(tab);
      // Replace (don't push) so the back button doesn't get filled with tab hops.
      const url = tab === 'money' ? '/admin/mp-bank' : `/admin/mp-bank?tab=${tab}`;
      router.replace(url, { scroll: false });
    },
    [router],
  );

  // Unread feedback count — populated by the Feedback tab when it loads,
  // surfaces in the tab bar as a badge so we know there's mail.
  const [feedbackNewCount, setFeedbackNewCount] = useState<number>(0);

  const [learners, setLearners] = useState<Learner[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [learnersError, setLearnersError] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Inline form state — only one open at a time keeps the page calm.
  const [openForm, setOpenForm] = useState<{ user: string; mode: FormMode } | null>(
    null,
  );
  const [formAmount, setFormAmount] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Card reroll — track which learner is currently being rerolled so we can
  // disable just that row's button while the request is in flight. Errors
  // surface in the same pinToast (renamed conceptually to "admin toast" but
  // kept under the existing state to avoid more boilerplate).
  const [rerollBusy, setRerollBusy] = useState<string | null>(null);

  // Track which learner is mid-delete so we disable just that row's button.
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  // Track which learner is being impersonated so we disable just that row's
  // "Log in as" button while the cookie swap is in flight.
  const [impersonateBusy, setImpersonateBusy] = useState<string | null>(null);

  // PIN reset requests — kids who clicked "Forgot PIN?". Admin sets a new
  // 4-digit PIN, tells the kid, and the kid changes it from the login screen.
  const [pinResets, setPinResets] = useState<PinResetRow[]>([]);
  const [pinResetsLoading, setPinResetsLoading] = useState(true);
  // Per-request inline "new PIN" input value, keyed by username.
  const [resetPinDraft, setResetPinDraft] = useState<Record<string, string>>({});
  // Which username's reset action is in flight (set or dismiss).
  const [resetBusy, setResetBusy] = useState<string | null>(null);

  // Gift Cards panel (Phase 6c) — create + list + revoke + print.
  const [giftCards, setGiftCards] = useState<GiftCardRow[]>([]);
  const [giftCardsLoading, setGiftCardsLoading] = useState(true);
  const [giftCardsError, setGiftCardsError] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftFormError, setGiftFormError] = useState<string | null>(null);
  // "Give directly to a kid" — picks a learner; mints + credits them in one step.
  const [giftRecipient, setGiftRecipient] = useState('');
  // The just-minted card the parent should print right now. Renders an inline
  // print-friendly modal; the parent hits Print, then closes — list refreshes
  // in the background. Null = no modal open.
  const [printCard, setPrintCard] = useState<{
    code: string;
    cents: number;
    note: string | null;
  } | null>(null);
  // Track which code is currently being revoked so we can disable just that
  // row's button instead of all of them.
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);

  // Settings panel — change parent PIN. Used to be collapsible but the Settings
  // tab now owns the whole panel, so we just track the form state directly.
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  // Toast: ephemeral feedback for the PIN rotation. Auto-dismisses after ~3s.
  const [pinToast, setPinToast] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);

  useEffect(() => {
    if (!pinToast) return;
    const t = window.setTimeout(() => setPinToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [pinToast]);

  // Sections kill switch — list of section keys currently turned OFF site-wide.
  // null = not loaded yet. `sectionBusy` is the key whose toggle is in flight.
  const [disabledSections, setDisabledSections] = useState<string[] | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionBusy, setSectionBusy] = useState<string | null>(null);

  // Centralised 401 handling: any parent-gated endpoint that comes back 401
  // means the cookie expired or was cleared — bounce to login.
  const handleUnauth = useCallback(() => {
    router.push('/admin/mp-bank/login');
  }, [router]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    setLearnersError(null);
    try {
      const res = await fetch('/api/money/admin/learners', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { learners?: Learner[] };
      setLearners(Array.isArray(data.learners) ? data.learners : []);
    } catch (err) {
      setLearnersError(err instanceof Error ? err.message : 'Failed to load learners');
    } finally {
      setLearnersLoading(false);
    }
  }, [handleUnauth]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch('/api/money/admin/orders', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders?: OrderRow[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [handleUnauth]);

  const loadTransactions = useCallback(
    async (user: string) => {
      if (!user) {
        setTransactions([]);
        return;
      }
      setTxLoading(true);
      setTxError(null);
      try {
        const res = await fetch(
          `/api/money/transactions?user=${encodeURIComponent(user)}&limit=100`,
          { cache: 'no-store' },
        );
        if (res.status === 401) {
          handleUnauth();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { transactions?: TransactionRow[] };
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } catch (err) {
        setTxError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setTxLoading(false);
      }
    },
    [handleUnauth],
  );

  const loadGiftCards = useCallback(async () => {
    setGiftCardsLoading(true);
    setGiftCardsError(null);
    try {
      const res = await fetch('/api/money/gift-card/list', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { cards?: GiftCardRow[] };
      setGiftCards(Array.isArray(data.cards) ? data.cards : []);
    } catch (err) {
      setGiftCardsError(err instanceof Error ? err.message : 'Failed to load gift cards');
    } finally {
      setGiftCardsLoading(false);
    }
  }, [handleUnauth]);

  const loadPinResets = useCallback(async () => {
    setPinResetsLoading(true);
    try {
      const res = await fetch('/api/admin/pin-resets', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { requests?: PinResetRow[] };
      setPinResets(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      // Non-fatal — the dashboard works without the reset panel.
    } finally {
      setPinResetsLoading(false);
    }
  }, [handleUnauth]);

  // Load the kill-switch state. The GET is public, but we still route 401s
  // through the same handler for consistency (it shouldn't 401 in practice).
  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    try {
      const res = await fetch('/api/admin/sections', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { disabled?: unknown };
      setDisabledSections(
        Array.isArray(data.disabled)
          ? data.disabled.filter((k): k is string => typeof k === 'string')
          : [],
      );
    } catch {
      // Non-fatal — show empty (everything on) rather than break the tab.
      setDisabledSections((prev) => prev ?? []);
    } finally {
      setSectionsLoading(false);
    }
  }, [handleUnauth]);

  // Toggle one section ON/OFF. `enabled` is the DESIRED new state.
  const toggleSection = async (section: LearningSection, enabled: boolean) => {
    setSectionBusy(section.key);
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: section.key, enabled }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        disabled?: unknown;
      };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Could not update: ${msg}` });
        return;
      }
      setDisabledSections(
        Array.isArray(data.disabled)
          ? data.disabled.filter((k): k is string => typeof k === 'string')
          : [],
      );
      setPinToast({
        kind: 'success',
        message: enabled
          ? `${section.label} is ON for everyone.`
          : `${section.label} turned OFF — kids see a "being updated" message.`,
      });
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSectionBusy(null);
    }
  };

  const resolvePinReset = async (userName: string) => {
    const newPin = (resetPinDraft[userName] || '').trim();
    if (!/^\d{4}$/.test(newPin)) {
      setPinToast({ kind: 'error', message: 'New PIN must be exactly 4 digits.' });
      return;
    }
    setResetBusy(userName);
    try {
      const res = await fetch('/api/admin/pin-resets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: userName, newPin }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Reset failed: ${msg}` });
        return;
      }
      setResetPinDraft((prev) => {
        const next = { ...prev };
        delete next[userName];
        return next;
      });
      setPinToast({
        kind: 'success',
        message: `New PIN set for @${userName}. Tell them — they can change it after logging in.`,
      });
      await loadPinResets();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setResetBusy(null);
    }
  };

  const dismissPinReset = async (userName: string) => {
    setResetBusy(userName);
    try {
      const res = await fetch('/api/admin/pin-resets', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: userName }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Dismiss failed: ${msg}` });
        return;
      }
      setPinToast({ kind: 'success', message: `Dismissed @${userName}'s request.` });
      await loadPinResets();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setResetBusy(null);
    }
  };

  useEffect(() => {
    loadLearners();
    loadOrders();
    loadGiftCards();
    loadPinResets();
  }, [loadLearners, loadOrders, loadGiftCards, loadPinResets]);

  // Pull the unread-feedback count on mount so the tab badge is accurate
  // immediately, even if the user never opens the Feedback tab. Refreshes
  // when the tab is switched in case new mail arrived since the last poll.
  const refreshFeedbackCount = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback?status=new&limit=1', { cache: 'no-store' });
      if (res.status === 401) return; // handled by other loaders
      if (!res.ok) return;
      const data = (await res.json()) as { newCount?: number };
      if (typeof data.newCount === 'number') setFeedbackNewCount(data.newCount);
    } catch {
      // Silent — the dashboard works fine without the badge.
    }
  }, []);
  useEffect(() => {
    void refreshFeedbackCount();
  }, [refreshFeedbackCount, activeTab]);

  useEffect(() => {
    loadTransactions(selectedUser);
  }, [selectedUser, loadTransactions]);

  // Lazy-load the kill-switch state the first time the Sections tab is opened.
  useEffect(() => {
    if (activeTab === 'sections' && disabledSections === null) {
      void loadSections();
    }
  }, [activeTab, disabledSections, loadSections]);

  const learnerLookup = useMemo(() => {
    const m = new Map<string, Learner>();
    for (const l of learners) m.set(l.name, l);
    return m;
  }, [learners]);

  const openTopUp = (user: string) => {
    setOpenForm({ user, mode: 'topup' });
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };
  const openDeduct = (user: string) => {
    setOpenForm({ user, mode: 'deduct' });
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };
  const closeForm = () => {
    setOpenForm(null);
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openForm) return;
    const cents = dollarsInputToCents(formAmount);
    if (cents === null || cents <= 0) {
      setFormError('Enter a valid amount (e.g. 2.50).');
      return;
    }
    const reason = formReason.trim();
    if (!reason) {
      setFormError('Reason required.');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const endpoint = openForm.mode === 'topup' ? '/api/money/credit' : '/api/money/debit';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: openForm.user, cents, reason }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        balanceCents?: unknown;
      };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setFormError(msg);
        return;
      }
      // Refresh the learner row's balance + any transaction view that's open.
      closeForm();
      await loadLearners();
      if (selectedUser === openForm.user) {
        await loadTransactions(selectedUser);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setFormBusy(false);
    }
  };

  const rerollCard = async (userName: string, label: string) => {
    // Two-step confirm so a stray click can't silently nuke a kid's printed
    // card. window.confirm is fine here — the dashboard is parent-only and
    // the action's reversible (just print a new card).
    if (!window.confirm(
      `Reroll ${label}'s MP card number? Any printed cards with the old number stop working as identifiers.`,
    )) {
      return;
    }
    setRerollBusy(userName);
    try {
      const res = await fetch('/api/money/card/reroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userName }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        formatted?: unknown;
      };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Reroll failed: ${msg}` });
        return;
      }
      const formatted = typeof data.formatted === 'string' ? data.formatted : '';
      setPinToast({
        kind: 'success',
        message: `${label}'s new card: ${formatted}`,
      });
      // Refresh so the row shows the new number.
      await loadLearners();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setRerollBusy(null);
    }
  };

  const deleteLearner = async (userName: string, label: string) => {
    // Hard delete — cascades to all of this user's transactions, orders,
    // earnings, dad-asks and gift cards (schema onDelete: Cascade). No undo,
    // so make the confirm spell out exactly what disappears.
    if (!window.confirm(
      `Permanently delete ${label} (@${userName})?\n\nThis erases their balance, full transaction history, orders, earnings and any gift cards. This cannot be undone.`,
    )) {
      return;
    }
    setDeleteBusy(userName);
    try {
      const res = await fetch(
        `/api/money/admin/learners?name=${encodeURIComponent(userName)}`,
        { method: 'DELETE' },
      );
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Delete failed: ${msg}` });
        return;
      }
      // If the deleted learner was the one selected in the transaction log,
      // clear that selection so the panel doesn't query a ghost user.
      if (selectedUser === userName) {
        setSelectedUser('');
        setTransactions([]);
      }
      setPinToast({ kind: 'success', message: `Deleted ${label}.` });
      await loadLearners();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setDeleteBusy(null);
    }
  };

  const impersonate = async (userName: string, label: string) => {
    // Admin "become this user" — no password. Swaps the dl_user cookie to the
    // chosen learner and drops the sitewide return banner. We land them on the
    // hub so they see the kid's-eye view immediately.
    if (!window.confirm(
      `Log in as ${label} (@${userName})? You'll browse the site as them. A banner lets you return to admin anytime.`,
    )) {
      return;
    }
    setImpersonateBusy(userName);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: userName }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Couldn't log in as ${label}: ${msg}` });
        return;
      }
      // Hard navigate so every provider (LearnerContext, cart) re-reads the new
      // dl_user cookie from scratch.
      window.location.href = '/';
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setImpersonateBusy(null);
    }
  };

  // Give a gift card straight to a kid's balance (no printing). Mints + credits
  // in one step via /api/money/gift-card/give.
  const giveGiftCard = async () => {
    setGiftFormError(null);
    const cents = dollarsInputToCents(giftAmount);
    if (cents === null || cents <= 0) {
      setGiftFormError('Enter a valid amount (e.g. 5 or 2.50).');
      return;
    }
    if (!giftRecipient) {
      setGiftFormError('Pick a kid to give it to.');
      return;
    }
    setGiftBusy(true);
    try {
      const res = await fetch('/api/money/gift-card/give', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cents, user: giftRecipient, note: giftNote.trim() || undefined }),
      });
      if (res.status === 401) { handleUnauth(); return; }
      const data = (await res.json().catch(() => ({}))) as { error?: string; cents?: number; user?: string };
      if (!res.ok) {
        setGiftFormError(data.error || `HTTP ${res.status}`);
        return;
      }
      const kid = learnerLookup.get(giftRecipient);
      const label = kid ? displayLabel(kid) : giftRecipient;
      setPinToast({ kind: 'success', message: `Gave ${centsToMP((data.cents ?? cents))} to ${label}! 🎁` });
      setGiftAmount('');
      setGiftNote('');
      setGiftRecipient('');
      await Promise.all([loadGiftCards(), loadLearners()]);
    } catch (err) {
      setGiftFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGiftBusy(false);
    }
  };

  const submitGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setGiftFormError(null);
    const cents = dollarsInputToCents(giftAmount);
    if (cents === null || cents <= 0) {
      setGiftFormError('Enter a valid amount (e.g. 5 or 2.50).');
      return;
    }
    setGiftBusy(true);
    try {
      const res = await fetch('/api/money/gift-card/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cents, note: giftNote.trim() || undefined }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        cents?: number;
        note?: string | null;
        error?: string;
      };
      if (!res.ok || typeof data.code !== 'string' || typeof data.cents !== 'number') {
        setGiftFormError(data.error || `HTTP ${res.status}`);
        return;
      }
      // Pop up the print modal immediately — the parent's about to hand this
      // card to a kid, so they want to print right now.
      setPrintCard({
        code: data.code,
        cents: data.cents,
        note: typeof data.note === 'string' ? data.note : null,
      });
      setGiftAmount('');
      setGiftNote('');
      await loadGiftCards();
    } catch (err) {
      setGiftFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGiftBusy(false);
    }
  };

  const revokeGiftCard = async (code: string) => {
    if (!window.confirm(
      `Revoke gift card ${code}? Anyone holding the printed copy won't be able to redeem it.`,
    )) {
      return;
    }
    setRevokeBusy(code);
    try {
      const res = await fetch('/api/money/gift-card/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPinToast({
          kind: 'error',
          message: `Revoke failed: ${data.error || `HTTP ${res.status}`}`,
        });
        return;
      }
      setPinToast({ kind: 'success', message: `Revoked ${code}.` });
      await loadGiftCards();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setRevokeBusy(null);
    }
  };

  const submitPinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    // Alphanumeric, 4-12 chars. Matches lib/money/parent.isValidParentPin —
    // keep in sync if either side is loosened/tightened.
    const PIN_RE = /^[A-Za-z0-9]{4,12}$/;
    if (!PIN_RE.test(pinCurrent)) {
      setPinToast({ kind: 'error', message: 'Current PIN must be 4-12 letters or digits.' });
      return;
    }
    if (!PIN_RE.test(pinNew)) {
      setPinToast({ kind: 'error', message: 'New PIN must be 4-12 letters or digits.' });
      return;
    }
    if (pinNew !== pinConfirm) {
      setPinToast({ kind: 'error', message: 'New PIN and confirmation do not match.' });
      return;
    }
    if (pinNew === pinCurrent) {
      setPinToast({ kind: 'error', message: 'New PIN must be different from current PIN.' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch('/api/money/parent/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPin: pinCurrent, newPin: pinNew }),
      });
      if (res.status === 401) {
        // Could be wrong current PIN OR cookie expired. The route returns
        // 'Parent login required' for the latter; bounce to login in that case.
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof data.error === 'string' ? data.error : 'Unauthorized.';
        if (msg === 'Parent login required') {
          handleUnauth();
          return;
        }
        setPinToast({ kind: 'error', message: msg });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: msg });
        return;
      }
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
      setPinToast({ kind: 'success', message: 'PIN updated.' });
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setPinBusy(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/money/parent/login', { method: 'DELETE' });
    } catch {
      // Cookie clear is best-effort; redirect regardless so they can't keep
      // poking the dashboard from a stale tab.
    }
    // Drop the "view as day" preview override so a logged-out kid isn't stuck
    // in the admin's previewed day.
    document.cookie = 'mp_sabbath_override=; Path=/; Max-Age=0; SameSite=Lax';
    // Land on the home page after logging out (not the admin login screen).
    window.location.href = '/';
  };

  // Sabbath day-override (admin preview). Writes the mp_sabbath_override cookie
  // and reloads so the whole site re-evaluates the Sunday gating.
  const setSabbathOverride = (val: '' | 'sun' | 'wkdy') => {
    if (val) {
      document.cookie = `mp_sabbath_override=${val}; path=/; max-age=86400`;
    } else {
      document.cookie = 'mp_sabbath_override=; path=/; max-age=0';
    }
    window.location.reload();
  };
  const currentOverride =
    typeof document !== 'undefined'
      ? (document.cookie.match(/mp_sabbath_override=([^;]*)/)?.[1] ?? '')
      : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-yellow-50">
      <header className="bg-purple-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-yellow-300">
              <span className="text-purple-900 font-black text-sm">MP</span>
            </div>
            <div>
              <h1 className="font-black text-xl leading-tight">Admin · MP Bank</h1>
              <p className="text-yellow-200 text-xs">
                Family store-credit admin (separate from staff portal)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sabbath preview — view the site as Sunday / weekday for testing */}
            <label className="flex items-center gap-1 bg-purple-800 px-2 py-1.5 rounded-xl text-xs">
              <span className="text-yellow-200 hidden sm:inline">View as:</span>
              <select
                value={currentOverride}
                onChange={(e) => setSabbathOverride(e.target.value as '' | 'sun' | 'wkdy')}
                className="bg-purple-700 text-white rounded px-1 py-0.5 text-xs"
                title="Preview Sabbath gating as a specific day"
              >
                <option value="">Today (real)</option>
                <option value="sun">Sunday (Sabbath)</option>
                <option value="wkdy">Weekday</option>
              </select>
            </label>
            <a
              href="/admin/music"
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              🎻 Music
            </a>
            <button
              type="button"
              onClick={logout}
              className="bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav — sticky-feeling band right under the header. Persists to ?tab=
          so a refresh keeps the parent on whatever tab they were poking. */}
      <nav className="bg-white border-b-2 border-purple-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {VALID_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === 'money'
                ? '💰 Money'
                : tab === 'products'
                  ? '🛍️ Products'
                  : tab === 'feedback'
                    ? '💬 Feedback'
                    : tab === 'families'
                      ? '👨‍👩‍👧 Families'
                      : tab === 'sections'
                        ? '🛠️ Sections'
                        : '⚙️ Settings';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`px-4 py-3 text-sm font-bold border-b-4 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-purple-900 border-purple-900'
                    : 'text-purple-500 border-transparent hover:text-purple-800 hover:border-purple-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
                {tab === 'feedback' && feedbackNewCount > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center text-[10px] font-black px-1.5 min-w-[1.25rem] h-5 rounded-full ${
                      isActive ? 'bg-purple-900 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {feedbackNewCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* ---- PRODUCTS TAB ---- */}
        {activeTab === 'products' && <AdminProductsTab />}

        {/* ---- FAMILIES TAB (Admin grants Parent + creates families) ---- */}
        {activeTab === 'families' && <FamiliesAdminTab />}

        {/* ---- FEEDBACK TAB ---- */}
        {activeTab === 'feedback' && (
          <AdminFeedbackTab onCountChange={setFeedbackNewCount} />
        )}

        {/* ---- MONEY TAB (default) ---- */}
        {activeTab === 'money' && (
          <>
        {/* PIN reset requests — only shows when a kid has asked. Set a new
            4-digit PIN, tell the kid, they change it after logging in. */}
        {(pinResetsLoading ? false : pinResets.length > 0) && (
          <section className="bg-amber-50 rounded-2xl shadow-lg border-2 border-amber-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-amber-900">
                  🔑 PIN reset requests
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  A kid forgot their PIN. Set a new 4-digit one and tell them —
                  they can change it themselves after logging in.
                </p>
              </div>
              <button
                type="button"
                onClick={loadPinResets}
                className="text-sm text-amber-800 hover:text-amber-950 underline"
              >
                Refresh
              </button>
            </div>
            <ul className="divide-y divide-amber-200">
              {pinResets.map((r) => {
                const kid = learnerLookup.get(r.user);
                const label = kid ? displayLabel(kid) : r.user;
                const busy = resetBusy === r.user;
                return (
                  <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[10rem]">
                      <div className="font-bold text-amber-900">{label}</div>
                      <div className="text-xs text-amber-700">
                        @{r.user} · asked {formatShortDateTime(new Date(r.createdAt).toISOString())}
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={resetPinDraft[r.user] ?? ''}
                      onChange={(e) =>
                        setResetPinDraft((prev) => ({
                          ...prev,
                          [r.user]: e.target.value.replace(/\D/g, '').slice(0, 4),
                        }))
                      }
                      placeholder="New PIN"
                      maxLength={4}
                      disabled={busy}
                      className="w-28 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:outline-none px-3 py-2 bg-white text-amber-900 tracking-[0.3em] text-center"
                    />
                    <button
                      type="button"
                      onClick={() => resolvePinReset(r.user)}
                      disabled={busy}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                    >
                      {busy ? 'Saving…' : 'Set PIN'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissPinReset(r.user)}
                      disabled={busy}
                      className="text-amber-800 hover:text-amber-950 underline text-sm disabled:opacity-50"
                      title="They remembered it — clear the request without changing anything"
                    >
                      Dismiss
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Section 1: Learner balances */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-purple-900">Learner balances</h2>
            <button
              type="button"
              onClick={loadLearners}
              disabled={learnersLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {learnersError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {learnersError}
            </div>
          )}

          {learnersLoading ? (
            <p className="text-purple-700 text-sm">Loading learners…</p>
          ) : learners.length === 0 ? (
            <p className="text-purple-700 text-sm">
              No learners yet. They&apos;ll show up here after first login.
            </p>
          ) : (
            <ul className="divide-y divide-purple-100">
              {learners.map((l) => {
                const isOpen = openForm?.user === l.name;
                const isRerolling = rerollBusy === l.name;
                const isDeleting = deleteBusy === l.name;
                const isImpersonating = impersonateBusy === l.name;
                const cardLabel = l.mpCardNumber
                  ? formatCardLocal(l.mpCardNumber)
                  : 'No card yet';
                return (
                  <li key={l.name} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-purple-900 text-lg">
                          {displayLabel(l)}
                        </div>
                        <div className="text-xs text-purple-600">
                          @{l.name} · updated {formatShortDateTime(l.updatedAt)}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-block text-xs font-mono px-2 py-0.5 rounded-full ${
                              l.mpCardNumber
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-gray-100 text-gray-600 italic'
                            }`}
                          >
                            {cardLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => rerollCard(l.name, displayLabel(l))}
                            disabled={isRerolling}
                            className="text-xs text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
                            title="Generate a new card number — use if the old one leaked"
                          >
                            {isRerolling ? 'Rerolling…' : '🎲 Reroll card'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-black text-2xl text-purple-900 tabular-nums">
                          {centsToMP(l.balanceCents)}
                        </div>
                        <button
                          type="button"
                          onClick={() => openTopUp(l.name)}
                          className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors"
                        >
                          Top up
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeduct(l.name)}
                          className="bg-yellow-100 hover:bg-yellow-200 text-purple-900 font-bold px-3 py-2 rounded-xl text-sm border-2 border-yellow-300 transition-colors"
                        >
                          Deduct
                        </button>
                        <button
                          type="button"
                          onClick={() => impersonate(l.name, displayLabel(l))}
                          disabled={isImpersonating}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-3 py-2 rounded-xl text-sm border-2 border-amber-300 transition-colors disabled:opacity-50"
                          title="Log in as this user (no password) — a banner lets you return"
                        >
                          {isImpersonating ? 'Logging in…' : 'Log in as'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLearner(l.name, displayLabel(l))}
                          disabled={isDeleting}
                          className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-2 rounded-xl text-sm border-2 border-red-200 transition-colors disabled:opacity-50"
                          title="Permanently delete this learner and all their data"
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {isOpen && openForm && (
                      <form
                        onSubmit={submitForm}
                        className="mt-4 bg-purple-50 rounded-xl p-4 border border-purple-200"
                      >
                        <div className="font-semibold text-purple-900 mb-3 text-sm">
                          {openForm.mode === 'topup'
                            ? `Top up ${displayLabel(l)}`
                            : `Deduct from ${displayLabel(l)}`}
                        </div>
                        <div className="grid sm:grid-cols-[140px_1fr_auto] gap-3 items-start">
                          <div>
                            <label className="block text-xs font-medium text-purple-900 mb-1">
                              Amount ($)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formAmount}
                              onChange={(e) => setFormAmount(e.target.value)}
                              placeholder="2.50"
                              disabled={formBusy}
                              autoFocus
                              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-purple-900 mb-1">
                              Reason
                            </label>
                            <input
                              type="text"
                              value={formReason}
                              onChange={(e) => setFormReason(e.target.value)}
                              placeholder="Chores, birthday gift, correction…"
                              maxLength={200}
                              disabled={formBusy}
                              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                            />
                          </div>
                          <div className="flex gap-2 sm:pt-5">
                            <button
                              type="submit"
                              disabled={formBusy}
                              className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                            >
                              {formBusy
                                ? 'Saving…'
                                : openForm.mode === 'topup'
                                  ? 'Add'
                                  : 'Deduct'}
                            </button>
                            <button
                              type="button"
                              onClick={closeForm}
                              disabled={formBusy}
                              className="text-purple-700 hover:text-purple-900 underline text-sm px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {formError && (
                          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {formError}
                          </div>
                        )}
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Section 2: All recent orders */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-purple-900">All recent orders</h2>
            <button
              type="button"
              onClick={loadOrders}
              disabled={ordersLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {ordersError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {ordersError}
            </div>
          )}

          {ordersLoading ? (
            <p className="text-purple-700 text-sm">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="text-purple-700 text-sm">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-purple-700 border-b border-purple-100">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Kid</th>
                    <th className="py-2 pr-4 font-semibold">Items</th>
                    <th className="py-2 pr-4 font-semibold">Total</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {orders.map((o) => {
                    const kid = learnerLookup.get(o.userName);
                    const kidLabel = kid ? displayLabel(kid) : o.userName;
                    return (
                      <tr key={o.id} className="text-purple-900">
                        <td className="py-2 pr-4 font-medium">{kidLabel}</td>
                        <td className="py-2 pr-4">{itemsSummary(o.items)}</td>
                        <td className="py-2 pr-4 tabular-nums font-semibold">
                          {centsToMP(o.totalCents)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              o.status === 'cancelled'
                                ? 'inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800'
                                : o.status === 'pending'
                                  ? 'inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-900'
                                  : 'inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800'
                            }
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-purple-700">
                          {formatShortDateTime(o.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 3: Per-kid transaction log */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <h2 className="text-2xl font-bold text-purple-900 mb-4">
            Per-kid transaction log
          </h2>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label
                htmlFor="mp-tx-user"
                className="block text-xs font-medium text-purple-900 mb-1"
              >
                Pick a kid
              </label>
              <select
                id="mp-tx-user"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50 text-purple-900 min-w-[12rem]"
              >
                <option value="">— select a learner —</option>
                {learners.map((l) => (
                  <option key={l.name} value={l.name}>
                    {displayLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            {selectedUser && (
              <button
                type="button"
                onClick={() => loadTransactions(selectedUser)}
                disabled={txLoading}
                className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50 pb-2"
              >
                Refresh
              </button>
            )}
          </div>

          {txError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {txError}
            </div>
          )}

          {!selectedUser ? (
            <p className="text-purple-700 text-sm">
              Pick a learner above to see their ledger.
            </p>
          ) : txLoading ? (
            <p className="text-purple-700 text-sm">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <p className="text-purple-700 text-sm">No transactions for this learner.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-purple-700 border-b border-purple-100">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {transactions.map((t) => {
                    const isCredit = t.cents >= 0;
                    return (
                      <tr key={t.id} className="text-purple-900">
                        <td className="py-2 pr-4 text-purple-700 whitespace-nowrap">
                          {formatShortDateTime(t.createdAt)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-900">
                            {t.type}
                          </span>
                        </td>
                        <td
                          className={`py-2 pr-4 tabular-nums font-bold ${
                            isCredit ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {isCredit ? '+' : '−'}
                          {centsToMP(Math.abs(t.cents))}
                        </td>
                        <td className="py-2 pr-4">{t.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 4: Gift Cards (Phase 6c) — mint, list, print, revoke */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-purple-900">Gift cards</h2>
              <p className="text-xs text-purple-600 mt-1">
                Single-use printable codes. Generate, print, hand to a kid;
                they redeem at <span className="font-mono">/portal/money/redeem</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={loadGiftCards}
              disabled={giftCardsLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <form
            onSubmit={submitGiftCard}
            className="bg-purple-50 rounded-xl p-4 border border-purple-200 mb-6"
          >
            <div className="font-semibold text-purple-900 mb-3 text-sm">
              Create a new gift card
            </div>
            <div className="grid sm:grid-cols-[140px_1fr_auto] gap-3 items-start">
              <div>
                <label
                  htmlFor="gift-amount"
                  className="block text-xs font-medium text-purple-900 mb-1"
                >
                  Amount ($)
                </label>
                <input
                  id="gift-amount"
                  type="text"
                  inputMode="decimal"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  placeholder="5"
                  disabled={giftBusy}
                  className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                />
              </div>
              <div>
                <label
                  htmlFor="gift-note"
                  className="block text-xs font-medium text-purple-900 mb-1"
                >
                  Note (optional)
                </label>
                <input
                  id="gift-note"
                  type="text"
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  placeholder="Happy birthday Lilly!"
                  maxLength={200}
                  disabled={giftBusy}
                  className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                />
              </div>
              <div className="flex gap-2 sm:pt-5">
                <button
                  type="submit"
                  disabled={giftBusy}
                  className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {giftBusy ? 'Generating…' : '🖨️ Print a code'}
                </button>
              </div>
            </div>

            {/* OR give it straight to a kid's balance (no printing). */}
            <div className="mt-3 pt-3 border-t border-purple-200 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-purple-900 mb-1">
                  Or give directly to a kid
                </label>
                <select
                  value={giftRecipient}
                  onChange={(e) => setGiftRecipient(e.target.value)}
                  disabled={giftBusy}
                  className="rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 min-w-[12rem]"
                >
                  <option value="">— pick a kid —</option>
                  {learners.map((l) => (
                    <option key={l.name} value={l.name}>{displayLabel(l)}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={giveGiftCard}
                disabled={giftBusy || !giftRecipient}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                {giftBusy ? 'Giving…' : '🎁 Give now'}
              </button>
            </div>
            {giftFormError && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {giftFormError}
              </div>
            )}
          </form>

          {giftCardsError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {giftCardsError}
            </div>
          )}

          {giftCardsLoading ? (
            <p className="text-purple-700 text-sm">Loading gift cards…</p>
          ) : giftCards.length === 0 ? (
            <p className="text-purple-700 text-sm">
              No gift cards yet. Generate one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-purple-700 border-b border-purple-100">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Code</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Note</th>
                    <th className="py-2 pr-4 font-semibold">Created</th>
                    <th className="py-2 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {giftCards.map((c) => {
                    const statusClass =
                      c.status === 'redeemed'
                        ? 'bg-green-100 text-green-800'
                        : c.status === 'revoked'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-900';
                    const statusLabel =
                      c.status === 'redeemed' && c.redeemedByName && c.redeemedAt
                        ? `redeemed by ${c.redeemedByName} · ${formatShortDateTime(c.redeemedAt)}`
                        : c.status;
                    const isRevoking = revokeBusy === c.code;
                    return (
                      <tr key={c.code} className="text-purple-900 align-top">
                        <td className="py-2 pr-4 font-mono font-bold whitespace-nowrap">
                          {c.code}
                        </td>
                        <td className="py-2 pr-4 tabular-nums font-semibold">
                          {centsToMP(c.cents)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-purple-800 max-w-xs">
                          {c.note || <span className="text-purple-400">—</span>}
                        </td>
                        <td className="py-2 pr-4 text-purple-700 whitespace-nowrap">
                          {formatShortDateTime(c.createdAt)}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {c.status === 'unredeemed' ? (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setPrintCard({
                                    code: c.code,
                                    cents: c.cents,
                                    note: c.note,
                                  })
                                }
                                className="text-purple-700 hover:text-purple-900 underline text-xs"
                              >
                                🖨️ Print
                              </button>
                              <button
                                type="button"
                                onClick={() => revokeGiftCard(c.code)}
                                disabled={isRevoking}
                                className="text-red-700 hover:text-red-900 underline text-xs disabled:opacity-50"
                              >
                                {isRevoking ? 'Revoking…' : 'Revoke'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-purple-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

          </>
        )}

        {/* ---- SECTIONS TAB (kill switch) ---- */}
        {activeTab === 'sections' && (
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-purple-900">
                Learning sections
              </h2>
              <p className="text-xs text-purple-600 mt-1 max-w-xl">
                Turn a section OFF if it&apos;s broken or teaching something wrong.
                Kids see a friendly &ldquo;being updated&rdquo; message instead —
                instantly, for everyone. You (admin) can still open a disabled
                section to verify your fix. Turn it back ON when it&apos;s good.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSections}
              disabled={sectionsLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50 whitespace-nowrap"
            >
              Refresh
            </button>
          </div>

          {disabledSections === null && sectionsLoading ? (
            <p className="text-purple-700 text-sm">Loading sections…</p>
          ) : (
            <ul className="divide-y divide-purple-100">
              {LEARNING_SECTIONS.map((section) => {
                const enabled = isSectionEnabled(section.key, disabledSections ?? []);
                const busy = sectionBusy === section.key;
                return (
                  <li
                    key={section.key}
                    className="py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-purple-900">
                        {section.label}
                      </div>
                      <div className="text-xs text-purple-600">
                        <span className="font-mono">{section.href}</span>
                        {' · '}
                        <span
                          className={
                            enabled ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'
                          }
                        >
                          {enabled ? 'ON (live)' : 'OFF (hidden from kids)'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSection(section, !enabled)}
                      disabled={busy}
                      aria-pressed={enabled}
                      title={enabled ? 'Turn this section OFF' : 'Turn this section back ON'}
                      className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                        enabled
                          ? 'bg-green-500 border-green-600'
                          : 'bg-gray-300 border-gray-400'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">
                        {enabled ? 'On' : 'Off'} — {section.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}

        {/* ---- SETTINGS TAB ---- */}
        {activeTab === 'settings' && (
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="mb-3">
            <h2 className="text-2xl font-bold text-purple-900">Settings</h2>
            <p className="text-xs text-purple-600 mt-1">
              Change the parent PIN that unlocks this dashboard. Accepts 4-12
              letters or digits.
            </p>
          </div>

          {/* PIN rotation form — used to be collapsed behind a toggle; now that
              Settings has its own tab the form just stays open. */}
          <form
            onSubmit={submitPinChange}
            className="mt-5 bg-purple-50 rounded-xl p-4 border border-purple-200 max-w-xl"
          >
              <div className="font-semibold text-purple-900 mb-3 text-sm">
                Change parent PIN
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="pin-current"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    Current PIN
                  </label>
                  <input
                    id="pin-current"
                    type="password"
                    pattern="[A-Za-z0-9]{4,12}"
                    autoComplete="current-password"
                    value={pinCurrent}
                    onChange={(e) =>
                      setPinCurrent(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))
                    }
                    maxLength={12}
                    placeholder="••••••"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.3em] text-center"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pin-new"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    New PIN
                  </label>
                  <input
                    id="pin-new"
                    type="password"
                    pattern="[A-Za-z0-9]{4,12}"
                    autoComplete="new-password"
                    value={pinNew}
                    onChange={(e) =>
                      setPinNew(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))
                    }
                    maxLength={12}
                    placeholder="••••••"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.3em] text-center"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pin-confirm"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    Confirm new PIN
                  </label>
                  <input
                    id="pin-confirm"
                    type="password"
                    pattern="[A-Za-z0-9]{4,12}"
                    autoComplete="new-password"
                    value={pinConfirm}
                    onChange={(e) =>
                      setPinConfirm(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))
                    }
                    maxLength={12}
                    placeholder="••••••"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.3em] text-center"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {pinBusy ? 'Saving…' : 'Update PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinCurrent('');
                    setPinNew('');
                    setPinConfirm('');
                  }}
                  disabled={pinBusy}
                  className="text-purple-700 hover:text-purple-900 underline text-sm"
                >
                  Clear
                </button>
            </div>
          </form>
        </section>
        )}
      </main>

      {/* Print modal — pops after a card is minted so the parent can print
          immediately. The @media print block hides every other element so the
          printout is just the card. Click outside or hit Close to dismiss. */}
      {printCard && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:bg-transparent print:p-0 print:items-start"
          onClick={() => setPrintCard(null)}
          role="dialog"
          aria-modal="true"
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  body * { visibility: hidden; }
                  .gift-card-printable, .gift-card-printable * { visibility: visible; }
                  .gift-card-printable {
                    position: absolute;
                    inset: 0;
                    margin: 0;
                    padding: 2rem;
                  }
                  .no-print { display: none !important; }
                }
              `,
            }}
          />
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print mb-4">
              <div className="font-bold text-purple-900 text-lg">
                Gift card ready to print
              </div>
              <p className="text-xs text-purple-700 mt-1">
                Hit Print, fold/cut, and hand it to the kid. The code will be
                redeemable until someone uses it or you revoke it.
              </p>
            </div>

            <div className="gift-card-printable">
              <div
                className="mx-auto max-w-sm rounded-3xl shadow-xl border-4 border-yellow-300
                           bg-gradient-to-br from-purple-800 to-purple-950 text-white p-6 flex flex-col gap-4
                           relative overflow-hidden"
              >
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-yellow-300/20 border-2 border-yellow-300/40" />
                <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-yellow-300 flex items-center justify-center border-2 border-yellow-200 shadow-md">
                  <span className="text-purple-900 font-black text-sm">MP</span>
                </div>

                <div>
                  <div className="text-yellow-300 text-xs font-bold uppercase tracking-widest">
                    Mamma&apos;s Place
                  </div>
                  <div className="text-yellow-100 text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                    Gift Card · {centsToMP(printCard.cents)}
                  </div>
                </div>

                <div className="py-2 text-center">
                  <div className="text-yellow-100 text-[10px] font-semibold uppercase tracking-wider">
                    Redeem this code
                  </div>
                  <div className="text-3xl sm:text-4xl font-black tracking-[0.2em] text-yellow-300 tabular-nums mt-1">
                    {printCard.code}
                  </div>
                </div>

                {printCard.note && (
                  <div className="bg-purple-950/40 rounded-xl px-3 py-2 text-sm text-yellow-50 italic text-center">
                    &ldquo;{printCard.note}&rdquo;
                  </div>
                )}

                <div className="text-[10px] text-yellow-100/80 text-center pt-1">
                  Log in at <span className="font-mono">/portal/money/redeem</span>{' '}
                  and enter the code above.
                </div>
              </div>
            </div>

            <div className="no-print mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                🖨️ Print
              </button>
              <button
                type="button"
                onClick={() => setPrintCard(null)}
                className="bg-yellow-100 hover:bg-yellow-200 text-purple-900 font-bold px-5 py-2.5 rounded-xl text-sm border-2 border-yellow-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast — fixed bottom-right, ephemeral feedback for PIN rotation */}
      {pinToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border-2 font-semibold text-sm ${
            pinToast.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-900'
              : 'bg-red-100 border-red-300 text-red-900'
          }`}
        >
          {pinToast.message}
        </div>
      )}
    </div>
  );
}
