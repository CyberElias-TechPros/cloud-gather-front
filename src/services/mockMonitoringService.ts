export interface PerformanceMetric {
  id: string;
  metric_name: string;
  value: number;
  timestamp: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  timestamp: string;
  success: boolean;
  metadata?: Record<string, any>;
}

class MockMonitoringService {
  private activities: UserActivity[] = [];
  private metrics: PerformanceMetric[] = [];

  /**
   * Record a performance metric (mock implementation)
   */
  async recordMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        id: `metric_${Date.now()}`,
        metric_name: metricName,
        value,
        timestamp: new Date().toISOString(),
        metadata,
      };

      this.metrics.push(metric);
      console.log('Mock metric recorded:', metric);
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }

  /**
   * Record user activity (mock implementation)
   */
  async recordActivity(
    action: string,
    resourceType: string,
    resourceId?: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const activity: UserActivity = {
        id: `activity_${Date.now()}`,
        user_id: 'mock_user_id',
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        timestamp: new Date().toISOString(),
        success,
        metadata,
      };

      this.activities.push(activity);
      console.log('Mock activity recorded:', activity);
    } catch (error) {
      console.error('Error recording activity:', error);
    }
  }

  /**
   * Get performance metrics (mock implementation)
   */
  async getMetrics(
    startDate?: string,
    endDate?: string,
    metricName?: string
  ): Promise<PerformanceMetric[]> {
    let filteredMetrics = [...this.metrics];

    if (metricName) {
      filteredMetrics = filteredMetrics.filter(m => m.metric_name === metricName);
    }

    if (startDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startDate);
    }

    if (endDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endDate);
    }

    return filteredMetrics.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get user activities (mock implementation)
   */
  async getActivities(
    startDate?: string,
    endDate?: string,
    action?: string,
    userId?: string
  ): Promise<UserActivity[]> {
    let filteredActivities = [...this.activities];

    if (action) {
      filteredActivities = filteredActivities.filter(a => a.action === action);
    }

    if (userId) {
      filteredActivities = filteredActivities.filter(a => a.user_id === userId);
    }

    if (startDate) {
      filteredActivities = filteredActivities.filter(a => a.timestamp >= startDate);
    }

    if (endDate) {
      filteredActivities = filteredActivities.filter(a => a.timestamp <= endDate);
    }

    return filteredActivities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Measure performance of an async function
   */
  async measurePerformance<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      await this.recordMetric(`${operationName}_duration`, duration);
      await this.recordMetric(`${operationName}_success`, 1);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      await this.recordMetric(`${operationName}_duration`, duration);
      await this.recordMetric(`${operationName}_error`, 1);
      
      throw error;
    }
  }
}

export const monitoringService = new MockMonitoringService();