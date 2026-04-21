const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testCategories() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    homepage: {
      url: 'http://localhost:3000',
      categoryCount: 0,
      categories: []
    },
    shopPage: {
      url: 'http://localhost:3000/shop',
      categoryCount: 0,
      categories: []
    },
    expected: [
      'Toys & Games',
      'Audiobooks',
      'Automotive',
      'Services',
      'Home & Garden',
      'Grocery',
      'Restaurant',
      'Sports'
    ],
    missing: []
  };

  try {
    console.log('Testing Homepage Categories...');
    console.log('================================\n');

    // Navigate to homepage
    await page.goto(results.homepage.url, { waitUntil: 'networkidle0' });

    // Take screenshot of homepage
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(screenshotsDir, 'homepage.png'),
      fullPage: true
    });
    console.log('Screenshot saved: screenshots/homepage.png');

    // Wait for category section to load
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Shop by Category');
    }, { timeout: 10000 });

    // Get all category cards on homepage
    const homepageCategories = await page.$$eval('a[href^="/shop?category="]', elements => {
      return elements.map(el => {
        const text = el.textContent.trim();
        // Remove any icon characters and clean up whitespace
        return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      });
    });

    results.homepage.categoryCount = homepageCategories.length;
    results.homepage.categories = homepageCategories;

    console.log(`\nHomepage Categories Found: ${results.homepage.categoryCount}`);
    homepageCategories.forEach((cat, idx) => {
      console.log(`  ${idx + 1}. ${cat}`);
    });

    console.log('\n\nTesting Shop Page Categories...');
    console.log('================================\n');

    // Navigate to shop page
    await page.goto(results.shopPage.url, { waitUntil: 'networkidle0' });

    // Take screenshot of shop page
    await page.screenshot({
      path: path.join(screenshotsDir, 'shop-page.png'),
      fullPage: true
    });
    console.log('Screenshot saved: screenshots/shop-page.png');

    // Wait for filter section to load
    await page.waitForSelector('aside', { timeout: 10000 });

    // Get all category buttons in sidebar (excluding "All Items")
    const shopCategories = await page.$$eval('aside button', elements => {
      return elements
        .map(el => {
          const text = el.textContent.trim();
          // Remove emojis and clean up
          return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        })
        .filter(text => {
          // Filter out control buttons and empty strings
          return text &&
                 text !== 'All Items' &&
                 !text.startsWith('All ') && // Exclude "All automotive", etc.
                 text.length > 2;
        });
    });

    results.shopPage.categoryCount = shopCategories.length;
    results.shopPage.categories = shopCategories;

    console.log(`\nShop Page Categories Found: ${results.shopPage.categoryCount}`);
    shopCategories.forEach((cat, idx) => {
      console.log(`  ${idx + 1}. ${cat}`);
    });

    // Check for missing categories
    console.log('\n\nCategory Verification');
    console.log('================================\n');
    console.log('Expected Categories (8):');
    results.expected.forEach((cat, idx) => {
      console.log(`  ${idx + 1}. ${cat}`);
    });

    // Normalize category name for comparison (remove special chars, lowercase, remove spaces)
    const normalize = (str) => str.toLowerCase().replace(/\s*&\s*/g, '').replace(/\s+and\s+/g, '').replace(/[\s-]/g, '');

    // Check which expected categories are missing from homepage
    const homepageMissing = results.expected.filter(expectedCat => {
      const normalizedExpected = normalize(expectedCat);
      return !homepageCategories.some(foundCat =>
        normalize(foundCat).includes(normalizedExpected) ||
        normalizedExpected.includes(normalize(foundCat))
      );
    });

    // Check which expected categories are missing from shop page
    const shopMissing = results.expected.filter(expectedCat => {
      const normalizedExpected = normalize(expectedCat);
      return !shopCategories.some(foundCat =>
        normalize(foundCat).includes(normalizedExpected) ||
        normalizedExpected.includes(normalize(foundCat))
      );
    });

    console.log('\n\nMissing Categories:');
    if (homepageMissing.length > 0) {
      console.log(`\nHomepage missing ${homepageMissing.length} categories:`);
      homepageMissing.forEach(cat => console.log(`  - ${cat}`));
    } else {
      console.log('\nHomepage: All categories present!');
    }

    if (shopMissing.length > 0) {
      console.log(`\nShop page missing ${shopMissing.length} categories:`);
      shopMissing.forEach(cat => console.log(`  - ${cat}`));
    } else {
      console.log('\nShop page: All categories present!');
    }

    results.missing = {
      homepage: homepageMissing,
      shopPage: shopMissing
    };

    // Save results to JSON
    fs.writeFileSync(
      path.join(__dirname, 'category-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n\nResults saved to: category-test-results.json');

    console.log('\n\nSummary');
    console.log('================================');
    console.log(`Homepage: ${results.homepage.categoryCount}/8 categories`);
    console.log(`Shop Page: ${results.shopPage.categoryCount}/8 categories`);
    console.log(`Screenshots: 2 saved in screenshots/ directory`);

  } catch (error) {
    console.error('\n\nError during test:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// Run the test
testCategories().catch(console.error);
