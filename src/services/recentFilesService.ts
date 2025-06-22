
import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';

export const getRecentFiles = async (
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week',
  limit: number = 10
): Promise<FileItem[]> => {
  try {
    const now = new Date();
    let startDate = new Date();
    let endDate: Date | null = null;

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    let query = supabase
      .from('files')
      .select('*')
      .gte('last_accessed_at', startDate.toISOString())
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    // For yesterday, add upper bound
    if (endDate) {
      query = query.lte('last_accessed_at', endDate.toISOString());
    }

    const { data, error } = await query;

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

export const getStarredFiles = async (): Promise<FileItem[]> => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('is_starred', true)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching starred files:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch starred files:', error);
    return [];
  }
};

export const searchRecentFiles = async (
  query: string,
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week'
): Promise<FileItem[]> => {
  try {
    const files = await getRecentFiles(period, 100); // Get more files for searching
    
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
  fileType: 'all' | 'documents' | 'images' | 'videos' | 'folders' = 'all',
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week'
): Promise<FileItem[]> => {
  try {
    const files = await getRecentFiles(period, 100);
    
    if (fileType === 'all') return files;
    
    return files.filter(file => {
      if (fileType === 'folders') {
        return file.is_folder;
      }
      
      const mimeType = file.mime_type?.toLowerCase() || '';
      
      switch (fileType) {
        case 'documents':
          return mimeType.includes('pdf') || 
                 mimeType.includes('document') || 
                 mimeType.includes('text') ||
                 mimeType.includes('spreadsheet') ||
                 mimeType.includes('presentation') ||
                 mimeType.includes('msword') ||
                 mimeType.includes('officedocument');
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

export const updateFileAccess = async (fileId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('files')
      .update({ 
        last_accessed_at: new Date().toISOString() 
      })
      .eq('id', fileId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating file access:', error);
    // Don't throw error as this is not critical
  }
};
