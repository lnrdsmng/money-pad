import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1';

async function testAll() {
  console.log('=====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE BACKEND & WORKFLOW API TESTS');
  console.log('=====================================================');

  const timestamp = Date.now();
  const testUsername = `testuser_${timestamp}`;
  const testEmail = `test_${timestamp}@example.com`;
  const testPassword = 'Password123!';
  let authToken = null;
  let userId = null;
  let storyId = null;
  let partId = null;
  let listId = null;
  let withdrawalId = null;

  const testReport = [];

  function record(flow, step, result, issue = '', details = {}) {
    testReport.push({ flow, step, result, issue, details });
    console.log(`[${result}] ${flow} | Step: ${step} ${issue ? '| Issue: ' + issue : ''}`);
  }

  // Helper for authenticated client
  const client = (token) => axios.create({
    baseURL: API_BASE,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    validateStatus: () => true, // don't throw on error status codes
  });

  // 1. TEST REGISTRATION & VALIDATION
  console.log('\n--- 1. Testing Registration Flow & Validations ---');
  try {
    // 1.1 Weak password
    const weakRes = await client().post('/auth/signup', {
      username: testUsername,
      email: testEmail,
      password: 'weak'
    });
    if (weakRes.status === 400 || weakRes.status === 422) {
      record('User Registration', 'Validation: Weak Password Rejection', 'PASS');
    } else {
      record('User Registration', 'Validation: Weak Password Rejection', 'FAIL', `Expected 400/422 but got ${weakRes.status}`);
    }

    // 1.2 Valid Signup
    const signupRes = await client().post('/auth/signup', {
      username: testUsername,
      email: testEmail,
      password: testPassword
    });

    if (signupRes.status === 200 && signupRes.data.token && signupRes.data.user) {
      authToken = signupRes.data.token;
      userId = signupRes.data.user.id;
      record('User Registration', 'Valid User Creation & Token Generation', 'PASS');
    } else {
      record('User Registration', 'Valid User Creation & Token Generation', 'FAIL', `Signup failed with status ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
    }

    // 1.3 Duplicate Signup
    const dupRes = await client().post('/auth/signup', {
      username: testUsername,
      email: testEmail,
      password: testPassword
    });
    if (dupRes.status === 422) {
      record('User Registration', 'Validation: Duplicate Username/Email Rejection', 'PASS');
    } else {
      record('User Registration', 'Validation: Duplicate Username/Email Rejection', 'FAIL', `Expected 422 but got ${dupRes.status}`);
    }
  } catch (err) {
    record('User Registration', 'Registration Flow', 'FAIL', err.message);
  }

  // 2. TEST ONBOARDING FLOW
  console.log('\n--- 2. Testing Onboarding Multi-Step Flow ---');
  try {
    const authClient = client(authToken);

    // 2.1 Gender
    const genderRes = await authClient.post(`/users/${userId}/onboarding/gender`, { gender: 'Female' });
    if (genderRes.status === 200) {
      record('User Onboarding', 'Step 1: Gender Selection', 'PASS');
    } else {
      record('User Onboarding', 'Step 1: Gender Selection', 'FAIL', `Status ${genderRes.status}: ${JSON.stringify(genderRes.data)}`);
    }

    // 2.2 Birthday
    const bdayRes = await authClient.post(`/users/${userId}/onboarding/birthday`, { birthday: '1995-06-20' });
    if (bdayRes.status === 200) {
      record('User Onboarding', 'Step 2: Birthday Selection', 'PASS');
    } else {
      record('User Onboarding', 'Step 2: Birthday Selection', 'FAIL', `Status ${bdayRes.status}: ${JSON.stringify(bdayRes.data)}`);
    }

    // 2.3 Genres
    const genresRes = await authClient.post(`/users/${userId}/onboarding/genres`, { preferredGenres: 'Romance,Fantasy,Sci-Fi' });
    if (genresRes.status === 200) {
      record('User Onboarding', 'Step 3: Preferred Genres', 'PASS');
    } else {
      record('User Onboarding', 'Step 3: Preferred Genres', 'FAIL', `Status ${genresRes.status}: ${JSON.stringify(genresRes.data)}`);
    }

    // 2.4 Complete
    const completeRes = await authClient.post(`/users/${userId}/onboarding/complete`);
    if (completeRes.status === 200) {
      record('User Onboarding', 'Step 4: Onboarding Completion', 'PASS');
    } else {
      record('User Onboarding', 'Step 4: Onboarding Completion', 'FAIL', `Status ${completeRes.status}: ${JSON.stringify(completeRes.data)}`);
    }
  } catch (err) {
    record('User Onboarding', 'Onboarding Complete Flow', 'FAIL', err.message);
  }

  // 3. TEST AUTHENTICATION & PROFILE
  console.log('\n--- 3. Testing Auth Session & Profile ---');
  try {
    const authClient = client(authToken);

    // 3.1 Get Me
    const meRes = await authClient.get('/auth/me');
    if (meRes.status === 200 && meRes.data.username === testUsername) {
      record('Authentication', 'Check Auth Profile (/auth/me)', 'PASS');
    } else {
      record('Authentication', 'Check Auth Profile (/auth/me)', 'FAIL', `Status ${meRes.status}`);
    }

    // 3.2 Update Profile
    const profileRes = await authClient.put(`/users/${userId}/profile`, {
      bio: 'Author and storyteller passionate about fantasy worlds.',
    });
    if (profileRes.status === 200) {
      record('User Profile', 'Update User Bio & Details', 'PASS');
    } else {
      record('User Profile', 'Update User Bio & Details', 'FAIL', `Status ${profileRes.status}`);
    }

    // 3.3 Search User by Username
    const searchRes = await client().get(`/users/search?query=${testUsername}`);
    if (searchRes.status === 200 && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
      record('User Discovery', 'Search User by Query', 'PASS');
    } else {
      record('User Discovery', 'Search User by Query', 'FAIL', `Status ${searchRes.status}: ${JSON.stringify(searchRes.data)}`);
    }

    // 3.4 Search User by ?q= (as sent by ProfilePage.tsx)
    const searchQRes = await client().get(`/users/search?q=${testUsername}`);
    if (searchQRes.data.length > 0 && searchQRes.data[0].username === testUsername) {
      record('User Discovery', 'Search User by ?q= (ProfilePage compatibility)', 'PASS');
    } else {
      record('User Discovery', 'Search User by ?q= (ProfilePage compatibility)', 'FAIL', `UserController ignores ?q parameter, returning all users instead of filtering`);
    }
  } catch (err) {
    record('Authentication', 'Auth & Profile', 'FAIL', err.message);
  }

  // 4. TEST WRITER STUDIO: STORY & PART MANAGEMENT
  console.log('\n--- 4. Testing Story Creation, Chapters & Publishing ---');
  try {
    const authClient = client(authToken);

    // 4.1 Create Story
    const createStoryRes = await authClient.post('/stories', {
      title: `The Chronicles of Eldoria ${timestamp}`,
      overview: 'An epic tale of magic, betrayal, and redemption.',
      genres: 'Fantasy,Adventure',
      language: 'en',
      isMature: false
    });

    if (createStoryRes.status === 201 && createStoryRes.data.id) {
      storyId = createStoryRes.data.id;
      record('Story Creation', 'Create New Story with Metadata', 'PASS');
    } else {
      record('Story Creation', 'Create New Story with Metadata', 'FAIL', `Status ${createStoryRes.status}: ${JSON.stringify(createStoryRes.data)}`);
    }

    // 4.2 Create Part (Missing order field vs with order field)
    const partWithoutOrderRes = await authClient.post(`/stories/${storyId}/parts`, {
      title: 'Chapter 1: The Awakening',
      content: '<p>The ancient forest stirred as the sun rose above the mist.</p>',
    });

    if (partWithoutOrderRes.status === 201) {
      partId = partWithoutOrderRes.data.id;
      record('Chapter Creation', 'Create Chapter without explicit order', 'PASS');
    } else {
      record('Chapter Creation', 'Create Chapter without explicit order', 'FAIL', `Failed with 422: ${JSON.stringify(partWithoutOrderRes.data.errors)} - 'order' field is strictly required`);
      
      // Retry with order
      const partWithOrder = await authClient.post(`/stories/${storyId}/parts`, {
        title: 'Chapter 1: The Awakening',
        content: '<p>The ancient forest stirred as the sun rose above the mist.</p>',
        order: 1,
      });
      if (partWithOrder.status === 201) {
        partId = partWithOrder.data.id;
      }
    }

    // 4.3 Update Part & Publish Part
    const updatePartRes = await authClient.put(`/parts/${partId}`, {
      title: 'Chapter 1: The Awakening (Revised)',
      content: '<p>The ancient forest stirred as the twin suns rose above the mist.</p>',
      isPublished: true,
      order: 1,
    });
    if (updatePartRes.status === 200) {
      record('Chapter Publishing', 'Update and Publish Story Part', 'PASS');
    } else {
      record('Chapter Publishing', 'Update and Publish Story Part', 'FAIL', `Status ${updatePartRes.status}`);
    }

    // 4.4 Publish Story
    const publishStoryRes = await authClient.post(`/stories/${storyId}/publish`);
    if (publishStoryRes.status === 200) {
      record('Story Publishing', 'Publish Story to Public Explore Feed', 'PASS');
    } else {
      record('Story Publishing', 'Publish Story to Public Explore Feed', 'FAIL', `Status ${publishStoryRes.status}`);
    }

    // 4.5 Verify Story is in Drafts / Published lists
    const publishedRes = await client().get(`/authors/${userId}/stories/published`);
    if (publishedRes.status === 200 && publishedRes.data.some(s => s.id === storyId)) {
      record('Author Stories', 'List Published Stories by Author', 'PASS');
    } else {
      record('Author Stories', 'List Published Stories by Author', 'FAIL', `Status ${publishedRes.status}`);
    }
  } catch (err) {
    record('Writer Studio', 'Story & Part Flow', 'FAIL', err.message);
  }

  // 5. TEST CONTENT DISCOVERY & READING EXPERIENCE
  console.log('\n--- 5. Testing Content Discovery, Search & Reading Flow ---');
  try {
    const authClient = client(authToken);

    // 5.1 Public Explore Stories
    const exploreRes = await client().get('/stories');
    if (exploreRes.status === 200 && Array.isArray(exploreRes.data) && exploreRes.data.some(s => s.id === storyId)) {
      record('Content Discovery', 'Public Stories Index', 'PASS');
    } else {
      record('Content Discovery', 'Public Stories Index', 'FAIL', `Status ${exploreRes.status}`);
    }

    // 5.2 Search Stories
    const searchStoryRes = await client().get(`/stories/search?query=Eldoria`);
    if (searchStoryRes.status === 200 && searchStoryRes.data.some(s => s.id === storyId)) {
      record('Story Search', 'Search Stories by Title Keyword', 'PASS');
    } else {
      record('Story Search', 'Search Stories by Title Keyword', 'FAIL', `Status ${searchStoryRes.status}`);
    }

    // 5.3 Story Details & Parts
    const storyDetailRes = await client().get(`/stories/${storyId}`);
    const partsRes = await client().get(`/stories/${storyId}/parts?onlyPublished=true`);
    if (storyDetailRes.status === 200 && partsRes.status === 200 && partsRes.data.length > 0) {
      record('Story Details', 'Fetch Story Synopsis and Published Table of Contents', 'PASS');
    } else {
      record('Story Details', 'Fetch Story Synopsis and Published Table of Contents', 'FAIL');
    }

    // 5.4 Reading Session: Start
    const sessionRes = await authClient.post('/reading/start', {
      storyId: storyId,
      partId: partId,
    });
    let sessionId = null;
    if (sessionRes.status === 200 && sessionRes.data.id) {
      sessionId = sessionRes.data.id;
      record('Reading Session', 'Start Reading Session', 'PASS');
    } else {
      record('Reading Session', 'Start Reading Session', 'FAIL', `Status ${sessionRes.status}`);
    }

    // 5.5 Reading Session: Heartbeat (simulate after idle/duration)
    if (sessionId) {
      const hbRes = await authClient.post('/reading/heartbeat', { sessionId });
      // Might return 429 if too frequent (<30s) which is expected anti-cheat validation
      if (hbRes.status === 429 || hbRes.status === 200) {
        record('Reading Anti-Cheat', 'Validate Reading Session Heartbeat Frequency', 'PASS');
      } else {
        record('Reading Anti-Cheat', 'Validate Reading Session Heartbeat Frequency', 'FAIL', `Status ${hbRes.status}`);
      }
    }

    // 5.6 Save Reading Progress
    const saveProgRes = await authClient.post(`/users/${userId}/reading-progress`, {
      storyId: storyId,
      last_part_id: partId,
      last_scroll_position: 0.65,
    });
    if (saveProgRes.status === 200) {
      record('Reading Progress', 'Save Scroll Position & Last Read Chapter', 'PASS');
    } else {
      record('Reading Progress', 'Save Scroll Position & Last Read Chapter', 'FAIL', `Status ${saveProgRes.status}`);
    }

    // 5.7 Get Reading Progress
    const getProgRes = await authClient.get(`/users/${userId}/reading-progress/${storyId}`);
    if (getProgRes.status === 200 && getProgRes.data.last_part_id === partId) {
      record('Reading Progress', 'Fetch Saved Reading Progress', 'PASS');
    } else {
      record('Reading Progress', 'Fetch Saved Reading Progress', 'FAIL', `Status ${getProgRes.status}`);
    }
  } catch (err) {
    record('Reading Experience', 'Reader Flow', 'FAIL', err.message);
  }

  // 6. TEST SOCIAL & INTERACTIONS
  console.log('\n--- 6. Testing Social Interactions, Likes, Reviews & Chat ---');
  try {
    const authClient = client(authToken);

    // 6.1 Like Story
    const likeRes = await authClient.post(`/stories/${storyId}/like`, { userId });
    if (likeRes.status === 200 && likeRes.data.newLikes > 0) {
      record('Story Interactions', 'Like Story & Increment Like Counter', 'PASS');
    } else {
      record('Story Interactions', 'Like Story & Increment Like Counter', 'FAIL', `Status ${likeRes.status}`);
    }

    // 6.2 Leave Review
    const reviewRes = await authClient.post(`/stories/${storyId}/reviews`, {
      userId,
      rating: 5,
      comment: 'Absolutely thrilling read! Highly recommended.'
    });
    if (reviewRes.status === 200) {
      record('Story Reviews', 'Submit Story Review & Star Rating', 'PASS');
    } else {
      record('Story Reviews', 'Submit Story Review & Star Rating', 'FAIL', `Status ${reviewRes.status}`);
    }

    // 6.3 Send Community Chat Message
    const chatMsgRes = await authClient.post('/chat/messages', {
      message: 'Excited to publish my new story here!'
    });
    if (chatMsgRes.status === 200 && chatMsgRes.data.id) {
      record('Community Chat', 'Post Real-time Message to Group Chat', 'PASS');
    } else {
      record('Community Chat', 'Post Real-time Message to Group Chat', 'FAIL', `Status ${chatMsgRes.status}`);
    }

    // 6.4 Fetch Chat Feed
    const chatFeedRes = await authClient.get('/chat/messages');
    if (chatFeedRes.status === 200 && chatFeedRes.data.some(m => m.id === chatMsgRes.data?.id)) {
      record('Community Chat', 'Retrieve Community Chat Messages Feed', 'PASS');
    } else {
      record('Community Chat', 'Retrieve Community Chat Messages Feed', 'FAIL', `Status ${chatFeedRes.status}`);
    }
  } catch (err) {
    record('Social Interactions', 'Interactions Flow', 'FAIL', err.message);
  }

  // 8. TEST MONETIZATION, PLANS & WITHDRAWALS
  console.log('\n--- 8. Testing Monetization, Plans & Withdrawal Flow ---');
  try {
    const authClient = client(authToken);

    // 8.1 Ad Watch simulation to earn Reader Coins
    const adWatchRes = await authClient.post('/transactions/ad-watch', {
      id: `ad_${timestamp}`,
      userId,
      watchedAt: Date.now()
    });
    if (adWatchRes.status === 200 && adWatchRes.data.newCoins > 0) {
      record('Monetization', 'Watch Ad & Credit Reader Coins (+1.00)', 'PASS');
    } else {
      record('Monetization', 'Watch Ad & Credit Reader Coins (+1.00)', 'FAIL', `Status ${adWatchRes.status}`);
    }

    // 8.2 Plan Upgrade Attempt from UI payload ({ plan_id: 'premium' })
    const uiPlanUpgradeRes = await authClient.post('/plans/subscribe', {
      plan_id: 'premium'
    });
    if (uiPlanUpgradeRes.status === 200) {
      record('Plan Subscription', 'Subscribe to Premium Plan (Frontend payload)', 'PASS');
    } else {
      record('Plan Subscription', 'Subscribe to Premium Plan (Frontend payload)', 'FAIL', `Status ${uiPlanUpgradeRes.status}: Validation error expecting plan_type and receipt_url: ${JSON.stringify(uiPlanUpgradeRes.data)}`);
    }

    // 8.3 Set payment details
    const payRes = await authClient.put(`/users/${userId}/profile`, {
      payment_method: 'GCash',
      payment_account_info: '09171234567'
    });

    // 8.4 Withdrawal Eligibility Check (Requires coins >= 10.0)
    // Credit coins first to test withdrawal
    const checkEligRes = await authClient.post('/withdrawals/check-eligibility');
    if (checkEligRes.status === 200) {
      record('Withdrawal Flow', 'Check Withdrawal Eligibility Endpoint', 'PASS');
    } else {
      record('Withdrawal Flow', 'Check Withdrawal Eligibility Endpoint', 'FAIL', `Status ${checkEligRes.status}`);
    }
  } catch (err) {
    record('Monetization Flow', 'Earnings & Withdrawals', 'FAIL', err.message);
  }

  // 9. TEST ADMIN OPERATIONS
  console.log('\n--- 9. Testing Admin Operations Panel ---');
  try {
    const authClient = client(authToken);

    // 9.1 Non-admin access to admin endpoints
    const nonAdminUsersRes = await authClient.get('/admin/users');
    if (nonAdminUsersRes.status === 403) {
      record('Admin Security', 'Block Non-Admin from Accessing Admin Users API', 'PASS');
    } else {
      record('Admin Security', 'Block Non-Admin from Accessing Admin Users API', 'FAIL', `Expected 403 Forbidden but got ${nonAdminUsersRes.status}`);
    }
  } catch (err) {
    record('Admin Security', 'Admin Guard', 'FAIL', err.message);
  }

  console.log('\n=====================================================');
  console.log('📊 END-TO-END API & FLOW MATRIX');
  console.log('=====================================================');
  console.table(testReport);
}

testAll().catch(console.error);
