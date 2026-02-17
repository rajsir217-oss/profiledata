/**
 * Custom hook for scheduler data management
 * Centralizes data loading, caching, and state management for Dynamic Scheduler
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import useNotificationData from './useNotificationData';
import { API_ENDPOINTS } from '../constants/notificationTriggers';

const useSchedulerData = () => {
  // Jobs data with caching
  const { 
    data: jobs, 
    loading: jobsLoading, 
    error: jobsError, 
    refresh: refreshJobs 
  } = useNotificationData(
    '/api/admin/scheduler/jobs',
    30000, // 30 seconds refresh
    {
      transformData: (data) => {
        // Transform and validate job data
        const transformed = (data?.jobs || data || []).map(job => ({
          ...job,
          id: job._id || job.id,
          name: job.name || 'Untitled Job',
          template_type: job.template_type || 'unknown',
          enabled: job.enabled !== false,
          createdAt: job.createdAt || job.created_at,
          updatedAt: job.updatedAt || job.updated_at,
          lastRunAt: job.lastRunAt || job.last_run_at,
          nextRunAt: job.nextRunAt || job.next_run_at,
          lastStatus: job.lastStatus || job.last_status
        }));
        return transformed;
      },
      enableCache: true,
      cacheKey: 'scheduler_jobs_cache',
      initialData: []
    }
  );

  // Templates data with caching
  const { 
    data: templates, 
    loading: templatesLoading, 
    error: templatesError, 
    refresh: refreshTemplates 
  } = useNotificationData(
    '/api/admin/scheduler/templates',
    60000, // 1 minute refresh
    {
      transformData: (data) => {
        // Sort templates alphabetically by name
        const sorted = (data?.templates || data || []).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        return sorted;
      },
      enableCache: true,
      cacheKey: 'scheduler_templates_cache',
      initialData: []
    }
  );

  // Scheduler status data
  const { 
    data: status, 
    loading: statusLoading, 
    error: statusError, 
    refresh: refreshStatus 
  } = useNotificationData(
    '/api/admin/scheduler/status',
    30000, // 30 seconds refresh
    {
      enableCache: true,
      cacheKey: 'scheduler_status_cache',
      initialData: null
    }
  );

  // Combined loading state
  const loading = jobsLoading || templatesLoading || statusLoading;
  const error = jobsError || templatesError || statusError;

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshJobs(true),
      refreshTemplates(true),
      refreshStatus(true)
    ]);
  }, [refreshJobs, refreshTemplates, refreshStatus]);

  // Memoized combined data
  const schedulerData = useMemo(() => ({
    jobs,
    templates,
    status,
    loading,
    error,
    refresh: refreshAll
  }), [jobs, templates, status, loading, error, refreshAll]);

  return schedulerData;
};

export default useSchedulerData;
