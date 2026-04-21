const puppeteer = require('puppeteer');
const fs = require('fs');

async function runAccessibilityTests() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  const report = {
    testDate: new Date().toISOString(),
    tester: 'Jessica Torres, Accessibility Advocate',
    findings: [],
    screenshots: []
  };

  try {
    // Test 1: Home Page
    console.log('\n=== TEST 1: HOME PAGE ===');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'test-home.png', fullPage: true });
    report.screenshots.push('test-home.png');

    const homeTextElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label'));
      return elements.slice(0, 30).map(el => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 60),
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight
        };
      });
    });

    report.findings.push({
      page: 'Home',
      url: 'http://localhost:3000',
      textElements: homeTextElements
    });

    console.log(`✓ Found ${homeTextElements.length} text elements on home page`);

    // Test 2: Shop Page
    console.log('\n=== TEST 2: SHOP PAGE ===');
    await page.click('a[href="/shop"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'test-shop.png', fullPage: true });
    report.screenshots.push('test-shop.png');

    const shopTextElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label'));
      return elements.map(el => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 60),
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize
        };
      });
    });

    report.findings.push({
      page: 'Shop',
      url: page.url(),
      textElements: shopTextElements
    });

    console.log(`✓ Found ${shopTextElements.length} text elements on shop page`);

    // Test 3: Add to Cart and Cart Page
    console.log('\n=== TEST 3: CART PAGE ===');
    const addToCartButton = await page.$('button:has-text("Add to Cart")');
    if (addToCartButton) {
      await addToCartButton.click();
      await page.waitForTimeout(500);
    } else {
      const firstButton = await page.$('button');
      const buttonText = await page.evaluate(el => el.textContent, firstButton);
      console.log(`Note: Looking for "Add to Cart" button, found: ${buttonText}`);
    }

    await page.click('a[href="/cart"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'test-cart.png', fullPage: true });
    report.screenshots.push('test-cart.png');

    const cartTextElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label'));
      return elements.map(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 60),
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          visible: rect.width > 0 && rect.height > 0
        };
      });
    });

    report.findings.push({
      page: 'Cart',
      url: page.url(),
      textElements: cartTextElements
    });

    console.log(`✓ Found ${cartTextElements.length} text elements on cart page`);

    // Test 4: Checkout Page
    console.log('\n=== TEST 4: CHECKOUT PAGE ===');
    try {
      await page.click('button:has-text("Checkout")');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 3000 });
    } catch (e) {
      console.log('Note: Checkout navigation not available or already on checkout');
    }

    await page.screenshot({ path: 'test-checkout.png', fullPage: true });
    report.screenshots.push('test-checkout.png');

    const checkoutElements = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      const buttons = Array.from(document.querySelectorAll('button'));

      return {
        labels: labels.map(el => ({
          text: el.textContent.trim(),
          htmlFor: el.getAttribute('for'),
          visible: el.getBoundingClientRect().width > 0
        })),
        inputs: inputs.map(el => ({
          type: el.type,
          id: el.id,
          name: el.name,
          placeholder: el.placeholder,
          required: el.required
        })),
        buttons: buttons.map(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            text: el.textContent.trim(),
            color: style.color,
            backgroundColor: style.backgroundColor,
            visible: rect.width > 0 && rect.height > 0
          };
        })
      };
    });

    report.findings.push({
      page: 'Checkout',
      url: page.url(),
      formElements: checkoutElements
    });

    console.log(`✓ Found ${checkoutElements.labels.length} labels, ${checkoutElements.inputs.length} inputs, ${checkoutElements.buttons.length} buttons`);

    // Test 5: Admin Login and Dashboard
    console.log('\n=== TEST 5: ADMIN DASHBOARD ===');
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'test-admin-login.png', fullPage: true });
    report.screenshots.push('test-admin-login.png');

    // Try to login
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');

    if (emailInput && passwordInput) {
      await emailInput.type('admin');
      await passwordInput.type('admin');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'test-admin-dashboard.png', fullPage: true });
      report.screenshots.push('test-admin-dashboard.png');

      // Check for sign-out button
      const signOutAnalysis = await page.evaluate(() => {
        const signOutButtons = Array.from(document.querySelectorAll('button')).filter(
          btn => btn.textContent.includes('Sign Out') || btn.textContent.includes('Logout')
        );

        return signOutButtons.map(btn => {
          const style = window.getComputedStyle(btn);
          const rect = btn.getBoundingClientRect();
          return {
            text: btn.textContent.trim(),
            color: style.color,
            backgroundColor: style.backgroundColor,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            isVisible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
          };
        });
      });

      report.findings.push({
        page: 'Admin Dashboard',
        url: page.url(),
        signOutButtons: signOutAnalysis
      });

      console.log(`✓ Found ${signOutAnalysis.length} sign-out buttons`);
      signOutAnalysis.forEach((btn, i) => {
        console.log(`  Button ${i + 1}: "${btn.text}" - Visible: ${btn.isVisible}`);
      });

      // Try to click sign out if found
      if (signOutAnalysis.length > 0 && signOutAnalysis[0].isVisible) {
        try {
          await page.click('button:has-text("Sign Out")');
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-admin-signout.png', fullPage: true });
          report.screenshots.push('test-admin-signout.png');
          console.log('✓ Successfully clicked sign-out button');
        } catch (e) {
          console.log(`✗ Could not click sign-out button: ${e.message}`);
        }
      }
    }

    // Test 6: Portal Login and Dashboard
    console.log('\n=== TEST 6: PORTAL DASHBOARD ===');
    await page.goto('http://localhost:3000/portal', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'test-portal-login.png', fullPage: true });
    report.screenshots.push('test-portal-login.png');

    const portalEmailInput = await page.$('input[type="email"]');
    const portalPasswordInput = await page.$('input[type="password"]');

    if (portalEmailInput && portalPasswordInput) {
      await portalEmailInput.type('manager');
      await portalPasswordInput.type('manager');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'test-portal-dashboard.png', fullPage: true });
      report.screenshots.push('test-portal-dashboard.png');

      // Check for sign-out button
      const portalSignOutAnalysis = await page.evaluate(() => {
        const signOutButtons = Array.from(document.querySelectorAll('button')).filter(
          btn => btn.textContent.includes('Sign Out') || btn.textContent.includes('Logout')
        );

        return signOutButtons.map(btn => {
          const style = window.getComputedStyle(btn);
          const rect = btn.getBoundingClientRect();
          return {
            text: btn.textContent.trim(),
            color: style.color,
            backgroundColor: style.backgroundColor,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            isVisible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
          };
        });
      });

      report.findings.push({
        page: 'Portal Dashboard',
        url: page.url(),
        signOutButtons: portalSignOutAnalysis
      });

      console.log(`✓ Found ${portalSignOutAnalysis.length} sign-out buttons`);
      portalSignOutAnalysis.forEach((btn, i) => {
        console.log(`  Button ${i + 1}: "${btn.text}" - Visible: ${btn.isVisible}`);
      });
    }

    // Test 7: Comprehensive Contrast Analysis
    console.log('\n=== TEST 7: CONTRAST ANALYSIS ===');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    const contrastAnalysis = await page.evaluate(() => {
      function parseColor(colorStr) {
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (match) {
          return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        }
        return null;
      }

      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function getContrastRatio(color1, color2) {
        const l1 = getLuminance(color1.r, color1.g, color1.b);
        const l2 = getLuminance(color2.r, color2.g, color2.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      const allElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, div'));
      const issues = [];

      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.length === 0 || text.length > 100) continue;

        const style = window.getComputedStyle(el);
        const color = parseColor(style.color);
        const bgColor = parseColor(style.backgroundColor);

        if (color && bgColor && bgColor.r + bgColor.g + bgColor.b > 0) {
          const contrast = getContrastRatio(color, bgColor);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = parseInt(style.fontWeight) || 400;

          // WCAG AA standards: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const minContrast = isLargeText ? 3 : 4.5;

          if (contrast < minContrast) {
            issues.push({
              text: text.substring(0, 50),
              color: style.color,
              backgroundColor: style.backgroundColor,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              contrastRatio: contrast.toFixed(2),
              required: minContrast,
              tag: el.tagName
            });
          }
        }
      }

      return issues;
    });

    report.findings.push({
      page: 'Contrast Analysis',
      contrastIssues: contrastAnalysis
    });

    console.log(`✓ Found ${contrastAnalysis.length} potential contrast issues`);
    if (contrastAnalysis.length > 0) {
      console.log('Sample issues:');
      contrastAnalysis.slice(0, 5).forEach((issue, i) => {
        console.log(`  ${i + 1}. "${issue.text}" - Contrast: ${issue.contrastRatio} (needs ${issue.required})`);
      });
    }

    console.log('\n=== TESTS COMPLETE ===');
    console.log(`Screenshots saved: ${report.screenshots.length}`);

  } catch (error) {
    console.error('Test error:', error);
    report.error = error.message;
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }

  // Save report
  fs.writeFileSync('accessibility-test-results.json', JSON.stringify(report, null, 2));
  console.log('Full results saved to accessibility-test-results.json');

  return report;
}

// Run tests
runAccessibilityTests()
  .then(() => {
    console.log('\nAll tests completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
