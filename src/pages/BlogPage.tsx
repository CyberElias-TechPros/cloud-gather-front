
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Search, Calendar, User, Tag } from 'lucide-react';

// Sample blog posts data
const blogPosts = [
  {
    id: 1,
    title: 'Introducing Cloud Edifix: A New Way to Manage Your Cloud Storage',
    excerpt: 'We're excited to announce the launch of Cloud Edifix, the platform that unifies all your cloud storage providers in one place.',
    date: new Date('2025-04-01'),
    author: 'Maya Rodriguez',
    category: 'Product',
    tags: ['launch', 'announcement', 'product'],
    image: '/images/blog/launch-post.jpg'
  },
  {
    id: 2,
    title: 'How to Optimize Your Cloud Storage and Save Money',
    excerpt: 'Learn practical strategies to manage your cloud storage more efficiently and reduce costs across multiple providers.',
    date: new Date('2025-03-25'),
    author: 'James Chen',
    category: 'Tutorials',
    tags: ['cost-saving', 'optimization', 'guide'],
    image: '/images/blog/cloud-costs.jpg'
  },
  {
    id: 3,
    title: '5 Security Best Practices for Cloud Storage in 2025',
    excerpt: 'Keep your files safe with these essential security measures for protecting your data across multiple cloud storage providers.',
    date: new Date('2025-03-18'),
    author: 'Sarah Williams',
    category: 'Security',
    tags: ['security', 'protection', 'best-practices'],
    image: '/images/blog/security-tips.jpg'
  },
  {
    id: 4,
    title: 'Cloud Edifix API: Build Powerful Integrations with Your Apps',
    excerpt: 'Discover how to leverage the Cloud Edifix API to create custom applications and automate your workflow.',
    date: new Date('2025-03-10'),
    author: 'Alex Johnson',
    category: 'Developers',
    tags: ['api', 'integration', 'development'],
    image: '/images/blog/api-integration.jpg'
  },
  {
    id: 5,
    title: 'The Future of Cloud Storage: Trends to Watch in 2025',
    excerpt: 'Explore emerging technologies and trends shaping the future of cloud storage and file management.',
    date: new Date('2025-03-02'),
    author: 'Taylor Kim',
    category: 'Industry',
    tags: ['trends', 'future', 'technology'],
    image: '/images/blog/future-trends.jpg'
  },
  {
    id: 6,
    title: 'Case Study: How TechCorp Saved 40% on Storage Costs with Cloud Edifix',
    excerpt: 'Learn how a leading tech company optimized their cloud storage strategy and achieved significant cost savings.',
    date: new Date('2025-02-20'),
    author: 'Diana Patel',
    category: 'Case Studies',
    tags: ['case-study', 'success-story', 'business'],
    image: '/images/blog/case-study.jpg'
  }
];

// Categories derived from blog posts
const categories = Array.from(new Set(blogPosts.map(post => post.category)));

const BlogPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="container mx-auto py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
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
            <Link to="/" className="text-xl font-bold">Cloud Edifix</Link>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/blog" className="text-foreground font-medium">Blog</Link>
            <Link to="/api-docs" className="text-muted-foreground hover:text-foreground">API</Link>
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
      
      {/* Blog Header */}
      <div className="container mx-auto py-12">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">Cloud Edifix Blog</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Insights, tutorials, and updates about managing your cloud storage efficiently.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search articles..." 
              className="pl-10"
            />
          </div>
        </div>
      </div>
      
      {/* Categories */}
      <div className="container mx-auto mb-12">
        <Tabs defaultValue="all">
          <TabsList className="w-full justify-start overflow-auto py-2">
            <TabsTrigger value="all">All Posts</TabsTrigger>
            {categories.map(category => (
              <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map(post => (
                <Card key={post.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                      <div className="text-white">
                        <h3 className="font-bold text-lg mb-2">{post.title}</h3>
                        <div className="flex items-center text-xs space-x-4">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {post.date.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {post.author}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <span className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">
                        {post.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      {post.excerpt}
                    </p>
                    <Button variant="link" className="px-0">
                      Read more <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          {categories.map(category => (
            <TabsContent key={category} value={category} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogPosts
                  .filter(post => post.category === category)
                  .map(post => (
                    <Card key={post.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                          <div className="text-white">
                            <h3 className="font-bold text-lg mb-2">{post.title}</h3>
                            <div className="flex items-center text-xs space-x-4">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {post.date.toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                              <div className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {post.author}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm mb-4">
                          {post.excerpt}
                        </p>
                        <Button variant="link" className="px-0">
                          Read more <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Newsletter */}
      <div className="bg-primary/5 py-16">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Subscribe to our newsletter</h2>
          <p className="text-muted-foreground mb-6">
            Stay up to date with the latest cloud storage tips, tutorials, and features.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Enter your email" className="sm:flex-1" />
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

export default BlogPage;
