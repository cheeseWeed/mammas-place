'use client';

import { useAdminAuth } from '@/context/AdminAuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types';

interface ProductFormData {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  discount: number;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  imageUrl: string;
  images: string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isSale: boolean;
  isFeatured: boolean;
  isComingSoon: boolean;
  availableOnWebsite: boolean;
  sku: string;
  isAudiobook: boolean;
  audioPreviewUrl: string;
}

const CATEGORIES = [
  'ponies',
  'unicorns',
  'princesses',
  'bow-and-arrow',
  'rock-collections',
  'games',
  'audiobooks',
];

export default function AdminDashboardPage() {
  const { adminUser, adminLogout, isAdminAuthenticated } = useAdminAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(getEmptyFormData());
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.push('/admin');
    }
  }, [isAdminAuthenticated, router]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      } else {
        setError(data.error || 'Failed to load products');
      }
    } catch (err) {
      setError('Network error loading products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getEmptyFormData(): ProductFormData {
    return {
      id: '',
      name: '',
      price: 0,
      originalPrice: null,
      discount: 0,
      description: '',
      shortDescription: '',
      category: 'ponies',
      tags: [],
      imageUrl: '/images/placeholder.svg',
      images: [],
      inStock: true,
      stockCount: 0,
      rating: 0,
      reviewCount: 0,
      isSale: false,
      isFeatured: false,
      isComingSoon: false,
      availableOnWebsite: true,
      sku: '',
      isAudiobook: false,
      audioPreviewUrl: '',
    };
  }

  function openAddForm() {
    setEditingProduct(null);
    setFormData(getEmptyFormData());
    setFormErrors([]);
    setSaveSuccess(false);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice ?? null,
      discount: product.discount ?? 0,
      description: product.description,
      shortDescription: product.shortDescription,
      category: product.category,
      tags: product.tags || [],
      imageUrl: product.imageUrl,
      images: product.images || [],
      inStock: product.inStock,
      stockCount: product.stockCount,
      rating: product.rating,
      reviewCount: product.reviewCount,
      isSale: product.isSale,
      isFeatured: product.isFeatured,
      isComingSoon: product.isComingSoon ?? false,
      availableOnWebsite: product.availableOnWebsite,
      sku: product.sku,
      isAudiobook: product.isAudiobook ?? false,
      audioPreviewUrl: product.audioPreviewUrl ?? '',
    });
    setFormErrors([]);
    setSaveSuccess(false);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(null);
    setFormData(getEmptyFormData());
    setFormErrors([]);
    setSaveSuccess(false);
  }

  function validateForm(): string[] {
    const errors: string[] = [];
    if (!formData.id.trim()) errors.push('Product ID is required');
    if (!formData.name.trim()) errors.push('Product name is required');
    if (!formData.sku.trim()) errors.push('SKU is required');
    if (formData.price < 0) errors.push('Price cannot be negative');
    if (formData.stockCount < 0) errors.push('Stock count cannot be negative');
    if (!formData.category) errors.push('Category is required');
    return errors;
  }

  async function handleSaveProduct() {
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    setSaveSuccess(false);

    // Build product object
    const productData: Product = {
      id: formData.id,
      name: formData.name,
      price: formData.price,
      originalPrice: formData.originalPrice ?? undefined,
      discount: formData.discount,
      description: formData.description,
      shortDescription: formData.shortDescription,
      category: formData.category,
      tags: formData.tags,
      imageUrl: formData.imageUrl,
      images: formData.images.length > 0 ? formData.images : [formData.imageUrl],
      inStock: formData.inStock,
      stockCount: formData.stockCount,
      rating: formData.rating,
      reviewCount: formData.reviewCount,
      isSale: formData.isSale,
      isFeatured: formData.isFeatured,
      isComingSoon: formData.isComingSoon,
      availableOnWebsite: formData.availableOnWebsite,
      sku: formData.sku,
      createdAt: editingProduct?.createdAt || new Date().toISOString(),
      isAudiobook: formData.isAudiobook,
      audioPreviewUrl: formData.audioPreviewUrl || undefined,
    };

    try {
      const isEditing = !!editingProduct;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        await loadProducts();
        setTimeout(() => closeForm(), 1500);
      } else {
        setFormErrors([data.error || 'Failed to save product']);
      }
    } catch (err) {
      setFormErrors(['Network error saving product']);
      console.error(err);
    }
  }

  async function handleDeleteProduct(id: string) {
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadProducts();
        setDeleteConfirm(null);
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      alert('Network error deleting product');
      console.error(err);
    }
  }

  async function toggleProductField(product: Product, field: keyof Product, value: boolean) {
    const updated = { ...product, [field]: value };
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.success) {
        await loadProducts();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleLogout = () => {
    adminLogout();
    router.push('/admin');
  };

  if (!adminUser) return null;

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'inStock' && p.inStock) ||
      (filterStatus === 'outOfStock' && !p.inStock) ||
      (filterStatus === 'featured' && p.isFeatured) ||
      (filterStatus === 'onSale' && p.isSale);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: products.length,
    categories: new Set(products.map((p) => p.category)).size,
    onSale: products.filter((p) => p.isSale).length,
    featured: products.filter((p) => p.isFeatured).length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black">
            MP
          </div>
          <div>
            <div className="font-black text-sm">Mamma&apos;s Place Admin Portal</div>
            <div className="text-gray-300 text-xs">Product Management Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/upload" className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg transition-colors">
            Upload Images
          </Link>
          <Link href="/shop" className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors">
            View Store
          </Link>
          <span className="text-gray-300 text-sm">Admin: {adminUser.username}</span>
          <button
            onClick={handleLogout}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Products', value: stats.total, icon: '📦' },
            { label: 'Categories', value: stats.categories, icon: '🗂️' },
            { label: 'On Sale', value: stats.onSale, icon: '🏷️' },
            { label: 'Featured', value: stats.featured, icon: '⭐' },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-gray-300 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters and Add Button */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              placeholder="Search by name, ID, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="inStock">In Stock</option>
              <option value="outOfStock">Out of Stock</option>
              <option value="featured">Featured</option>
              <option value="onSale">On Sale</option>
            </select>

            <button
              onClick={openAddForm}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition-colors"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Loading/Error States */}
        {loading && <div className="text-center text-gray-300 py-8">Loading products...</div>}
        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-4 mb-6">{error}</div>}

        {/* Products Table */}
        {!loading && !error && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-300 uppercase">Stock</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-300 uppercase">Toggles</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover bg-gray-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2248%22 height%3D%2248%22%3E%3Crect width%3D%2248%22 height%3D%2248%22 fill%3D%22%233f3f46%22/%3E%3C/svg%3E';
                            }}
                          />
                          <div>
                            <div className="font-bold text-sm">{product.name}</div>
                            <div className="text-xs text-gray-200">{product.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{product.sku}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="bg-gray-700 px-2 py-1 rounded text-xs">{product.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        ${product.price.toFixed(2)}
                        {product.originalPrice && (
                          <div className="text-xs text-gray-400 line-through">${product.originalPrice.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={product.inStock ? 'text-green-400' : 'text-red-400'}>
                          {product.inStock ? `${product.stockCount} in stock` : 'Out of stock'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => toggleProductField(product, 'availableOnWebsite', !product.availableOnWebsite)}
                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                              product.availableOnWebsite ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                            title="Available on Website"
                          >
                            Web
                          </button>
                          <button
                            onClick={() => toggleProductField(product, 'isFeatured', !product.isFeatured)}
                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                              product.isFeatured ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                            title="Featured"
                          >
                            ⭐
                          </button>
                          <button
                            onClick={() => toggleProductField(product, 'isSale', !product.isSale)}
                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                              product.isSale ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                            title="On Sale"
                          >
                            Sale
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEditForm(product)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(product.id)}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-gray-300">No products found matching filters.</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-3xl my-8">
            <div className="bg-gray-900 px-6 py-4 border-b border-gray-700 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-black text-lg">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={closeForm} className="text-gray-300 hover:text-white text-2xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-3">
                  <div className="font-bold mb-1">Please fix the following errors:</div>
                  <ul className="list-disc list-inside text-sm">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {saveSuccess && (
                <div className="bg-green-900/30 border border-green-700 text-green-400 rounded-lg p-3 font-bold">
                  Product saved successfully!
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Product ID */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Product ID *</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingProduct}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    placeholder="e.g. pony-001"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. PNY-001"
                  />
                </div>

                {/* Product Name */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="Rainbow Sparkle Pony"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="pony, rainbow, magical"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Original Price */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Original Price (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.originalPrice ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, originalPrice: e.target.value ? parseFloat(e.target.value) : null })
                    }
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Discount % */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Discount %</label>
                  <input
                    type="number"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Stock Count */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Stock Count</label>
                  <input
                    type="number"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({ ...formData, stockCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Rating (0-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Review Count */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Review Count</label>
                  <input
                    type="number"
                    value={formData.reviewCount}
                    onChange={(e) => setFormData({ ...formData, reviewCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Image URL */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-300 mb-1">Image URL</label>
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="/images/product.svg"
                  />
                  <p className="text-xs text-gray-300 mt-1">
                    Tip: Upload images first using the <Link href="/admin/upload" className="text-purple-400 hover:underline">Upload Images</Link> page
                  </p>
                </div>

                {/* Additional Images */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-300 mb-1">Additional Images (comma-separated URLs)</label>
                  <input
                    type="text"
                    value={formData.images.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        images: e.target.value.split(',').map((url) => url.trim()).filter(Boolean),
                      })
                    }
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="/images/product-1.svg, /images/product-2.svg"
                  />
                </div>

                {/* Short Description */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-300 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="Brief one-line description"
                  />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-300 mb-1">Full Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                    placeholder="Detailed product description..."
                  />
                </div>

                {/* Audiobook fields */}
                <div className="col-span-2 bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={formData.isAudiobook}
                      onChange={(e) => setFormData({ ...formData, isAudiobook: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-bold text-gray-300">This is an audiobook</span>
                  </label>

                  {formData.isAudiobook && (
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Audio Preview URL</label>
                      <input
                        type="text"
                        value={formData.audioPreviewUrl}
                        onChange={(e) => setFormData({ ...formData, audioPreviewUrl: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                        placeholder="/audio/preview.mp3"
                      />
                    </div>
                  )}
                </div>

                {/* Boolean toggles */}
                <div className="col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'In Stock', field: 'inStock' as const },
                    { label: 'On Sale', field: 'isSale' as const },
                    { label: 'Featured', field: 'isFeatured' as const },
                    { label: 'Coming Soon', field: 'isComingSoon' as const },
                    { label: 'Available on Website', field: 'availableOnWebsite' as const },
                  ].map((toggle) => (
                    <label key={toggle.field} className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
                      <input
                        type="checkbox"
                        checked={formData[toggle.field]}
                        onChange={(e) => setFormData({ ...formData, [toggle.field]: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{toggle.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 px-6 py-4 border-t border-gray-700 flex gap-3 justify-end rounded-b-2xl">
              <button
                onClick={closeForm}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg transition-colors font-bold"
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md p-6">
            <h3 className="font-black text-lg mb-3">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirm)}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg transition-colors font-bold"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Visibility Management */}
      <div className="mt-8 bg-gray-800 rounded-2xl border border-gray-700 p-6">
        <h2 className="font-black text-xl mb-4 text-white">Category Visibility</h2>
        <p className="text-gray-300 text-sm mb-6">
          Control which categories are visible on the website. Hidden categories will not appear in navigation or product listings.
        </p>

        <CategoryVisibilityManager />
      </div>
    </div>
  );
}

function CategoryVisibilityManager() {
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategoriesState] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Import the functions dynamically to avoid SSR issues
    import('@/lib/products').then(({ getAllCategories, getHiddenCategories }) => {
      setAllCategories(getAllCategories());
      setHiddenCategoriesState(getHiddenCategories());
    });
  }, []);

  const handleToggleCategory = async (category: string) => {
    const { toggleCategoryVisibility, getHiddenCategories } = await import('@/lib/products');
    toggleCategoryVisibility(category);
    setHiddenCategoriesState(getHiddenCategories());

    // Trigger a page refresh to update the category list everywhere
    window.dispatchEvent(new Event('categoryVisibilityChanged'));
  };

  if (!mounted) {
    return <div className="text-gray-400 text-sm">Loading categories...</div>;
  }

  const categoryEmojis: Record<string, string> = {
    'automotive': '🚗',
    'grocery': '🛒',
    'home-garden': '🏡',
    'sports': '🏀',
    'toys-and-games': '🎮',
    'audiobooks': '🎧',
    'services': '🛠️',
    'restaurant': '🍽️'
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {allCategories.sort().map((category) => {
        const isHidden = hiddenCategories.includes(category);
        const emoji = categoryEmojis[category] || '📦';

        return (
          <div
            key={category}
            className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              isHidden
                ? 'bg-gray-900 border-gray-600 opacity-60'
                : 'bg-gray-700 border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm capitalize">
                  {category.replace(/-/g, ' ')}
                </div>
                {isHidden && (
                  <span className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded mt-1">
                    Hidden
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handleToggleCategory(category)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isHidden
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
              title={isHidden ? 'Click to show category' : 'Click to hide category'}
            >
              {isHidden ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
