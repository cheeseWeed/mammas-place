const fs = require('fs');
const path = require('path');

// Read the products.json file
const filePath = path.join(__dirname, 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Update home-garden products with new SVG image paths
const updated = data.map(product => {
  if (product.category === 'home-garden') {
    product.imageUrl = `/images/${product.id}.svg`;
    product.images = [`/images/${product.id}.svg`];
  }
  return product;
});

// Write the updated data back to the file
fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
console.log('Successfully updated products.json with local SVG image paths');

// Show the updated products
const homeGarden = updated.filter(p => p.category === 'home-garden');
console.log(`\nUpdated ${homeGarden.length} home-garden products:`);
homeGarden.forEach(p => {
  console.log(`  ${p.id}: ${p.name} -> ${p.imageUrl}`);
});
