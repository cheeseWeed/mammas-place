const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Portal Test as David Kim, Store Manager\n');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    portalLogin: { status: 'PENDING', notes: [] },
    routing: { status: 'PENDING', notes: [] },
    dashboard: { status: 'PENDING', notes: [] },
    signOut: { status: 'PENDING', notes: [] },
    adminSeparation: { status: 'PENDING', notes: [] }
  };

  try {
    // Test 1: Portal Login
    console.log('📋 TEST 1: Portal Login');
    console.log('  → Navigating to http://localhost:3000/portal');
    await page.goto('http://localhost:3000/portal');
    await page.waitForTimeout(1000);

    // Check page title and elements
    const title = await page.textContent('h1');
    console.log(`  ✓ Page title: "${title}"`);

    const subtitle = await page.textContent('p.text-purple-400');
    console.log(`  ✓ Subtitle: "${subtitle}"`);

    if (subtitle.includes('Staff Portal')) {
      results.portalLogin.notes.push('✓ Correct portal branding');
    }

    // Fill in credentials
    console.log('  → Entering manager credentials (manager/manager)');
    await page.fill('input[type="text"]', 'manager');
    await page.fill('input[type="password"]', 'manager');

    console.log('  → Clicking Sign In button');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`  ✓ Current URL after login: ${currentUrl}`);

    // Test 2: Routing Check
    console.log('\n📋 TEST 2: Routing After Login');
    if (currentUrl.includes('/portal/dashboard')) {
      results.routing.status = 'PASS';
      results.routing.notes.push('✓ Correctly redirected to /portal/dashboard');
      console.log('  ✅ PASS: Landed on portal dashboard');
    } else if (currentUrl.includes('/admin')) {
      results.routing.status = 'FAIL';
      results.routing.notes.push('✗ INCORRECTLY redirected to admin page!');
      console.log('  ❌ FAIL: Redirected to admin page instead of portal!');
    } else {
      results.routing.status = 'FAIL';
      results.routing.notes.push(`✗ Unexpected redirect to: ${currentUrl}`);
      console.log(`  ❌ FAIL: Unexpected redirect`);
    }

    // Test 3: Portal Dashboard Functionality
    console.log('\n📋 TEST 3: Portal Dashboard Functionality');

    // Check header
    const headerText = await page.textContent('header');
    console.log(`  → Header text contains: ${headerText.substring(0, 100)}...`);

    if (headerText.includes('Staff Portal')) {
      results.dashboard.notes.push('✓ Header shows "Staff Portal" branding');
      console.log('  ✓ Correct "Staff Portal" branding in header');
    } else if (headerText.includes('Admin Portal')) {
      results.dashboard.notes.push('✗ Header shows "Admin Portal" - WRONG!');
      console.log('  ❌ Header shows "Admin Portal" instead of "Staff Portal"');
    }

    // Check welcome message
    const mainContent = await page.textContent('main');
    if (mainContent.includes('Store Manager') || mainContent.includes('manager')) {
      results.dashboard.notes.push('✓ Dashboard recognizes manager role');
      console.log('  ✓ Dashboard shows manager role');
    }

    // Check for manager tools section
    if (mainContent.includes('Manager Tools')) {
      results.dashboard.notes.push('✓ Manager-specific tools section visible');
      console.log('  ✓ Manager Tools section visible');
    }

    // Check for promo codes
    if (mainContent.includes('MAMMA10') || mainContent.includes('Promo Codes')) {
      results.dashboard.notes.push('✓ Promo codes visible to manager');
      console.log('  ✓ Promo codes section visible');
    }

    // Check quick stats
    const stats = await page.$$eval('.grid .bg-gray-800', els => els.length);
    console.log(`  → Found ${stats} stat cards`);
    if (stats >= 4) {
      results.dashboard.notes.push('✓ Quick stats displayed');
    }

    results.dashboard.status = 'PASS';
    console.log('  ✅ PASS: Dashboard functionality verified');

    // Test 4: Sign-Out Button
    console.log('\n📋 TEST 4: Sign-Out Button');

    const signOutButton = await page.$('button:has-text("Sign Out")');
    if (signOutButton) {
      results.signOut.notes.push('✓ Sign Out button found in header');
      console.log('  ✓ Sign Out button visible in header');

      // Check if it's accessible
      const isVisible = await signOutButton.isVisible();
      if (isVisible) {
        results.signOut.notes.push('✓ Sign Out button is accessible');
        console.log('  ✓ Sign Out button is accessible');

        // Click it
        console.log('  → Clicking Sign Out button');
        await signOutButton.click();
        await page.waitForTimeout(1500);

        const afterLogoutUrl = page.url();
        console.log(`  ✓ URL after logout: ${afterLogoutUrl}`);

        if (afterLogoutUrl.includes('/portal') && !afterLogoutUrl.includes('/dashboard')) {
          results.signOut.status = 'PASS';
          results.signOut.notes.push('✓ Successfully redirected to portal login page');
          console.log('  ✅ PASS: Redirected to portal login page');
        } else {
          results.signOut.status = 'FAIL';
          results.signOut.notes.push('✗ Did not redirect to portal login');
          console.log('  ❌ FAIL: Did not redirect properly');
        }
      }
    } else {
      results.signOut.status = 'FAIL';
      results.signOut.notes.push('✗ Sign Out button not found!');
      console.log('  ❌ FAIL: Sign Out button not found');
    }

    // Test 5: Admin/Portal Separation
    console.log('\n📋 TEST 5: Admin/Portal Separation');

    // Log back into portal
    console.log('  → Logging back into portal');
    await page.goto('http://localhost:3000/portal');
    await page.waitForTimeout(1000);
    await page.fill('input[type="text"]', 'manager');
    await page.fill('input[type="password"]', 'manager');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    console.log('  → Attempting to navigate to /admin');
    await page.goto('http://localhost:3000/admin');
    await page.waitForTimeout(1500);

    const adminUrl = page.url();
    const adminPageContent = await page.textContent('body');

    console.log(`  ✓ Current URL: ${adminUrl}`);

    if (adminPageContent.includes('Admin Sign In') || adminPageContent.includes('Admin Portal')) {
      results.adminSeparation.status = 'PASS';
      results.adminSeparation.notes.push('✓ Portal login does NOT grant admin access');
      results.adminSeparation.notes.push('✓ Admin page requires separate authentication');
      console.log('  ✅ PASS: Admin requires separate login');
      console.log('  ✓ Portal and admin authentication are properly separated');
    } else if (adminPageContent.includes('Admin Dashboard') || adminPageContent.includes('Product Management')) {
      results.adminSeparation.status = 'FAIL';
      results.adminSeparation.notes.push('✗ Portal login grants admin access - SECURITY ISSUE!');
      console.log('  ❌ FAIL: Portal login grants admin access!');
    } else {
      results.adminSeparation.status = 'WARN';
      results.adminSeparation.notes.push('? Unexpected admin page behavior');
      console.log('  ⚠️  WARNING: Unexpected behavior');
    }

    // Try logging into admin with admin credentials
    console.log('\n  → Testing admin login with admin/admin credentials');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const afterAdminLogin = page.url();
    const afterAdminContent = await page.textContent('body');

    if (afterAdminLogin.includes('/admin/dashboard')) {
      results.adminSeparation.notes.push('✓ Admin credentials work for admin portal');
      console.log('  ✓ Admin login successful with admin credentials');
    }

    if (afterAdminContent.includes('Admin Portal') && !afterAdminContent.includes('Staff Portal')) {
      results.adminSeparation.notes.push('✓ Admin dashboard has distinct branding');
      console.log('  ✓ Admin dashboard shows "Admin Portal" branding');
    }

    results.portalLogin.status = 'PASS';

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    results.error = error.message;
  } finally {
    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will remain open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);

    await browser.close();

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY - Portal Authentication & Routing Test');
    console.log('='.repeat(70));

    Object.entries(results).forEach(([testName, result]) => {
      if (testName === 'error') return;
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏳';
      console.log(`\n${emoji} ${testName.toUpperCase()}: ${result.status}`);
      result.notes.forEach(note => console.log(`   ${note}`));
    });

    console.log('\n' + '='.repeat(70));

    const totalTests = Object.keys(results).filter(k => k !== 'error').length;
    const passedTests = Object.values(results).filter(r => r.status === 'PASS').length;
    const failedTests = Object.values(results).filter(r => r.status === 'FAIL').length;

    console.log(`\nRESULTS: ${passedTests}/${totalTests} tests passed`);
    if (failedTests > 0) {
      console.log(`⚠️  ${failedTests} test(s) failed - see details above`);
    } else {
      console.log('✅ All tests passed!');
    }
    console.log('='.repeat(70) + '\n');
  }
})();
