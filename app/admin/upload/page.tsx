'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

// Read the products from the data file to populate the dropdown
// We use a fetch to the static json since this is a client component
const PRODUCT_IDS = [
  { id: 'pony-001', name: 'Rainbow Sparkle Pony', sku: 'PNY-001' },
  { id: 'pony-002', name: 'Princess Starlight Pony', sku: 'PNY-002' },
  { id: 'pony-003', name: 'Cotton Candy Pony', sku: 'PNY-003' },
  { id: 'unicorn-001', name: 'Enchanted Twilight Unicorn', sku: 'UNI-001' },
  { id: 'unicorn-002', name: 'Golden Dream Unicorn', sku: 'UNI-002' },
  { id: 'unicorn-003', name: 'Mini Unicorn Friends Set', sku: 'UNI-003' },
  { id: 'princess-001', name: 'Princess Aurora Dress-Up Set', sku: 'PRI-001' },
  { id: 'princess-002', name: 'Royal Princess Castle Playset', sku: 'PRI-002' },
  { id: 'princess-003', name: 'Princess Jewelry Craft Kit', sku: 'PRI-003' },
  { id: 'princess-004', name: 'Princess Story Book Collection', sku: 'PRI-004' },
  { id: 'bow-001', name: 'Adventure Foam Bow & Arrow Set', sku: 'BOW-001' },
  { id: 'bow-002', name: 'Ranger Pro Archery Set', sku: 'BOW-002' },
  { id: 'bow-003', name: 'Glow-in-the-Dark Bow & Arrow', sku: 'BOW-003' },
  { id: 'rock-001', name: 'Gemstone Explorer Kit', sku: 'ROC-001' },
  { id: 'rock-002', name: 'Crystal Growing Lab', sku: 'ROC-002' },
  { id: 'rock-003', name: 'Dino Fossil & Rock Dig Kit', sku: 'ROC-003' },
  { id: 'game-001', name: 'Kingdom Quest Board Game', sku: 'GAM-001' },
  { id: 'game-002', name: 'Puzzle Palace 1000pc', sku: 'GAM-002' },
  { id: 'game-003', name: 'Card Clash Battle Game', sku: 'GAM-003' },
  { id: 'game-004', name: "Mamma's Place Family Trivia", sku: 'GAM-004' },
];

export default function AdminUploadPage() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [customName, setCustomName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; imageUrl?: string; error?: string } | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Array<{ name: string; url: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    const productId = selectedProduct || customName.trim();
    if (productId) formData.append('productId', productId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, imageUrl: data.imageUrl });
        setUploadedImages((prev) => [{ name: data.fileName, url: data.imageUrl }, ...prev]);
        setFile(null);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-purple-900">Image Upload</h1>
          <p className="text-gray-500 text-sm mt-1">Upload product images for Mamma&apos;s Place</p>
        </div>
        <Link href="/" className="text-purple-600 hover:text-purple-800 font-semibold text-sm">
          &larr; Back to Store
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
          <h2 className="font-black text-purple-900 text-lg mb-4">Upload New Image</h2>

          {/* Product selector */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">Link to Product (optional)</label>
            <select
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setCustomName(''); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">— Select a product —</option>
              {PRODUCT_IDS.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>

          {!selectedProduct && (
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">Or enter a custom filename</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. banner-hero"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank for auto-generated name</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-purple-300 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors mb-4"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded-xl object-contain" />
            ) : (
              <div className="text-gray-400">
                <div className="text-4xl mb-2">&#x1F4C1;</div>
                <p className="font-bold text-sm">Drop image here or click to browse</p>
                <p className="text-xs mt-1">JPG, PNG, WebP, GIF, SVG &mdash; max 5MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {file && (
            <p className="text-xs text-gray-500 mb-3 truncate">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>Upload Image</>
            )}
          </button>

          {result && (
            <div className={`mt-3 p-3 rounded-xl text-sm font-medium ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.success ? (
                <div>
                  <div className="font-black">Uploaded successfully!</div>
                  <div className="mt-1 text-xs font-mono bg-white px-2 py-1 rounded border border-green-200">{result.imageUrl}</div>
                </div>
              ) : (
                <div>Error: {result.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Instructions + session uploads */}
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5">
            <h3 className="font-black text-purple-900 mb-3">How It Works</h3>
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              <li>Select which product this image is for (optional)</li>
              <li>Drag &amp; drop or click to choose your image file</li>
              <li>Click <strong>Upload Image</strong></li>
              <li>The image saves to <code className="bg-white px-1 rounded">public/images/</code></li>
              <li>It automatically appears on that product&apos;s page</li>
            </ol>
            <div className="mt-3 text-xs text-gray-500 bg-white rounded-xl p-3 border border-purple-100">
              <strong>Tip:</strong> Name your image to match the product ID (e.g., <code>pony-001.jpg</code>) and it will automatically display on that product page.
            </div>
          </div>

          {uploadedImages.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
              <h3 className="font-black text-purple-900 mb-3">Uploaded This Session</h3>
              <div className="space-y-2">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2248%22 height%3D%2248%22%3E%3Crect width%3D%2248%22 height%3D%2248%22 fill%3D%22%23f3e8ff%22/%3E%3C/svg%3E';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{img.name}</p>
                      <p className="text-xs text-purple-600 font-mono truncate">{img.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
