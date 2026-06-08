/**
 * Session Verification Script
 * Run this in browser console (F12) to check session integrity
 */

(function() {
  console.log('\n🔍 SESSION VERIFICATION REPORT');
  console.log('================================\n');
  
  // Get stored values
  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  const userStatus = localStorage.getItem('userStatus');
  
  console.log('📋 Stored Session Data:');
  console.log('  Username:', username || '(not set)');
  console.log('  User Role:', userRole || '(not set)');
  console.log('  User Status:', userStatus || '(not set)');
  console.log('  Token:', token ? token.substring(0, 30) + '...' : '(not set)');
  
  if (!token) {
    console.log('\n❌ No token found - not logged in');
    return;
  }
  
  // Decode JWT token
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('\n❌ Invalid JWT token format');
      return;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const tokenUsername = payload.sub;
    const tokenExp = payload.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    
    console.log('\n🎫 JWT Token Contents:');
    console.log('  Username (sub):', tokenUsername);
    console.log('  Issued At:', payload.iat ? new Date(payload.iat * 1000).toLocaleString() : 'N/A');
    console.log('  Expires At:', tokenExp ? new Date(tokenExp * 1000).toLocaleString() : 'N/A');
    console.log('  Time Remaining:', tokenExp ? Math.max(0, tokenExp - currentTime) + ' seconds' : 'N/A');
    
    // Validation checks
    console.log('\n✅ Validation Checks:');
    
    // Check 1: Username match
    if (tokenUsername === username) {
      console.log('  ✓ Username matches token');
    } else {
      console.log('  ✗ USERNAME MISMATCH!');
      console.log('    Stored:', username);
      console.log('    Token:', tokenUsername);
      console.log('    → This is a SECURITY ISSUE - session contaminated!');
    }
    
    // Check 2: Token expiration
    if (tokenExp && currentTime < tokenExp) {
      console.log('  ✓ Token is valid (not expired)');
    } else if (tokenExp) {
      console.log('  ✗ TOKEN EXPIRED!');
      console.log('    Expired:', Math.abs(currentTime - tokenExp), 'seconds ago');
    } else {
      console.log('  ⚠ Token has no expiration');
    }
    
    // Check 3: Role consistency
    if (tokenUsername === 'admin' && userRole !== 'admin') {
      console.log('  ✗ ROLE MISMATCH: Token is admin but stored role is', userRole);
    } else if (tokenUsername !== 'admin' && userRole === 'admin') {
      console.log('  ✗ ROLE MISMATCH: Token is not admin but stored role is admin');
    } else {
      console.log('  ✓ Role appears consistent');
    }
    
    console.log('\n================================');
    console.log('Summary:', tokenUsername === username ? '✅ Session is valid' : '❌ Session is INVALID');
    console.log('================================\n');
    
    if (tokenUsername !== username) {
      console.log('🔧 To fix this issue:');
      console.log('   1. Run: localStorage.clear()');
      console.log('   2. Refresh page');
      console.log('   3. Log in again');
    }
    
  } catch (error) {
    console.log('\n❌ Error decoding token:', error.message);
  }
})();
