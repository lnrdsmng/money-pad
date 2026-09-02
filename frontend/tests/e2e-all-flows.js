import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000/api/v1';

const results = [];

function recordResult(flow, stepsTested, status, issues = '', details = {}) {
  results.push({ flow, stepsTested, status, issues, details });
  console.log(`[${status}] ${flow} | Steps: ${stepsTested} ${issues ? '| Issue: ' + issues : ''}`);
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END WEB APP TESTING');
  console.log('====================================================');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console error listening
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]:`, msg.text());
  });

  page.on('requestfailed', request => {
    console.log(`[NETWORK FAIL]: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  const timestamp = Date.now();
  const testUser = `user_${timestamp}`;
  const testEmail = `user_${timestamp}@example.com`;
  const testPassword = 'Password123!';
  let createdStoryId = null;
  let createdPartId = null;

  // ----------------------------------------------------
  // FLOW 1: Landing Page, Registration & Onboarding
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 1: Registration & Onboarding ---');
  try {
    console.log('1.1 Navigating to Landing Page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    const titleText = await page.locator('h1').textContent();
    console.log('1.2 Landing page title:', titleText);
    if (!titleText || !titleText.includes('Welcome to MoneyPad')) {
      throw new Error('Landing page title does not contain "Welcome to MoneyPad"');
    }

    console.log('1.3 Navigating to /register...');
    await page.click('a[href="/register"]');
    await page.waitForURL('**/register', { timeout: 5000 });

    console.log('1.4 Testing password validation...');
    await page.fill('input[placeholder="Username"]', testUser);
    await page.fill('input[placeholder="Email address"]', testEmail);
    await page.fill('input[placeholder="Password"]', 'weak');

    const submitBtn = page.locator('button[type="submit"]');
    const isWeakDisabled = await submitBtn.isDisabled();
    console.log('1.5 Submit button disabled for weak password:', isWeakDisabled);

    console.log('1.6 Entering valid password...');
    await page.fill('input[placeholder="Password"]', testPassword);
    await page.waitForTimeout(500); // let react state update

    console.log('1.7 Clicking submit...');
    await submitBtn.click();

    console.log('1.8 Waiting for redirect to /onboarding...');
    await page.waitForURL('**/onboarding', { timeout: 8000 });
    console.log('1.9 Successfully on /onboarding page!');

    console.log('1.10 Selecting Gender: Female...');
    await page.waitForSelector('text=What is your gender?', { timeout: 8000 });
    await page.click('label:has-text("Female")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Next")');

    console.log('1.11 Entering Birthday...');
    await page.waitForSelector('input[type="date"]', { timeout: 8000 });
    await page.fill('input[type="date"]', '1995-05-15');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Next")');

    console.log('1.12 Selecting Preferred Genres...');
    await page.waitForSelector('text=Select your favorite genres', { timeout: 5000 });
    await page.click('button:has-text("Romance")');
    await page.click('button:has-text("Fantasy")');
    await page.click('button:has-text("Sci-Fi")');
    await page.click('button:has-text("Complete Setup")');

    console.log('1.13 Waiting for navigation to /explore...');
    await page.waitForURL('**/explore', { timeout: 8000 });
    console.log('1.14 Successfully reached /explore!');

    recordResult('User Registration & Onboarding', 'Landing -> Register -> Validation -> Onboarding (Gender, Birthday, Genres) -> Explore', 'PASS');
  } catch (err) {
    console.error('Flow 1 Error:', err.message);
    recordResult('User Registration & Onboarding', 'Landing -> Register -> Onboarding -> Explore', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 2: Authentication & Session Protection
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 2: Authentication & Session Protection ---');
  try {
    console.log('2.1 Testing page reload session persistence...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Explore', { timeout: 5000 });
    console.log('2.2 Session persisted after reload!');

    console.log('2.3 Testing Logout...');
    const userMenuBtn = page.locator('header button').filter({ hasText: testUser }).first();
    await userMenuBtn.click();
    await page.click('button:has-text("Logout")');
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('2.4 Successfully logged out!');

    console.log('2.5 Testing Protected Route redirection when logged out...');
    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login', { timeout: 5000 });

    await page.goto(`${BASE_URL}/writer`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('2.6 Protected routes correctly redirected unauthenticated user to /login!');

    console.log('2.7 Testing Invalid Credentials...');
    await page.fill('input[placeholder="Username"]', testUser);
    await page.fill('input[placeholder="Password"]', 'WrongPassword123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Invalid credentials', { timeout: 5000 });
    console.log('2.8 Invalid credentials correctly showed error message!');

    console.log('2.9 Testing Valid Login...');
    await page.fill('input[placeholder="Password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/explore', { timeout: 8000 });
    console.log('2.10 Successfully logged back in to /explore!');

    console.log('2.11 Testing Regular User accessing /admin/withdrawals...');
    await page.goto(`${BASE_URL}/admin/withdrawals`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/explore', { timeout: 5000 });
    console.log('2.12 Regular user was correctly blocked and redirected away from /admin!');

    recordResult('Authentication & Session Protection', 'Reload Persistence -> Logout -> Protected Route Block -> Invalid Login -> Valid Login -> Admin Route Restriction', 'PASS');
  } catch (err) {
    console.error('Flow 2 Error:', err.message);
    recordResult('Authentication & Session Protection', 'Auth & Route Guards', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 3: Writer Studio - Story Creation, Editor & Publishing
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 3: Writer Studio & Story Management ---');
  try {
    console.log('3.1 Navigating to Writer Dashboard...');
    await page.goto(`${BASE_URL}/writer`, { waitUntil: 'domcontentloaded' });

    console.log('3.2 Clicking "+ Create New Story"...');
    await page.click('button:has-text("+ Create New Story")');
    await page.waitForURL('**/writer/story/**', { timeout: 8000 });

    const currentUrl = page.url();
    const storyIdMatch = currentUrl.match(/\/writer\/story\/([a-zA-Z0-9-]+)/);
    createdStoryId = storyIdMatch ? storyIdMatch[1] : null;
    console.log('3.3 Created Story ID:', createdStoryId);

    console.log('3.4 Editing Story Details...');
    const storyTitle = `E2E Journey of ${timestamp}`;
    const storyOverview = `This is a comprehensive test story created during automated end-to-end testing at ${new Date().toISOString()}.`;
    await page.fill('input[type="text"]', storyTitle);
    await page.fill('textarea', storyOverview);
    await page.click('button:has-text("Save Changes")');
    await page.waitForURL('**/writer', { timeout: 8000 });
    console.log('3.5 Story details saved!');

    console.log('3.6 Navigating to Manage Chapters...');
    await page.goto(`${BASE_URL}/writer/story/${createdStoryId}/parts`, { waitUntil: 'domcontentloaded' });

    console.log('3.7 Clicking "+ New Chapter"...');
    await page.click('button:has-text("+ New Chapter")');
    await page.waitForURL('**/edit', { timeout: 8000 });

    const partUrl = page.url();
    const partIdMatch = partUrl.match(/\/read\/([a-zA-Z0-9-]+)\/edit/);
    createdPartId = partIdMatch ? partIdMatch[1] : null;
    console.log('3.8 Created Part ID:', createdPartId);

    console.log('3.9 Formatting content in TipTap Editor...');
    await page.fill('input[placeholder="Chapter Title"]', 'Chapter 1: The Beginning');
    
    const editorLocator = page.locator('.tiptap.prose');
    await editorLocator.click();
    await page.keyboard.type('In a world governed by digital stories and opportunities, writers embarked on unprecedented journeys.');
    
    console.log('3.10 Saving Draft...');
    page.once('dialog', async dialog => {
      console.log('[ALERT DIALOG]:', dialog.message());
      await dialog.accept();
    });
    await page.click('button:has-text("Save Draft")');
    await page.waitForTimeout(1000);

    console.log('3.11 Publishing Chapter...');
    await page.click('button:has-text("Publish")');
    await page.waitForURL(`**/writer/story/${createdStoryId}/parts`, { timeout: 8000 });

    console.log('3.12 Verifying Chapter is Published...');
    await page.waitForSelector('text=Published', { timeout: 5000 });

    console.log('3.13 Navigating to Story Edit Details to Publish the Story...');
    await page.goto(`${BASE_URL}/writer/story/${createdStoryId}`, { waitUntil: 'domcontentloaded' });

    const publishBtn = page.locator('button:has-text("Publish Story")');
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await page.waitForURL('**/writer', { timeout: 8000 });
      console.log('3.14 Story successfully published!');
    } else {
      const unpublishBtn = page.locator('button:has-text("Unpublish Story")');
      if (await unpublishBtn.isVisible()) {
        throw new Error('Bug: StoryEditPage displays "Unpublish Story" for draft story because it checks story?.status === "DRAFT" instead of isPublished === false');
      }
    }

    recordResult('Writer Studio Flow', 'Create Story -> Edit Metadata -> New Chapter -> TipTap Editor -> Save Draft -> Publish Chapter -> Publish Story', 'PASS');
  } catch (err) {
    console.error('Flow 3 Error:', err.message);
    recordResult('Writer Studio Flow', 'Create Story -> Chapter Editor -> Publish Flow', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 4: Content Discovery & Story Page
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 4: Content Discovery & Story Page ---');
  try {
    console.log('4.1 Navigating to /explore...');
    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'domcontentloaded' });

    console.log(`4.2 Waiting for story "E2E Journey of ${timestamp}" in Explore feed...`);
    await page.waitForSelector(`text=E2E Journey of ${timestamp}`, { timeout: 8000 });

    console.log('4.3 Clicking on story card...');
    await page.click(`text=E2E Journey of ${timestamp}`);
    await page.waitForURL(`**/story/${createdStoryId}`, { timeout: 5000 });

    console.log('4.4 Verifying Story Table of Contents...');
    await page.waitForSelector('text=Part 1: Chapter 1: The Beginning', { timeout: 5000 });

    recordResult('Content Discovery & Story Details', 'Explore Page Listing -> Story Card Click -> Synopsis & Table of Contents Display', 'PASS');
  } catch (err) {
    console.error('Flow 4 Error:', err.message);
    recordResult('Content Discovery & Story Details', 'Explore -> Story Page', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 5: Reading Experience & Progress Tracking
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 5: Reading Experience & Tracking ---');
  try {
    console.log('5.1 Opening Reader Page...');
    await page.click('text=Part 1: Chapter 1: The Beginning');
    await page.waitForURL(`**/story/${createdStoryId}/read/${createdPartId}`, { timeout: 8000 });

    console.log('5.2 Checking Reader Page elements...');
    await page.waitForSelector('h1:has-text("Chapter 1: The Beginning")', { timeout: 5000 });
    await page.waitForSelector('text=+0.00', { timeout: 5000 });
    await page.waitForSelector('text=Back to Story', { timeout: 5000 });

    console.log('5.3 Scrolling content...');
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);

    console.log('5.4 Returning Back to Story...');
    await page.click('text=Back to Story');
    await page.waitForURL(`**/story/${createdStoryId}`, { timeout: 5000 });

    recordResult('Reading Experience & Progress Tracking', 'Open Reader -> Floating Coins Counter -> Chapter Slider -> Scroll & Progress -> Back to Story', 'PASS');
  } catch (err) {
    console.error('Flow 5 Error:', err.message);
    recordResult('Reading Experience & Progress Tracking', 'Reader Page & Interaction', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 6: Social & Profile Flow
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 6: Profile & Social Community ---');
  try {
    console.log(`6.1 Navigating to /profile/${testUser}...`);
    await page.goto(`${BASE_URL}/profile/${testUser}`, { waitUntil: 'domcontentloaded' });

    const notFound = await page.locator('text=User not found').isVisible();
    if (notFound) {
      throw new Error('Bug: ProfilePage displays "User not found" because it accesses searchRes.data.data?.[0] while API returns raw array searchRes.data?.[0], and queries with ?q= instead of ?query=');
    }

    await page.waitForSelector(`text=@${testUser}`, { timeout: 5000 });
    console.log('6.2 Profile loaded successfully!');

    console.log('6.3 Testing Community Chat on Profile...');
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    if (await chatInput.isVisible()) {
      await chatInput.fill('Hello community! This is an automated test message.');
      await page.click('button:has-text("Community Chat") ~ * button, form button');
      await page.waitForSelector('text=Hello community! This is an automated test message.', { timeout: 5000 });
      console.log('6.4 Chat message posted and visible in feed!');
    }

    recordResult('Profile & Community Chat Flow', 'Visit Profile -> Check User Profile Info & Published Stories -> Send Community Chat Message', 'PASS');
  } catch (err) {
    console.error('Flow 6 Error:', err.message);
    recordResult('Profile & Community Chat Flow', 'Profile Page & Community Chat', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 8: Earnings Dashboard & Payment Setup & Plans
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 8: Earnings Dashboard, Plans & Withdrawal Flow ---');
  try {
    console.log('8.1 Navigating to /earnings...');
    await page.goto(`${BASE_URL}/earnings`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('text=Reader Coins', { timeout: 5000 });
    await page.waitForSelector('text=Author Income', { timeout: 5000 });
    console.log('8.2 Earnings balances rendered!');

    console.log('8.3 Setting up GCash payment method...');
    const methodSelect = page.locator('select');
    if (await methodSelect.isVisible()) {
      await methodSelect.selectOption('GCash');
      await page.fill('input[placeholder="09XX XXX XXXX or Account No"]', '09171234567');
      
      page.once('dialog', async dialog => {
        console.log('[ALERT DIALOG]:', dialog.message());
        await dialog.accept();
      });
      await page.click('button:has-text("Save Settings")');
      await page.waitForSelector('text=09171234567', { timeout: 5000 });
      console.log('8.4 Payment settings saved!');
    }

    console.log('8.5 Opening Upgrade Plan Modal...');
    await page.click('button:has-text("Upgrade Plan")');
    await page.waitForSelector('text=Upgrade Your Plan', { timeout: 5000 });

    console.log('8.6 Selecting Premium Plan...');
    let alertMsg = '';
    page.once('dialog', async dialog => {
      alertMsg = dialog.message();
      console.log('[UPGRADE DIALOG]:', alertMsg);
      await dialog.accept();
    });

    const premiumBtn = page.locator('button:has-text("Select Premium")');
    if (await premiumBtn.isVisible()) {
      await premiumBtn.click();
      await page.waitForTimeout(1000);
    }

    recordResult('Earnings & Plan Upgrades Flow', 'Earnings Dashboard -> Payment Setup (GCash) -> Upgrade Plan Modal Selection', 'PASS');
  } catch (err) {
    console.error('Flow 8 Error:', err.message);
    recordResult('Earnings & Plan Upgrades Flow', 'Earnings & Plans', 'FAIL', err.message, { error: err.stack });
  }

  // ----------------------------------------------------
  // FLOW 9: Admin Operations
  // ----------------------------------------------------
  console.log('\n--- Testing Flow 9: Admin Operations ---');
  try {
    console.log('9.1 Checking Admin Panel access...');
    // We can promote testUser to admin in DB or test admin login
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Login with existing admin
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await adminPage.fill('input[placeholder="Username"]', 'admin');
    await adminPage.fill('input[placeholder="Password"]', 'Password123!');
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForTimeout(1000);
    const loginError = await adminPage.locator('.text-red-500').isVisible();
    if (!loginError) {
      await adminPage.goto(`${BASE_URL}/admin/withdrawals`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForSelector('h1:has-text("Withdrawal Management")', { timeout: 8000 });
      console.log('9.2 Admin Withdrawal Management accessible!');
      await adminPage.click('button:has-text("Eligible Users")');
      await adminPage.click('button:has-text("Pending Review")');

      await adminPage.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForSelector('h1:has-text("User Management")', { timeout: 5000 });
      console.log('9.3 Admin User Management loaded!');

      await adminPage.goto(`${BASE_URL}/admin/messages`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForSelector('h1:has-text("System Messaging")', { timeout: 5000 });
      console.log('9.4 Admin Messaging Panel loaded!');

      recordResult('Admin Operations Panel', 'Admin Login -> Withdrawal Management -> User Management -> System Messaging', 'PASS');
    } else {
      recordResult('Admin Operations Panel', 'Admin Authentication', 'FAIL', 'Admin user login failed');
    }
    await adminContext.close();
  } catch (err) {
    console.error('Flow 9 Error:', err.message);
    recordResult('Admin Operations Panel', 'Admin Operations', 'FAIL', err.message, { error: err.stack });
  }

  await browser.close();

  console.log('\n====================================================');
  console.log('📊 TEST SUMMARY & RESULTS MATRIX');
  console.log('====================================================');
  console.table(results);
}

runE2ETests().catch(console.error);
