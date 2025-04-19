
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
  image: string;
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
      tags: post.tags ? JSON.parse(post.tags) : []
    }));
  } catch (error) {
    console.error('Failed to fetch blog posts:', error);
    // Return sample data as fallback
    return getSampleBlogPosts();
  }
};

export const fetchBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      console.error(`Error fetching blog post with slug ${slug}:`, error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      ...data,
      date: new Date(data.date),
      tags: data.tags ? JSON.parse(data.tags) : []
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
      tags: post.tags ? JSON.parse(post.tags) : []
    }));
  } catch (error) {
    console.error(`Failed to fetch blog posts in category ${category}:`, error);
    // Filter sample data as fallback
    return getSampleBlogPosts().filter(post => post.category === category);
  }
};

export const getSampleBlogPosts = (): BlogPost[] => {
  return [
    {
      id: 1,
      title: 'Introducing Cloud Edifix: A New Way to Manage Your Cloud Storage',
      excerpt: 'We're excited to announce the launch of Cloud Edifix, the platform that unifies all your cloud storage providers in one place.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-04-01'),
      author: 'Maya Rodriguez',
      category: 'Product',
      tags: ['launch', 'announcement', 'product'],
      image: '/images/blog/launch-post.jpg',
      slug: 'introducing-cloud-edifix'
    },
    {
      id: 2,
      title: 'How to Optimize Your Cloud Storage and Save Money',
      excerpt: 'Learn practical strategies to manage your cloud storage more efficiently and reduce costs across multiple providers.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-03-25'),
      author: 'James Chen',
      category: 'Tutorials',
      tags: ['cost-saving', 'optimization', 'guide'],
      image: '/images/blog/cloud-costs.jpg',
      slug: 'optimize-cloud-storage-save-money'
    },
    {
      id: 3,
      title: '5 Security Best Practices for Cloud Storage in 2025',
      excerpt: 'Keep your files safe with these essential security measures for protecting your data across multiple cloud storage providers.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-03-18'),
      author: 'Sarah Williams',
      category: 'Security',
      tags: ['security', 'protection', 'best-practices'],
      image: '/images/blog/security-tips.jpg',
      slug: 'security-best-practices-2025'
    },
    {
      id: 4,
      title: 'Cloud Edifix API: Build Powerful Integrations with Your Apps',
      excerpt: 'Discover how to leverage the Cloud Edifix API to create custom applications and automate your workflow.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-03-10'),
      author: 'Alex Johnson',
      category: 'Developers',
      tags: ['api', 'integration', 'development'],
      image: '/images/blog/api-integration.jpg',
      slug: 'cloud-edifix-api-integrations'
    },
    {
      id: 5,
      title: 'The Future of Cloud Storage: Trends to Watch in 2025',
      excerpt: 'Explore emerging technologies and trends shaping the future of cloud storage and file management.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-03-02'),
      author: 'Taylor Kim',
      category: 'Industry',
      tags: ['trends', 'future', 'technology'],
      image: '/images/blog/future-trends.jpg',
      slug: 'future-cloud-storage-trends-2025'
    },
    {
      id: 6,
      title: 'Case Study: How TechCorp Saved 40% on Storage Costs with Cloud Edifix',
      excerpt: 'Learn how a leading tech company optimized their cloud storage strategy and achieved significant cost savings.',
      content: 'Full content of the blog post would go here.',
      date: new Date('2025-02-20'),
      author: 'Diana Patel',
      category: 'Case Studies',
      tags: ['case-study', 'success-story', 'business'],
      image: '/images/blog/case-study.jpg',
      slug: 'techcorp-case-study'
    }
  ];
};
