/**
 * Performance Monitoring Hook
 * Tracks component performance metrics and provides optimization suggestions
 */

import { useRef, useEffect, useCallback } from 'react';

const usePerformanceMonitor = (componentName = 'Component') => {
  const metricsRef = useRef({
    renderCount: 0,
    lastRenderTime: Date.now(),
    averageRenderTime: 0,
    slowRenders: [],
    memoryUsage: [],
    lastMemoryCheck: Date.now()
  });

  const recordRender = useCallback(() => {
    const now = Date.now();
    const renderTime = now - metricsRef.current.lastRenderTime;
    
    metricsRef.current.renderCount++;
    metricsRef.current.averageRenderTime = 
      (metricsRef.current.averageRenderTime * (metricsRef.current.renderCount - 1) + renderTime) / 
      metricsRef.current.renderCount;
    
    // Track slow renders
    if (renderTime > 100) {
      metricsRef.current.slowRenders.push({
        timestamp: now,
        renderTime,
        renderCount: metricsRef.current.renderCount
      });
      
      // Keep only last 10 slow renders
      if (metricsRef.current.slowRenders.length > 10) {
        metricsRef.current.slowRenders.shift();
      }
    }
    
    metricsRef.current.lastRenderTime = now;
    
    // Log performance warnings in development
    if (process.env.NODE_ENV === 'development') {
      if (renderTime > 100) {
        console.warn(`🐌 ${componentName}: Slow render detected (${renderTime}ms)`);
      }
      
      if (metricsRef.current.renderCount % 50 === 0) {
        console.log(`📊 ${componentName}: Performance Stats`, {
          renders: metricsRef.current.renderCount,
          avgRenderTime: `${metricsRef.current.averageRenderTime.toFixed(2)}ms`,
          slowRenders: metricsRef.current.slowRenders.length
        });
      }
    }
  }, [componentName]);

  const checkMemoryUsage = useCallback(() => {
    if (typeof performance !== 'undefined' && performance.memory) {
      const now = Date.now();
      const memoryInfo = {
        timestamp: now,
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
      
      metricsRef.current.memoryUsage.push(memoryInfo);
      
      // Keep only last 10 memory checks
      if (metricsRef.current.memoryUsage.length > 10) {
        metricsRef.current.memoryUsage.shift();
      }
      
      metricsRef.current.lastMemoryCheck = now;
      
      // Log memory warnings
      const memoryUsagePercent = (memoryInfo.used / memoryInfo.limit) * 100;
      if (memoryUsagePercent > 80) {
        console.warn(`🧠 ${componentName}: High memory usage (${memoryUsagePercent.toFixed(1)}%)`);
      }
    }
  }, [componentName]);

  // Check memory usage every 10 seconds
  useEffect(() => {
    const interval = setInterval(checkMemoryUsage, 10000);
    return () => clearInterval(interval);
  }, [checkMemoryUsage]);

  const getPerformanceReport = useCallback(() => {
    const metrics = metricsRef.current;
    const latestMemory = metrics.memoryUsage[metrics.memoryUsage.length - 1];
    
    return {
      componentName,
      renderCount: metrics.renderCount,
      averageRenderTime: metrics.averageRenderTime,
      slowRenders: metrics.slowRenders.length,
      memoryUsage: latestMemory ? {
        used: `${(latestMemory.used / 1024 / 1024).toFixed(2)}MB`,
        total: `${(latestMemory.total / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(latestMemory.limit / 1024 / 1024).toFixed(2)}MB`,
        usagePercent: `${((latestMemory.used / latestMemory.limit) * 100).toFixed(1)}%`
      } : null,
      recommendations: getRecommendations(metrics)
    };
  }, []);

  const getRecommendations = (metrics) => {
    const recommendations = [];
    
    if (metrics.averageRenderTime > 50) {
      recommendations.push('Consider memoizing expensive operations');
    }
    
    if (metrics.slowRenders.length > 5) {
      recommendations.push('Component has frequent slow renders - optimize re-renders');
    }
    
    if (metrics.memoryUsage.length > 0) {
      const latestMemory = metrics.memoryUsage[metrics.memoryUsage.length - 1];
      const memoryUsagePercent = (latestMemory.used / latestMemory.limit) * 100;
      
      if (memoryUsagePercent > 70) {
        recommendations.push('High memory usage - consider virtual scrolling or pagination');
      }
    }
    
    if (metrics.renderCount > 1000) {
      recommendations.push('Component renders frequently - consider React.memo or useMemo');
    }
    
    return recommendations;
  };

  return {
    recordRender,
    checkMemoryUsage,
    getPerformanceReport,
    metrics: metricsRef.current
  };
};

export default usePerformanceMonitor;
