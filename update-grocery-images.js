const fs = require('fs');

const products = JSON.parse(fs.readFileSync('data/products.json', 'utf-8'));

const updates = {
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
};

let updated = 0;
for (const product of products) {
  if (product.id in updates) {
    const newImage = updates[product.id];
    product.imageUrl = newImage;
    product.images = [newImage];
    updated++;
    console.log(`Updated ${product.id}: ${newImage}`);
  }
}

fs.writeFileSync('data/products.json', JSON.stringify(products, null, 2));

console.log(`\nTotal updated: ${updated} products`);
console.log('SUCCESS: File saved');
