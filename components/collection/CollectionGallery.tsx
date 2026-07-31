'use client';

// The filterable gallery — the client half of /portal/collection.
//
// The server component does the reading and the merging (lib/collection/model.ts
// buildCollection) and hands down a plain, already-deduped list. Everything here
// is presentation plus filter state, so the filter logic itself stays pure and
// unit-tested rather than tangled up in a component.
//
// KID-FRIENDLY RULES followed here:
//   * Big tap targets — every control is at least 48px tall (thumb-sized).
//   * Plain language — "Things I bought", not "Shop-sourced inventory".
//   * Phone first — filters wrap and scroll, the grid is 1-up on a small screen.

import { useMemo, useState } from 'react';
import {
  applyFilters,
  provenanceLabel,
  summarize,
  type CollectionEntry,
  type CollectionFilter,
} from '@/lib/collection/model';
import { centsToMP } from '@/lib/money/format';

/** Serialized shape — Dates cross the server/client boundary as strings. */
export interface SerializedEntry extends Omit<CollectionEntry, 'acquiredAt' | 'copies'> {
  acquiredAt: string;
  copies: Array<{
    imageId: string;
    pricePaidCents: number;
    editionNumber: number;
    createdAt: string;
    source: string;
  }>;
}

const FILTERS: Array<{ key: CollectionFilter; label: string }> = [
  { key: 'all', label: '✨ Everything' },
  { key: 'collectibles', label: '🖼️ Collectibles' },
  { key: 'shop', label: '🛍️ Shop stuff' },
  { key: 'rookies', label: '🏆 Edition #1' },
];

/** Accepts either the wire string or the rehydrated Date. */
function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CollectionGallery({ entries }: { entries: SerializedEntry[] }) {
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [set, setSet] = useState<string>('');
  const [search, setSearch] = useState('');

  // Rehydrate to the shape the pure helpers expect. Doing this once keeps the
  // filter functions identical to the ones the unit tests exercise.
  const model = useMemo<CollectionEntry[]>(
    () =>
      entries.map((e) => ({
        ...e,
        acquiredAt: new Date(e.acquiredAt),
        copies: e.copies.map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
      })),
    [entries],
  );

  const sets = useMemo(
    () => Array.from(new Set(model.map((e) => e.setName))).sort((a, b) => a.localeCompare(b)),
    [model],
  );

  const visible = useMemo(
    () => applyFilters(model, { filter, set: set || null, search }),
    [model, filter, set, search],
  );

  const totals = useMemo(() => summarize(model), [model]);

  return (
    <div>
      {/* ---- Filter bar ---- */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={
                  'font-black text-sm px-4 py-3 rounded-xl min-h-[48px] transition-colors border-2 ' +
                  (active
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-purple-800 border-purple-200 hover:border-purple-400')
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="grow">
            <span className="sr-only">Search your collection</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Search for something you own…"
              className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px] focus:border-purple-500 outline-none"
            />
          </label>
          <label className="sm:w-64">
            <span className="sr-only">Filter by set</span>
            <select
              value={set}
              onChange={(e) => setSet(e.target.value)}
              className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px] bg-white"
            >
              <option value="">📚 All sets</option>
              {sets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-gray-600 font-bold">
          Showing {visible.length} of {model.length} · {totals.totalItems} thing
          {totals.totalItems === 1 ? '' : 's'} owned
        </p>
      </div>

      {/* ---- Grid ---- */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-gray-700 font-bold">Nothing matches that.</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSet('');
              setSearch('');
            }}
            className="mt-4 bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl min-h-[48px]"
          >
            Show everything
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((entry) => (
            <article
              key={entry.key}
              className={
                'bg-white rounded-2xl shadow-md overflow-hidden border-2 flex flex-col ' +
                (entry.isRookie
                  ? 'border-yellow-400 ring-2 ring-yellow-200'
                  : 'border-purple-100')
              }
            >
              <div className="relative bg-gradient-to-br from-purple-50 to-purple-100 h-44 flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl}
                  alt={entry.title}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
                {/* QUANTITY — the "I bought 3 tires" badge. Only shown above 1,
                    so a single item stays visually quiet. */}
                {entry.quantity > 1 && (
                  <div className="absolute top-2 left-2 bg-purple-800 text-white font-black text-sm px-3 py-1.5 rounded-full shadow">
                    ×{entry.quantity}
                  </div>
                )}
                {entry.isRookie && (
                  <div className="absolute top-2 right-2 bg-yellow-300 text-purple-950 font-black text-xs px-3 py-1.5 rounded-full shadow">
                    🏆 #1
                  </div>
                )}
              </div>

              <div className="p-3 flex flex-col gap-2 grow">
                <div>
                  <div className="text-[11px] text-purple-500 uppercase font-bold tracking-wide truncate">
                    {entry.setName}
                  </div>
                  <h3 className="font-bold text-gray-800 leading-tight text-sm sm:text-base">
                    {entry.title}
                  </h3>

                  {entry.quantity > 1 && (
                    <div className="mt-1 text-xs font-black text-purple-800">
                      You own {entry.quantity} of these
                    </div>
                  )}

                  {/* EDITIONS — the collectible layer stays meaningful. */}
                  {entry.copies.length > 0 && (
                    <div className="mt-1 text-xs font-bold text-purple-700">
                      {entry.copies.some((c) => c.editionNumber === 1) ? (
                        <span className="text-amber-800 font-black">
                          🏆 Edition #1 — first ever sold
                        </span>
                      ) : (
                        <>
                          Edition #{entry.copies[0].editionNumber}
                          {entry.artwork?.editionSize ? ` of ${entry.artwork.editionSize}` : ''}
                        </>
                      )}
                      {entry.copies.length > 1 && (
                        <span className="text-purple-600">
                          {' '}
                          (+{entry.copies.length - 1} more cop
                          {entry.copies.length - 1 === 1 ? 'y' : 'ies'})
                        </span>
                      )}
                    </div>
                  )}

                  {/* HONEST PROVENANCE — replaces the old "for 0MP" line. */}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {provenanceLabel(entry)} · {formatDate(entry.acquiredAt)}
                    {entry.spentCents > 0 ? ` · ${centsToMP(entry.spentCents)}` : ''}
                  </div>
                </div>

                {entry.downloadable && entry.downloadImageId ? (
                  <a
                    href={`/api/image-store/download/${encodeURIComponent(entry.downloadImageId)}`}
                    className="mt-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-black px-4 py-3 rounded-xl transition-colors min-h-[48px]"
                  >
                    ⬇️ Download
                  </a>
                ) : (
                  <div className="mt-auto text-center text-xs text-gray-400 font-bold py-3">
                    Yours from the shop
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
