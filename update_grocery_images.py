#!/usr/bin/env python3
import json

# Read the products file
with open('data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# Map of product IDs to update with new image paths
updates = {
    'pasta-001': '/images/pasta-001.svg',
    'rice-001': '/images/rice-001.svg',
    'sauce-001': '/images/sauce-001.svg',
    'cereal-001': '/images/cereal-001.svg',
    'nuts-001': '/images/nuts-001.svg',
    'chips-001': '/images/chips-001.svg',
    'cookies-001': '/images/cookies-001.svg',
    'trailmix-001': '/images/trailmix-001.svg',
    'fruitsnacks-001': '/images/fruitsnacks-001.svg',
    'popcorn-001': '/images/popcorn-001.svg'
}

# Update products
updated_count = 0
for product in products:
    if product.get('id') in updates:
        new_image_path = updates[product['id']]
        product['imageUrl'] = new_image_path
        product['images'] = [new_image_path]
        updated_count += 1
        print(f"Updated: {product['id']} -> {new_image_path}")

print(f"\nTotal updated: {updated_count} products")

# Write back the updated products
with open('data/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print("File saved successfully")
