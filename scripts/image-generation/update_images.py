#!/usr/bin/env python3
import json
import re

# Read the products.json file
with open('data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# Update restaurant products with local image paths
updated_count = 0
for product in products:
    if product.get('category') == 'restaurant':
        product_id = product.get('id')
        if product_id and product_id.startswith('rest-'):
            # Update imageUrl
            product['imageUrl'] = f'/images/{product_id}.svg'
            # Update images array
            product['images'] = [f'/images/{product_id}.svg']
            updated_count += 1

# Write back to file
with open('data/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, indent=2, ensure_ascii=False)

print(f"Updated {updated_count} restaurant products with local image paths")
