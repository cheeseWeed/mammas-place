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

      {/* Families map — per-family parents + members with assign/remove controls */}
      {families.length > 0 && (
        <div className="space-y-4">
          {families.map((f) => {
            const members = users.filter((u) => u.familyId === f.id);
            // Candidates to add as a parent: flagged isParent, not already a
            // parent of this family. (Includes parents currently in NO family —
            // exactly the orphaned-Dad case.)
            const parentCandidates = users.filter(
              (u) => u.isParent && !f.parents.includes(u.name),
            );
            // Candidates to add as a plain member: anyone not already in a family.
            const memberCandidates = users.filter((u) => !u.familyId);
            // Candidates to MOVE here: anyone in a DIFFERENT family. Lets the
            // admin relocate Dad (or anyone) from the wrong family to this one
            // in a single click — relocates rather than refusing.
            const moveCandidates = users.filter((u) => u.familyId && u.familyId !== f.id);
            return (
              <div key={f.id} className="bg-white rounded-2xl border-2 border-purple-100 p-5">
                <h3 className="font-black text-purple-900 mb-3">{f.name}</h3>

                {/* Members list */}
                <div className="space-y-1 mb-4">
                  {members.length === 0 && <p className="text-sm text-gray-500">No members yet.</p>}
                  {members.map((m) => {
                    const isParentHere = f.parents.includes(m.name);
                    return (
                      <div key={m.name} className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 py-1.5">
                        <span className="text-gray-900">
                          <span className="font-bold">{m.displayName || m.name}</span>
                          {isParentHere && <span className="ml-2 text-[11px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">parent</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          {isParentHere ? (
                            <button
                              onClick={() => post({ action: 'removeParent', familyId: f.id, username: m.name })}
                              className="text-xs font-bold px-3 py-1 rounded-lg bg-gray-100 text-gray-700"
                            >
                              remove parent
                            </button>
                          ) : (
                            m.isParent && (
                              <button
                                onClick={() => post({ action: 'addParentToFamily', familyId: f.id, username: m.name })}
                                className="text-xs font-bold px-3 py-1 rounded-lg bg-purple-200 text-purple-800"
                              >
                                make parent here
                              </button>
                            )
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${m.displayName || m.name} from ${f.name}?`)) {
                                void post({ action: 'removeMember', familyId: f.id, username: m.name });
                              }
                            }}
                            className="text-xs font-bold px-3 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200"
                          >
                            remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add a parent to this family (the missing flow) */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-purple-700">Add parent:</span>
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      const username = e.target.value;
                      e.currentTarget.value = '';
                      if (username) await post({ action: 'addParentToFamily', familyId: f.id, username });
                    }}
                    className="border border-purple-200 rounded-lg px-2 py-1 text-sm text-purple-900"
                  >
                    <option value="">— pick a parent —</option>
                    {parentCandidates.map((p) => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
                  </select>

                  <span className="text-xs font-bold text-purple-700 ml-2">Add member:</span>
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      const username = e.target.value;
                      e.currentTarget.value = '';
                      if (username) await post({ action: 'addMember', familyId: f.id, username });
                    }}
                    className="border border-purple-200 rounded-lg px-2 py-1 text-sm text-purple-900"
                  >
                    <option value="">— pick a user —</option>
                    {memberCandidates.map((u) => <option key={u.name} value={u.name}>{u.displayName || u.name}</option>)}
                  </select>

                  <span className="text-xs font-bold text-purple-700 ml-2">Move here:</span>
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      const username = e.target.value;
                      e.currentTarget.value = '';
                      if (username) await post({ action: 'moveToFamily', familyId: f.id, username });
                    }}
                    className="border border-purple-200 rounded-lg px-2 py-1 text-sm text-purple-900"
                    title="Relocate someone from another family into this one"
                  >
                    <option value="">— from another family —</option>
                    {moveCandidates.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.displayName || u.name} (from {familyName(u.familyId)})
                      </option>
                    ))}
                  </select>
                </div>
                {parentCandidates.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-2">No unassigned parents — flag a user as parent below first.</p>
                )}
              </div>
            );
          })}
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
