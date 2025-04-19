
import { supabase } from '@/integrations/supabase/client';

export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  date: Date;
  author: string;
  category: string;
  tags: string[];
  image: string | null;
  slug: string;
}

export const fetchBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching blog posts:', error);
      throw error;
    }
    
    // Transform the data to match our BlogPost interface
    return data.map(post => ({
      ...post,
      date: new Date(post.date),
      tags: Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags || '[]')
    }));
  } catch (error) {
    console.error('Failed to fetch blog posts:', error);
    return [];
  }
};

export const fetchBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    
    if (error) {
      console.error(`Error fetching blog post with slug ${slug}:`, error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      ...data,
      date: new Date(data.date),
      tags: Array.isArray(data.tags) ? data.tags : JSON.parse(data.tags || '[]')
    };
  } catch (error) {
    console.error(`Failed to fetch blog post with slug ${slug}:`, error);
    return null;
  }
};

export const fetchBlogPostsByCategory = async (category: string): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('category', category)
      .order('date', { ascending: false });
    
    if (error) {
      console.error(`Error fetching blog posts in category ${category}:`, error);
      throw error;
    }
    
    return data.map(post => ({
      ...post,
      date: new Date(post.date),
      tags: Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags || '[]')
    }));
  } catch (error) {
    console.error(`Failed to fetch blog posts in category ${category}:`, error);
    return [];
  }
};
