
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, Tag, ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { fetchBlogPostBySlug, fetchBlogPosts, type BlogPost } from '@/services/blogService';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPost = async () => {
      if (!slug) {
        setError('Post not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const postData = await fetchBlogPostBySlug(slug);
        if (!postData) {
          setError('Post not found');
          return;
        }
        
        setPost(postData);
        
        // Fetch related posts (same category)
        const allPosts = await fetchBlogPosts();
        const related = allPosts
          .filter(p => p.category === postData.category && p.id !== postData.id)
          .slice(0, 3);
        
        setRelatedPosts(related);
      } catch (e) {
        setError('Failed to load blog post');
        console.error('Error loading blog post:', e);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="container mx-auto py-6">
          <nav className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-6 w-6 text-primary"
              >
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
              <span className="text-xl font-bold">Cloud Edifix</span>
            </Link>
          </nav>
        </header>
        
        <div className="container mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">The blog post you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/blog')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="container mx-auto py-6">
        <nav className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6 text-primary"
            >
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
            <span className="text-xl font-bold">Cloud Edifix</span>
          </Link>
          
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/blog" className="text-foreground font-medium">Blog</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
          </div>
          
          <div className="flex space-x-4">
            <Link to="/auth">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </nav>
      </header>
      
      {/* Back to blog */}
      <div className="container mx-auto py-6">
        <Button variant="ghost" onClick={() => navigate('/blog')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Blog
        </Button>
      </div>
      
      {/* Blog Post */}
      <div className="container mx-auto py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden border-0 shadow-none">
            <div className="aspect-[2/1] bg-muted relative mb-8">
              {post.image && (
                <img 
                  src={post.image} 
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-8 text-white w-full">
                  <div className="bg-primary/90 text-white text-sm py-1 px-3 rounded-full inline-block mb-4">
                    {post.category}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {post.date.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {post.author}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <CardContent className="px-4 md:px-8 pb-12">
              <div className="prose prose-lg dark:prose-invert max-w-none">
                {post.content ? (
                  <div dangerouslySetInnerHTML={{ __html: post.content }} />
                ) : (
                  <>
                    <p className="text-lg mb-6">{post.excerpt}</p>
                    <p className="mb-6">
                      Cloud Edifix provides a unified interface for managing files across different cloud storage providers. This approach offers several benefits:
                    </p>
                    <ul className="my-6 list-disc pl-6">
                      <li className="mb-2">Simplified file management across multiple cloud services</li>
                      <li className="mb-2">Reduced storage costs through better utilization</li>
                      <li className="mb-2">Enhanced security with centralized access control</li>
                      <li className="mb-2">Improved productivity with powerful search across all providers</li>
                    </ul>
                    <p className="mb-6">
                      Our platform integrates with all major cloud storage providers including Google Drive, Dropbox, OneDrive, and more. Users can access, search, move, and share files regardless of where they're stored.
                    </p>
                    <h2 className="text-2xl font-bold mt-8 mb-4">Key Features</h2>
                    <p className="mb-6">
                      Cloud Edifix offers a comprehensive set of features designed to make cloud storage management simple and efficient:
                    </p>
                    <ul className="my-6 list-disc pl-6">
                      <li className="mb-2">Unified dashboard for all cloud storage providers</li>
                      <li className="mb-2">Cross-platform search capabilities</li>
                      <li className="mb-2">Advanced file organization and tagging</li>
                      <li className="mb-2">Seamless file transfers between providers</li>
                      <li className="mb-2">Robust sharing and collaboration tools</li>
                      <li className="mb-2">Automated backup and synchronization</li>
                    </ul>
                  </>
                )}
              </div>
              
              <div className="flex items-center mt-8 pt-6 border-t">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map(tag => (
                      <div key={tag} className="flex items-center bg-muted text-xs py-1 px-2 rounded-full">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <div className="container mx-auto py-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map(relatedPost => (
                <Card key={relatedPost.id} className="overflow-hidden">
                  <Link to={`/blog/${relatedPost.slug}`}>
                    <div className="aspect-video bg-muted relative">
                      {relatedPost.image && (
                        <img 
                          src={relatedPost.image} 
                          alt={relatedPost.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold line-clamp-2 mb-2">{relatedPost.title}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">{relatedPost.excerpt}</p>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Newsletter */}
      <div className="bg-primary/5 py-16">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Subscribe to our newsletter</h2>
          <p className="text-muted-foreground mb-6">
            Stay up to date with the latest cloud storage tips, tutorials, and features.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="sm:flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button>Subscribe</Button>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="h-6 w-6 text-primary"
                >
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
                <span className="text-xl font-bold">Cloud Edifix</span>
              </div>
              <p className="text-muted-foreground">
                Unify your cloud storage experience across all providers.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link to="/providers" className="text-muted-foreground hover:text-foreground">Providers</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link to="/api-docs" className="text-muted-foreground hover:text-foreground">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                <li><Link to="/developers" className="text-muted-foreground hover:text-foreground">Developers</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
                <li><Link to="/security" className="text-muted-foreground hover:text-foreground">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground">© {new Date().getFullYear()} Cloud Edifix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogPostPage;
