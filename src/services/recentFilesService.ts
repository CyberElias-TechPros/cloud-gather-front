
import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';

export const getRecentFiles = async (
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week',
  limit: number = 10
): Promise<FileItem[]> => {
  try {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(startDate);
        endOfYesterday.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .gte('last_accessed_at', startDate.toISOString())
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent files:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch recent files:', error);
    // Return empty array as fallback
    return [];
  }
};

export const searchRecentFiles = async (
  query: string,
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week'
): Promise<FileItem[]> => {
  try {
    const files = await getRecentFiles(period);
    
    // Filter files based on search query
    if (!query) return files;
    
    const lowerCaseQuery = query.toLowerCase();
    return files.filter(file => 
      file.filename.toLowerCase().includes(lowerCaseQuery) ||
      file.path?.toLowerCase().includes(lowerCaseQuery) ||
      file.mime_type?.toLowerCase().includes(lowerCaseQuery)
    );
  } catch (error) {
    console.error('Error searching recent files:', error);
    return [];
  }
};

export const filterRecentFiles = async (
  fileType: 'all' | 'documents' | 'images' | 'videos' = 'all',
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week'
): Promise<FileItem[]> => {
  try {
    const files = await getRecentFiles(period);
    
    if (fileType === 'all') return files;
    
    return files.filter(file => {
      const mimeType = file.mime_type?.toLowerCase() || '';
      
      switch (fileType) {
        case 'documents':
          return mimeType.includes('pdf') || 
                 mimeType.includes('document') || 
                 mimeType.includes('text') ||
                 mimeType.includes('spreadsheet') ||
                 mimeType.includes('presentation');
        case 'images':
          return mimeType.includes('image');
        case 'videos':
          return mimeType.includes('video');
        default:
          return true;
      }
    });
  } catch (error) {
    console.error('Error filtering recent files:', error);
    return [];
  }
};
