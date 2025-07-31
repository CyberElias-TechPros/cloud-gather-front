
import { supabase } from '@/integrations/supabase/client';

export interface PerformanceMetric {
  id: string;
  metric_name: string;
  value: number;
  timestamp: string;
  user_id?: string;
  context?: Record<string, any>;
}

export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
}

class MonitoringService {
  private metricsBuffer: PerformanceMetric[] = [];
  private activityBuffer: UserActivity[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic flushing
    this.startPeriodicFlush();
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    metricName: string,
    value: number,
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random()}`,
      metric_name: metricName,
      value,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metricsBuffer.push(metric);
    
    // Auto-flush if buffer is getting large
    if (this.metricsBuffer.length >= 50) {
      this.flushMetrics();
    }
  }

  /**
   * Record user activity
   */
  async recordActivity(
    action: string,
    resourceType: string,
    resourceId?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const activity: UserActivity = {
        id: `activity_${Date.now()}_${Math.random()}`,
        user_id: session?.session?.user?.id || 'anonymous',
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        timestamp: new Date().toISOString(),
        success,
        error_message: errorMessage,
      };

      this.activityBuffer.push(activity);
      
      // Auto-flush if buffer is getting large
      if (this.activityBuffer.length >= 20) {
        await this.flushActivity();
      }
    } catch (error) {
      console.error('Failed to record activity:', error);
    }
  }

  /**
   * Measure and record function execution time
   */
  async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      
      this.recordMetric(`${operation}_duration`, endTime - startTime, {
        success: true,
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      this.recordMetric(`${operation}_duration`, endTime - startTime, {
        success: false,
        error: (error as Error).message,
      });
      
      throw error;
    }
  }

  /**
   * Record page load metrics
   */
  recordPageLoad(pageName: string): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, {
        page: pageName,
      });
      
      this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, {
        page: pageName,
      });
      
      this.recordMetric('first_byte_time', navigation.responseStart - navigation.fetchStart, {
        page: pageName,
      });
    }
  }

  /**
   * Record API call metrics
   */
  recordApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    success: boolean
  ): void {
    this.recordMetric('api_call_duration', duration, {
      endpoint,
      method,
      status_code: statusCode,
      success,
    });
  }

  /**
   * Get performance metrics for dashboard
   */
  async getMetrics(
    metricName?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceMetric[]> {
    try {
      let query = supabase
        .from('performance_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (metricName) {
        query = query.eq('metric_name', metricName);
      }

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      return [];
    }
  }

  /**
   * Get user activity logs
   */
  async getActivityLogs(
    userId?: string,
    action?: string,
    startDate?: string,
    endDate?: string
  ): Promise<UserActivity[]> {
    try {
      let query = supabase
        .from('user_activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (action) {
        query = query.eq('action', action);
      }

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      return [];
    }
  }

  /**
   * Flush metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      const { error } = await supabase
        .from('performance_metrics')
        .insert(metricsToFlush);

      if (error) {
        console.error('Failed to flush metrics:', error);
        // Put failed metrics back in buffer
        this.metricsBuffer.unshift(...metricsToFlush);
      }
    } catch (error) {
      console.error('Error flushing metrics:', error);
    }
  }

  /**
   * Flush activity logs to database
   */
  private async flushActivity(): Promise<void> {
    if (this.activityBuffer.length === 0) return;

    try {
      const activitiesToFlush = [...this.activityBuffer];
      this.activityBuffer = [];

      const { error } = await supabase
        .from('user_activities')
        .insert(activitiesToFlush);

      if (error) {
        console.error('Failed to flush activities:', error);
        // Put failed activities back in buffer
        this.activityBuffer.unshift(...activitiesToFlush);
      }
    } catch (error) {
      console.error('Error flushing activities:', error);
    }
  }

  /**
   * Start periodic flushing
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushMetrics();
      await this.flushActivity();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Stop monitoring service
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flushMetrics();
    this.flushActivity();
  }
}

export const monitoringService = new MonitoringService();

// Global performance observer
if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure') {
        monitoringService.recordMetric(
          `custom_${entry.name}`,
          entry.duration,
          { type: 'measure' }
        );
      }
    }
  });
  
  observer.observe({ entryTypes: ['measure'] });
}
