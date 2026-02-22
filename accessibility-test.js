const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runAccessibilityTests() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {
    testDate: new Date().toISOString(),
    tester: 'Jessica Torres',
    findings: []
  };

  console.log('Starting accessibility tests...\n');

  try {
    // Test 1: Home Page
    console.log('Testing Home Page...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-home.png', fullPage: true });

    report.findings.push({
      page: 'Home',
      timestamp: new Date().toISOString(),
      url: page.url()
    });

    // Test 2: Shop Page
    console.log('Testing Shop Page...');
    await page.click('a[href="/shop"]');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-shop.png', fullPage: true });

    // Check text contrast on product cards
    const productCards = await page.locator('.border.rounded-lg').all();
    console.log(`Found ${productCards.length} product cards`);

    report.findings.push({
      page: 'Shop',
      timestamp: new Date().toISOString(),
      productCount: productCards.length
    });

    // Test 3: Add to Cart Flow
    console.log('Testing Add to Cart...');
    if (productCards.length > 0) {
      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();
      await page.waitForTimeout(500);

      // Navigate to cart
      await page.click('a[href="/cart"]');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-cart.png', fullPage: true });

      report.findings.push({
        page: 'Cart',
        timestamp: new Date().toISOString(),
        note: 'Tested add to cart and cart page'
      });
    }

    // Test 4: Checkout Page
    console.log('Testing Checkout Page...');
    const checkoutButton = page.locator('button:has-text("Proceed to Checkout")');
    if (await checkoutButton.count() > 0) {
      await checkoutButton.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-checkout.png', fullPage: true });

      // Check form labels
      const formLabels = await page.locator('label').all();
      console.log(`Found ${formLabels.length} form labels`);

      report.findings.push({
        page: 'Checkout',
        timestamp: new Date().toISOString(),
        formLabelCount: formLabels.length
      });
    }

    // Test 5: Admin Login and Dashboard
    console.log('Testing Admin Login...');
    await page.goto('http://localhost:3000/admin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-admin-login.png', fullPage: true });

    // Login as admin
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    if (await emailInput.count() > 0) {
      await emailInput.fill('admin');
      await passwordInput.fill('admin');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-admin-dashboard.png', fullPage: true });

      // Check for sign-out button
      const signOutButton = page.locator('button:has-text("Sign Out")');
      const signOutVisible = await signOutButton.count() > 0;

      report.findings.push({
        page: 'Admin Dashboard',
        timestamp: new Date().toISOString(),
        signOutButtonPresent: signOutVisible,
        signOutButtonCount: await signOutButton.count()
      });

      // Test sign-out button visibility and clickability
      if (signOutVisible) {
        const buttonBox = await signOutButton.boundingBox();
        report.findings.push({
          page: 'Admin Dashboard - Sign Out Button',
          timestamp: new Date().toISOString(),
          boundingBox: buttonBox,
          isClickable: buttonBox !== null
        });

        // Click sign out
        await signOutButton.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-admin-signout.png', fullPage: true });
      }
    }

    // Test 6: Portal Login and Dashboard
    console.log('Testing Portal Login...');
    await page.goto('http://localhost:3000/portal');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-portal-login.png', fullPage: true });

    // Login as manager
    const portalEmailInput = page.locator('input[type="email"]');
    const portalPasswordInput = page.locator('input[type="password"]');

    if (await portalEmailInput.count() > 0) {
      await portalEmailInput.fill('manager');
      await portalPasswordInput.fill('manager');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-portal-dashboard.png', fullPage: true });

      // Check for sign-out button
      const portalSignOutButton = page.locator('button:has-text("Sign Out")');
      const portalSignOutVisible = await portalSignOutButton.count() > 0;

      report.findings.push({
        page: 'Portal Dashboard',
        timestamp: new Date().toISOString(),
        signOutButtonPresent: portalSignOutVisible,
        signOutButtonCount: await portalSignOutButton.count()
      });

      if (portalSignOutVisible) {
        const buttonBox = await portalSignOutButton.boundingBox();
        report.findings.push({
          page: 'Portal Dashboard - Sign Out Button',
          timestamp: new Date().toISOString(),
          boundingBox: buttonBox,
          isClickable: buttonBox !== null
        });
      }
    }

    // Test 7: Color Contrast Check (via computed styles)
    console.log('Checking color contrast on various pages...');

    await page.goto('http://localhost:3000');
    const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span, a, button, label').all();

    const contrastIssues = [];
    for (let i = 0; i < Math.min(textElements.length, 50); i++) {
      const element = textElements[i];
      try {
        const color = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontSize: style.fontSize,
            text: el.textContent.substring(0, 50)
          };
        });

        // Check for low-opacity or grey colors
        if (color.color.includes('rgb')) {
          const rgbMatch = color.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const [_, r, g, b] = rgbMatch.map(Number);
            const isGrey = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30;
            const isLowContrast = r > 150 && g > 150 && b > 150;

            if (isGrey && isLowContrast) {
              contrastIssues.push({
                text: color.text,
                color: color.color,
                backgroundColor: color.backgroundColor,
                fontSize: color.fontSize
              });
            }
          }
        }
      } catch (e) {
        // Skip elements that can't be evaluated
      }
    }

    report.findings.push({
      page: 'Home - Contrast Analysis',
      timestamp: new Date().toISOString(),
      potentialContrastIssues: contrastIssues.slice(0, 10)
    });

    console.log('\nTests completed!');
    console.log('Screenshots saved to project directory');

    // Save report
    fs.writeFileSync('accessibility-test-results.json', JSON.stringify(report, null, 2));
    console.log('Test results saved to accessibility-test-results.json');

  } catch (error) {
    console.error('Test error:', error);
    report.error = error.message;
  } finally {
    await browser.close();
  }

  return report;
}

runAccessibilityTests().then(report => {
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total findings: ${report.findings.length}`);
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
