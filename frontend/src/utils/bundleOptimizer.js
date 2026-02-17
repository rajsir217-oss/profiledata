/**
 * Bundle Optimization Utilities
 * Helps optimize bundle size and loading performance
 */

// Dynamic import helper for code splitting
export const dynamicImport = (importFunction) => {
  return importFunction().catch(error => {
    console.error('Failed to load module:', error);
    return null;
  });
};

// Lazy load components
export const lazyLoadComponent = (importFunction, fallback = null) => {
  return React.lazy(() => dynamicImport(importFunction));
};

// Preload critical components
export const preloadComponent = (componentPath) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import(componentPath).catch(() => {
        // Ignore preload errors
      });
    });
  }
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = window.performance.getEntriesByType('navigation')[0];
    if (navigation) {
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTransferSize: navigation.transferSize,
        totalEncodedBodySize: navigation.encodedBodySize,
        totalDecodedBodySize: navigation.decodedBodySize
      };
    }
  }
  return null;
};

// Critical CSS preloader
export const preloadCriticalCSS = (cssPaths = []) => {
  cssPaths.forEach(path => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = path;
    document.head.appendChild(link);
  });
};

// Font preloader
export const preloadFonts = (fonts = []) => {
  fonts.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = font;
    document.head.appendChild(link);
  });
};

// Image preloader
export const preloadImages = (imagePaths = []) => {
  imagePaths.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

// Service Worker registration for caching
export const registerServiceWorker = async (swPath = '/sw.js') => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(swPath);
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

// Resource hints for performance
export const addResourceHints = () => {
  // DNS prefetch for external domains
  const domains = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'api.example.com'
  ];
  
  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${domain}`;
    document.head.appendChild(link);
  });
  
  // Preconnect for critical domains
  const criticalDomains = [
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  
  criticalDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = `https://${domain}`;
    document.head.appendChild(link);
  });
};

// Performance metrics collector
export const collectPerformanceMetrics = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const metrics = {
      navigation: analyzeBundleSize(),
      resources: window.performance.getEntriesByType('resource'),
      paint: window.performance.getEntriesByType('paint'),
      memory: window.performance.memory ? {
        used: window.performance.memory.usedJSHeapSize,
        total: window.performance.memory.totalJSHeapSize,
        limit: window.performance.memory.jsHeapSizeLimit
      } : null
    };
    
    return metrics;
  }
  return null;
};

// Bundle optimization recommendations
export const getOptimizationRecommendations = (metrics) => {
  const recommendations = [];
  
  if (metrics.navigation) {
    const { domContentLoaded, loadComplete } = metrics.navigation;
    
    if (domContentLoaded > 2000) {
      recommendations.push('DOM content loading is slow - consider code splitting');
    }
    
    if (loadComplete > 3000) {
      recommendations.push('Page load time is high - optimize images and scripts');
    }
  }
  
  if (metrics.memory) {
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.limit) * 100;
    if (memoryUsagePercent > 70) {
      recommendations.push('High memory usage - implement virtual scrolling');
    }
  }
  
  if (metrics.resources) {
    const largeResources = metrics.resources.filter(r => r.transferSize > 1024 * 1024); // > 1MB
    if (largeResources.length > 0) {
      recommendations.push('Large resources detected - consider compression or lazy loading');
    }
  }
  
  return recommendations;
};
