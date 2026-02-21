#!/usr/bin/env node

/**
 * Notification Management Debug Script
 * Tests local development setup for notification-management page
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging Notification Management Page...\n');

// Test 1: Check if frontend is running
function testFrontend() {
  return new Promise((resolve) => {
    console.log('📱 Testing Frontend (http://localhost:3000)...');
    
    const req = http.get('http://localhost:3000', (res) => {
      console.log(`✅ Frontend running - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', () => {
      console.log('❌ Frontend not running on port 3000');
      console.log('💡 Start frontend: cd frontend && npm start');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('❌ Frontend request timeout');
      resolve(false);
    });
  });
}

// Test 2: Check if backend is running
function testBackend() {
  return new Promise((resolve) => {
    console.log('🔧 Testing Backend (http://localhost:8000)...');
    
    const req = http.get('http://localhost:8000', (res) => {
      console.log(`✅ Backend running - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', () => {
      console.log('❌ Backend not running on port 8000');
      console.log('💡 Start backend: cd fastapi_backend && python -m uvicorn main:app --reload');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('❌ Backend request timeout');
      resolve(false);
    });
  });
}

// Test 3: Check notification endpoints
function testNotificationEndpoints() {
  return new Promise((resolve) => {
    console.log('📬 Testing Notification Endpoints...');
    
    const endpoints = [
      '/api/notifications/queue',
      '/api/notifications/analytics',
      '/api/notifications/logs'
    ];
    
    let completed = 0;
    let success = 0;
    
    endpoints.forEach(endpoint => {
      const req = http.get(`http://localhost:8000${endpoint}`, (res) => {
        completed++;
        if (res.statusCode === 401) {
          console.log(`✅ ${endpoint} - Requires auth (expected)`);
          success++;
        } else if (res.statusCode === 200) {
          console.log(`✅ ${endpoint} - Working`);
          success++;
        } else {
          console.log(`⚠️  ${endpoint} - Status: ${res.statusCode}`);
        }
        
        if (completed === endpoints.length) {
          console.log(`📊 Endpoint test: ${success}/${endpoints.length} working`);
          resolve(success === endpoints.length);
        }
      });
      
      req.on('error', () => {
        completed++;
        console.log(`❌ ${endpoint} - Failed`);
        if (completed === endpoints.length) {
          console.log(`📊 Endpoint test: ${success}/${endpoints.length} working`);
          resolve(false);
        }
      });
      
      req.setTimeout(3000, () => {
        req.destroy();
        completed++;
        console.log(`❌ ${endpoint} - Timeout`);
        if (completed === endpoints.length) {
          console.log(`📊 Endpoint test: ${success}/${endpoints.length} working`);
          resolve(false);
        }
      });
    });
  });
}

// Test 4: Check component files exist
function testComponentFiles() {
  console.log('📁 Testing Component Files...');
  
  const components = [
    'frontend/src/components/NotificationManagement.js',
    'frontend/src/components/UniversalTabContainer.js',
    'frontend/src/components/EventQueueManager.js',
    'frontend/src/components/TemplateManager.js',
    'frontend/src/components/EventStatusLog.js',
    'frontend/src/components/DeliveryLogTab.js',
    'frontend/src/components/EmailDeliveryLog.js',
    'frontend/src/components/SMSDeliveryLog.js'
  ];
  
  let missing = [];
  
  components.forEach(component => {
    const filePath = path.join(__dirname, component);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${component}`);
    } else {
      console.log(`❌ ${component} - MISSING`);
      missing.push(component);
    }
  });
  
  if (missing.length === 0) {
    console.log('📊 All component files present');
    return true;
  } else {
    console.log(`❌ ${missing.length} component files missing`);
    return false;
  }
}

// Test 5: Check hook files exist
function testHookFiles() {
  console.log('🪝 Testing Hook Files...');
  
  const hooks = [
    'frontend/src/hooks/useAdminAuth.js',
    'frontend/src/hooks/useNotificationStatus.js',
    'frontend/src/hooks/useNotificationData.js',
    'frontend/src/hooks/useCancellableRequest.js',
    'frontend/src/hooks/useToast.js'
  ];
  
  let missing = [];
  
  hooks.forEach(hook => {
    const filePath = path.join(__dirname, hook);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${hook}`);
    } else {
      console.log(`❌ ${hook} - MISSING`);
      missing.push(hook);
    }
  });
  
  if (missing.length === 0) {
    console.log('📊 All hook files present');
    return true;
  } else {
    console.log(`❌ ${missing.length} hook files missing`);
    return false;
  }
}

// Test 6: Check environment files
function testEnvironmentFiles() {
  console.log('⚙️ Testing Environment Files...');
  
  const envFiles = [
    'frontend/.env.local',
    'frontend/.env.development',
    'frontend/config.js'
  ];
  
  let missing = [];
  
  envFiles.forEach(envFile => {
    const filePath = path.join(__dirname, envFile);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${envFile}`);
    } else {
      console.log(`❌ ${envFile} - MISSING`);
      missing.push(envFile);
    }
  });
  
  if (missing.length === 0) {
    console.log('📊 All environment files present');
    return true;
  } else {
    console.log(`❌ ${missing.length} environment files missing`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Notification Management Debug...\n');
  
  const results = {
    frontend: await testFrontend(),
    backend: await testBackend(),
    endpoints: await testNotificationEndpoints(),
    components: testComponentFiles(),
    hooks: testHookFiles(),
    environment: testEnvironmentFiles()
  };
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(12)}: ${status}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Notification Management should work.');
    console.log('\n🌐 Visit: http://localhost:3000/notification-management');
    console.log('👤 Make sure you\'re logged in as admin user');
  } else {
    console.log('\n🚨 Some tests failed. See above for details.');
    console.log('\n🔧 Quick Fix Commands:');
    console.log('  # Start Frontend:');
    console.log('  cd frontend && npm start');
    console.log('  # Start Backend:');
    console.log('  cd fastapi_backend && python -m uvicorn main:app --reload');
    console.log('  # Check Admin Login:');
    console.log('  # Make sure localStorage has userRole: "admin"');
  }
}

// Run the tests
runTests().catch(console.error);
