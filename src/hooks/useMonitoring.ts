
import { useEffect, useCallback } from 'react';
import { monitoringService, PerformanceMetric, UserActivity } from '@/services/monitoringService';
import { useLocation } from 'react-router-dom';

export const useMonitoring = () => {
  const location = useLocation();

  // Record page views
  useEffect(() => {
    const pageName = location.pathname;
    monitoringService.recordPageLoad(pageName);
    monitoringService.recordActivity('page_view', 'page', pageName);
  }, [location]);

  const recordMetric = useCallback((
    metricName: string,
    value: number,
    context?: Record<string, any>
  ) => {
    monitoringService.recordMetric(metricName, value, context);
  }, []);

  const recordActivity = useCallback(async (
    action: string,
    resourceType: string,
    resourceId?: string,
    success: boolean = true,
    errorMessage?: string
  ) => {
    await monitoringService.recordActivity(action, resourceType, resourceId, success, errorMessage);
  }, []);

  const measurePerformance = useCallback(async <T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    return monitoringService.measurePerformance(operation, fn);
  }, []);

  return {
    recordMetric,
    recordActivity,
    measurePerformance,
  };
};
