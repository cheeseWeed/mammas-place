'use client';

// MP Bank → Products tab. DB-backed product catalog editor.
// Lists every product (including hidden / availableOnWebsite=false), supports
// edit / delete / create, and a one-shot seed button to import the legacy
// static catalog from data/products.json.
//
// Auth: every API call is parent-gated; 401 surfaces as a toast and bumps the
// user back to /admin/mp-bank/login.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types';
import { invalidateProductsCache } from '@/lib/products-client';

interface ProductFormState {
  // Mirror of the Product shape but with sale/coming-soon as separate booleans
  // and tags/images as a comma-separated string for the form (parsed on save).
  id: string;
  name: string;
  sku: string;
  price: string;
  originalPrice: string;
  discount: string;
  description: string;
  shortDescription: string;
  category: string;
  subcategory: string;
  tags: string;
  imageUrl: string;
  images: string;
  stockCount: string;
  rating: string;
  reviewCount: string;
  inStock: boolean;
  isSale: boolean;
  isFeatured: boolean;
  isComingSoon: boolean;
  availableOnWebsite: boolean;
  isAudiobook: boolean;
  audioPreviewUrl: string;
  isStudyGuide: boolean;
  studyGuideUrl: string;
  downloadUrl: string;
}

function emptyForm(): ProductFormState {
  return {
    id: '',
    name: '',
    sku: '',
    price: '',
    originalPrice: '',
    discount: '0',
    description: '',
    shortDescription: '',
    category: '',
    subcategory: '',
    tags: '',
    imageUrl: '',
    images: '',
    stockCount: '0',
    rating: '0',
    reviewCount: '0',
    inStock: true,
    isSale: false,
    isFeatured: false,
    isComingSoon: false,
    availableOnWebsite: true,
    isAudiobook: false,
    audioPreviewUrl: '',
    isStudyGuide: false,
    studyGuideUrl: '',
    downloadUrl: '',
  };
}

function productToForm(p: Product): ProductFormState {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: String(p.price ?? 0),
    originalPrice: p.originalPrice === undefined || p.originalPrice === null ? '' : String(p.originalPrice),
    discount: String(p.discount ?? 0),
    description: p.description ?? '',
    shortDescription: p.shortDescription ?? '',
    category: p.category ?? '',
    subcategory: p.subcategory ?? '',
    tags: (p.tags ?? []).join(', '),
    imageUrl: p.imageUrl ?? '',
    images: (p.images ?? []).join(', '),
    stockCount: String(p.stockCount ?? 0),
    rating: String(p.rating ?? 0),
    reviewCount: String(p.reviewCount ?? 0),
    inStock: !!p.inStock,
    isSale: !!p.isSale,
    isFeatured: !!p.isFeatured,
    isComingSoon: !!p.isComingSoon,
    availableOnWebsite: p.availableOnWebsite !== false,
    isAudiobook: !!p.isAudiobook,
    audioPreviewUrl: p.audioPreviewUrl ?? '',
    isStudyGuide: !!p.isStudyGuide,
    studyGuideUrl: p.studyGuideUrl ?? '',
    downloadUrl: p.downloadUrl ?? '',
  };
}

function splitList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function formToBody(f: ProductFormState) {
  return {
    id: f.id.trim(),
    name: f.name.trim(),
    sku: f.sku.trim(),
    price: Number(f.price) || 0,
    originalPrice: f.originalPrice.trim() === '' ? null : Number(f.originalPrice),
    discount: Number(f.discount) || 0,
    description: f.description,
    shortDescription: f.shortDescription,
    category: f.category.trim(),
    subcategory: f.subcategory.trim() || null,
    tags: splitList(f.tags),
    imageUrl: f.imageUrl.trim(),
    images: splitList(f.images),
    stockCount: Number(f.stockCount) || 0,
    rating: Number(f.rating) || 0,
    reviewCount: Number(f.reviewCount) || 0,
    inStock: f.inStock,
    isSale: f.isSale,
    isFeatured: f.isFeatured,
    isComingSoon: f.isComingSoon,
    availableOnWebsite: f.availableOnWebsite,
    isAudiobook: f.isAudiobook,
    audioPreviewUrl: f.audioPreviewUrl.trim() || null,
    isStudyGuide: f.isStudyGuide,
    studyGuideUrl: f.studyGuideUrl.trim() || null,
    downloadUrl: f.downloadUrl.trim() || null,
  };
}

