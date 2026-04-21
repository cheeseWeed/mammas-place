const fs = require('fs');
const path = require('path');

// Read the products.json
const productsPath = path.join(__dirname, 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Update all service products with local image paths
const updated = products.map(product => {
  if (product.category === 'services') {
    const imagePath = `/images/${product.id}.svg`;
    return {
      ...product,
      imageUrl: imagePath,
      images: [imagePath]
    };
  }
  return product;
});

// Write back to file
fs.writeFileSync(productsPath, JSON.stringify(updated, null, 2));
console.log('Successfully updated products.json with local SVG image paths for all services');
