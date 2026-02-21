import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Product } from '@/types';

const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'products.json');

async function readProducts(): Promise<Product[]> {
  const data = await fs.readFile(PRODUCTS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeProducts(products: Product[]): Promise<void> {
  await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

// GET all products
export async function GET() {
  try {
    const products = await readProducts();
    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error('Error reading products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read products' },
      { status: 500 }
    );
  }
}

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const newProduct: Product = await request.json();

    // Validate required fields
    if (!newProduct.id || !newProduct.name || !newProduct.sku) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, name, or sku' },
        { status: 400 }
      );
    }

    const products = await readProducts();

    // Check for duplicate ID or SKU
    if (products.some(p => p.id === newProduct.id)) {
      return NextResponse.json(
        { success: false, error: 'Product with this ID already exists' },
        { status: 400 }
      );
    }

    if (products.some(p => p.sku === newProduct.sku)) {
      return NextResponse.json(
        { success: false, error: 'Product with this SKU already exists' },
        { status: 400 }
      );
    }

    // Add timestamp if not provided
    if (!newProduct.createdAt) {
      newProduct.createdAt = new Date().toISOString();
    }

    products.push(newProduct);
    await writeProducts(products);

    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT - Update existing product
export async function PUT(request: NextRequest) {
  try {
    const updatedProduct: Product = await request.json();

    if (!updatedProduct.id) {
      return NextResponse.json(
        { success: false, error: 'Missing product ID' },
        { status: 400 }
      );
    }

    const products = await readProducts();
    const index = products.findIndex(p => p.id === updatedProduct.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if SKU is being changed to one that already exists
    if (products.some(p => p.sku === updatedProduct.sku && p.id !== updatedProduct.id)) {
      return NextResponse.json(
        { success: false, error: 'Another product with this SKU already exists' },
        { status: 400 }
      );
    }

    products[index] = updatedProduct;
    await writeProducts(products);

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Remove product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing product ID' },
        { status: 400 }
      );
    }

    const products = await readProducts();
    const filteredProducts = products.filter(p => p.id !== id);

    if (filteredProducts.length === products.length) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    await writeProducts(filteredProducts);

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
