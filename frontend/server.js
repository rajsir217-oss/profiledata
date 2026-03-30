const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 8080;

// Security headers including Cache-Control
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https://matrimonial-backend-458052696267.us-central1.run.app"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Custom Cache-Control middleware for PCI compliance
const setCacheControl = (req, res, next) => {
  const path = req.path.toLowerCase();
  
  // Check HTTP version for Pragma header (PCI requirement)
  const isHttp10 = req.httpVersion === '1.0';
  
  // Sensitive routes - strict caching rules
  if (path.includes('/register') || 
      path.includes('/login') || 
      path.includes('/signin') || 
      path.includes('/signup') ||
      path.includes('/auth/') ||
      path.includes('/profile') ||
      path.includes('/account') ||
      path.includes('/settings') ||
      path.includes('/payment') ||
      path.includes('/checkout') ||
      path.includes('/admin') ||
      path.includes('/virtual-meets')) {
    
    // PCI compliant headers for sensitive routes
    res.set('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store, private');
    
    // Only set Pragma for HTTP/1.0 compatibility (PCI requirement)
    if (isHttp10) {
      res.set('Pragma', 'no-cache');
    } else {
      // Remove Pragma for HTTP/1.1+ (PCI compliance)
      res.remove('Pragma');
    }
    res.set('Expires', '0');
  }
  // Static assets - can be cached
  else if (path.startsWith('/static/') || 
           path.startsWith('/css/') || 
           path.startsWith('/js/') ||
           path.startsWith('/images/') ||
           path.includes('.js') ||
           path.includes('.css') ||
           path.includes('.png') ||
           path.includes('.jpg') ||
           path.includes('.jpeg') ||
           path.includes('.gif') ||
           path.includes('.svg') ||
           path.includes('.ico') ||
           path.includes('.woff')) {
    
    // Static assets can be cached for longer
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    // Remove Pragma for static assets
    res.remove('Pragma');
  }
  // All other routes - no cache
  else {
    res.set('Cache-Control', 'no-cache');
    
    // Only set Pragma for HTTP/1.0 compatibility (PCI requirement)
    if (isHttp10) {
      res.set('Pragma', 'no-cache');
    } else {
      // Remove Pragma for HTTP/1.1+ (PCI compliance)
      res.remove('Pragma');
    }
    res.set('Expires', '0');
  }
  
  next();
};

// Apply Cache-Control to all routes
app.use(setCacheControl);

// Serve static files from build directory
app.use(express.static(path.join(__dirname, 'build'), {
  // Don't set default cache control here, we handle it above
  etag: true,
  lastModified: true
}));

// API proxy for backend (if needed)
app.use('/api', (req, res) => {
  const backendUrl = process.env.REACT_APP_API_URL || 'https://matrimonial-backend-458052696267.us-central1.run.app/api';
  
  // Don't proxy in production - frontend should call backend directly
  res.status(404).json({ error: 'API not found on frontend server' });
});

// Handle client-side routing - return index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Health check endpoint
app.get('/_ah/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});

module.exports = app;