export default function AdminProductsTab() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProductFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // existing id, null = new
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleUnauth = useCallback(() => {
    router.push('/admin/mp-bank/login');
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { products?: Product[] };
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [handleUnauth]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditing(emptyForm());
    setEditingId(null);
    setFormError(null);
  };
  const startEdit = (p: Product) => {
    setEditing(productToForm(p));
    setEditingId(p.id);
    setFormError(null);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditingId(null);
    setFormError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.id.trim()) {
      setFormError('Product id is required.');
      return;
    }
    if (!editing.name.trim() || !editing.sku.trim()) {
      setFormError('Name and SKU are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editingId
        ? `/api/admin/products/${encodeURIComponent(editingId)}`
        : '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(formToBody(editing)),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || `HTTP ${res.status}`);
        return;
      }
      // Bust the public /api/products cache so kid views pick up the change.
      invalidateProductsCache();
      setToast({ kind: 'success', message: editingId ? 'Product updated.' : 'Product created.' });
      cancelEdit();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(p.id)}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast({ kind: 'error', message: data.error || `HTTP ${res.status}` });
        return;
      }
      invalidateProductsCache();
      setToast({ kind: 'success', message: `Deleted ${p.name}.` });
      await load();
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const seedFromJson = async () => {
    if (!window.confirm(
      'Seed the catalog from data/products.json? This UPSERTS every row — any admin edits to existing products will be overwritten.',
    )) {
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/products/seed', { method: 'POST' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        seeded?: number;
        skipped?: number;
      };
      if (!res.ok) {
        setToast({ kind: 'error', message: data.error || `HTTP ${res.status}` });
        return;
      }
      invalidateProductsCache();
      setToast({
        kind: 'success',
        message: `Seeded ${data.seeded ?? 0} products${data.skipped ? `, ${data.skipped} skipped` : ''}.`,
      });
      await load();
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSeeding(false);
    }
  };

  const filtered = products.filter((p) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      p.name.toLowerCase().includes(f) ||
      p.id.toLowerCase().includes(f) ||
      p.sku.toLowerCase().includes(f) ||
      p.category.toLowerCase().includes(f)
    );
  });

  return (
    <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Products</h2>
          <p className="text-xs text-purple-600 mt-1">
            DB-backed catalog. Edits land instantly on the storefront after the
            page is reloaded.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={seedFromJson}
            disabled={seeding}
            className="text-xs text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            title="Upsert every row from data/products.json (one-time bootstrap)"
          >
            {seeding ? 'Seeding…' : 'Seed from JSON'}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={startNew}
            className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + New product
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, id, sku, or category…"
          className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50 text-purple-900 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-purple-700 text-sm">Loading products…</p>
      ) : filtered.length === 0 ? (
        <p className="text-purple-700 text-sm">
          {products.length === 0
            ? 'No products yet. Click "Seed from JSON" to bootstrap from the static catalog, or "+ New product".'
            : 'No products match that filter.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-purple-700 border-b border-purple-100">
              <tr>
                <th className="py-2 pr-3 font-semibold">Image</th>
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Category</th>
                <th className="py-2 pr-3 font-semibold">Price</th>
                <th className="py-2 pr-3 font-semibold">Stock</th>
                <th className="py-2 pr-3 font-semibold">Flags</th>
                <th className="py-2 pr-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {filtered.map((p) => (
                <tr key={p.id} className="text-purple-900 align-top">
                  <td className="py-2 pr-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-12 h-12 object-cover rounded-lg bg-purple-50"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-300 text-xs flex items-center justify-center">
                        —
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-purple-500">
                      {p.id} · {p.sku}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="capitalize">{p.category}</div>
                    {p.subcategory && (
                      <div className="text-xs text-purple-500 capitalize">
                        {p.subcategory}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums font-semibold">
                    ${p.price.toFixed(2)}
                    {p.originalPrice && (
                      <span className="text-xs text-gray-500 line-through ml-1">
                        ${p.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{p.stockCount}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {p.isFeatured && (
                        <span className="text-xs bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">
                          ⭐ feat
                        </span>
                      )}
                      {p.isSale && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          🏷️ sale
                        </span>
                      )}
                      {p.isComingSoon && (
                        <span className="text-xs bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded-full">
                          🔜 soon
                        </span>
                      )}
                      {!p.availableOnWebsite && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                          hidden
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-purple-700 hover:text-purple-900 underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        disabled={deletingId === p.id}
                        className="text-red-700 hover:text-red-900 underline text-xs disabled:opacity-50"
                      >
                        {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductEditModal
          form={editing}
          isNew={editingId === null}
          saving={saving}
          error={formError}
          onChange={setEditing}
          onSave={save}
          onCancel={cancelEdit}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border-2 font-semibold text-sm ${
            toast.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-900'
              : 'bg-red-100 border-red-300 text-red-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}

// ---- Edit modal --------------------------------------------------------
interface EditProps {
  form: ProductFormState;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  onChange: (next: ProductFormState) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function ProductEditModal({ form, isNew, saving, error, onChange, onSave, onCancel }: EditProps) {
  const set = <K extends keyof ProductFormState>(key: K, val: ProductFormState[K]) =>
    onChange({ ...form, [key]: val });

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onCancel()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-purple-900">
            {isNew ? 'Create product' : `Edit ${form.name || form.id}`}
          </h3>
          <button
            type="button"
            onClick={() => !saving && onCancel()}
            aria-label="Close"
            className="text-purple-400 hover:text-purple-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="ID *" hint="Unique slug, e.g. pony-001. Cannot change after create.">
              <input
                type="text"
                value={form.id}
                onChange={(e) => set('id', e.target.value)}
                disabled={!isNew || saving}
                required
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50 text-purple-900 text-sm disabled:bg-gray-100 disabled:text-gray-600"
              />
            </Field>
            <Field label="SKU *">
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                disabled={saving}
                required
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
          </div>

          <Field label="Name *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              disabled={saving}
              required
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
            />
          </Field>

          <Field label="Short description">
            <input
              type="text"
              value={form.shortDescription}
              onChange={(e) => set('shortDescription', e.target.value)}
              maxLength={300}
              disabled={saving}
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              disabled={saving}
              rows={4}
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm resize-y"
            />
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Price ($) *">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                disabled={saving}
                required
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Original price ($)" hint="For strikethrough">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.originalPrice}
                onChange={(e) => set('originalPrice', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Discount (%)">
              <input
                type="number"
                min="0"
                max="100"
                value={form.discount}
                onChange={(e) => set('discount', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Category *">
              <input
                type="text"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                disabled={saving}
                required
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Subcategory">
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => set('subcategory', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              disabled={saving}
              placeholder="pony, rainbow, girls"
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Image URL">
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Extra images (comma-separated)">
              <input
                type="text"
                value={form.images}
                onChange={(e) => set('images', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Stock count">
              <input
                type="number"
                min="0"
                value={form.stockCount}
                onChange={(e) => set('stockCount', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Rating (0-5)">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => set('rating', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
            <Field label="Review count">
              <input
                type="number"
                min="0"
                value={form.reviewCount}
                onChange={(e) => set('reviewCount', e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
              />
            </Field>
          </div>

          <fieldset className="rounded-xl border-2 border-purple-100 p-4">
            <legend className="text-xs font-semibold text-purple-900 px-2">Flags</legend>
            <div className="grid sm:grid-cols-3 gap-2">
              <Toggle label="In stock" value={form.inStock} onChange={(v) => set('inStock', v)} />
              <Toggle label="Available on website" value={form.availableOnWebsite} onChange={(v) => set('availableOnWebsite', v)} />
              <Toggle label="Featured" value={form.isFeatured} onChange={(v) => set('isFeatured', v)} />
              <Toggle label="Sale" value={form.isSale} onChange={(v) => set('isSale', v)} />
              <Toggle label="Coming soon" value={form.isComingSoon} onChange={(v) => set('isComingSoon', v)} />
              <Toggle label="Audiobook" value={form.isAudiobook} onChange={(v) => set('isAudiobook', v)} />
              <Toggle label="Study guide" value={form.isStudyGuide} onChange={(v) => set('isStudyGuide', v)} />
            </div>
          </fieldset>

          {(form.isAudiobook || form.isStudyGuide) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {form.isAudiobook && (
                <>
                  <Field label="Audio preview URL">
                    <input
                      type="text"
                      value={form.audioPreviewUrl}
                      onChange={(e) => set('audioPreviewUrl', e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
                    />
                  </Field>
                  <Field label="Download URL">
                    <input
                      type="text"
                      value={form.downloadUrl}
                      onChange={(e) => set('downloadUrl', e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
                    />
                  </Field>
                </>
              )}
              {form.isStudyGuide && (
                <Field label="Study guide URL">
                  <input
                    type="text"
                    value={form.studyGuideUrl}
                    onChange={(e) => set('studyGuideUrl', e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm"
                  />
                </Field>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !saving && onCancel()}
              disabled={saving}
              className="text-purple-700 hover:text-purple-900 underline text-sm px-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-purple-900 mb-1">
        {label}
        {hint && <span className="ml-1 font-normal text-purple-500">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-purple-900">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-purple-700"
      />
      <span>{label}</span>
    </label>
  );
}
