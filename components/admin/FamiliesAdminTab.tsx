'use client';

// Admin → Families tab. The app Admin's controls for the family/chore system:
//   - flag any user as a Parent (so they can own a family + build a chart),
//   - create a family owned by a parent,
//   - see the family map (who's a parent, who's in which family).
//
// All actions hit /api/family/admin (admin-gated by the mp_parent cookie).

import { useCallback, useEffect, useState } from 'react';

interface AdminUser { name: string; displayName: string | null; isParent: boolean; familyId: string | null }
interface AdminFamily { id: string; name: string; parents: string[] }

export default function FamiliesAdminTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [families, setFamilies] = useState<AdminFamily[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyOwner, setNewFamilyOwner] = useState('');

  const load = useCallback(async () => {
    const data = await fetch('/api/family/admin', { cache: 'no-store' }).then((r) => r.json());
    if (data.ok) { setUsers(data.users); setFamilies(data.families); }
    else setMsg(data.error ?? 'Failed to load');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 4000); };

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/family/admin', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    flash(res.ok ? '✓ Done' : (data.error ?? 'Failed'));
    await load();
    return data;
  };

  const familyName = (id: string | null) => families.find((f) => f.id === id)?.name ?? (id ? '(unknown)' : '—');
  const parents = users.filter((u) => u.isParent);

  return (
    <section className="space-y-8">
      {msg && <div className="bg-purple-100 border border-purple-300 text-purple-900 rounded-xl px-4 py-2 text-sm font-semibold">{msg}</div>}

      <div>
        <h2 className="text-xl font-black text-purple-900 mb-1">Families &amp; Parents</h2>
        <p className="text-sm text-gray-600 mb-4">Flag a user as a Parent, then create their family. Parents build their own chore chart and invite members from the Parent area.</p>
      </div>

      {/* Create family */}
      <div className="bg-white rounded-2xl border-2 border-purple-100 p-5">
        <h3 className="font-black text-purple-900 mb-3">Create a family</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs font-bold text-purple-700">
            Family name
            <input value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} placeholder="The Glazier Family"
              className="mt-1 block border border-purple-200 rounded-lg px-3 py-2 text-purple-900" />
          </label>
          <label className="text-xs font-bold text-purple-700">
            Owner (a parent)
            <select value={newFamilyOwner} onChange={(e) => setNewFamilyOwner(e.target.value)}
              className="mt-1 block border border-purple-200 rounded-lg px-3 py-2 text-purple-900">
              <option value="">— pick a parent —</option>
              {parents.map((p) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
            </select>
          </label>
          <button
            onClick={async () => {
              if (!newFamilyName.trim() || !newFamilyOwner) { flash('Name + owner required (flag the owner as a parent first).'); return; }
              await post({ action: 'createFamily', ownerUser: newFamilyOwner, name: newFamilyName.trim() });
              setNewFamilyName(''); setNewFamilyOwner('');
            }}
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-5 py-2 rounded-xl"
          >
            Create
          </button>
        </div>
        {parents.length === 0 && <p className="text-xs text-amber-700 mt-2">No parents yet — flag a user below first.</p>}
      </div>

      {/* Families map */}
      {families.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-purple-100 p-5">
          <h3 className="font-black text-purple-900 mb-3">Families</h3>
          <div className="space-y-2">
            {families.map((f) => (
              <div key={f.id} className="bg-purple-50 rounded-xl p-3 text-sm">
                <span className="font-bold text-purple-900">{f.name}</span>
                <span className="text-gray-500"> · parents: {f.parents.join(', ') || '(none)'}</span>
                <span className="text-gray-400"> · members: {users.filter((u) => u.familyId === f.id).length}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users — grant/revoke parent */}
      <div className="bg-white rounded-2xl border-2 border-purple-100 p-5">
        <h3 className="font-black text-purple-900 mb-3">All users</h3>
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.name} className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 py-1.5">
              <span className="text-gray-900">
                <span className="font-bold">{u.displayName || u.name}</span>
                {u.isParent && <span className="ml-2 text-[11px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">parent</span>}
                <span className="ml-2 text-xs text-gray-400">family: {familyName(u.familyId)}</span>
              </span>
              <button
                onClick={() => post({ action: 'grantParent', username: u.name, isParent: !u.isParent })}
                className={`text-xs font-bold px-3 py-1 rounded-lg ${u.isParent ? 'bg-gray-100 text-gray-700' : 'bg-purple-700 text-white'}`}
              >
                {u.isParent ? 'revoke parent' : 'make parent'}
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="text-gray-500 text-sm">No users yet.</p>}
        </div>
      </div>
    </section>
  );
}
