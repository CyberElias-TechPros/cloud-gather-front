
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Search } from 'lucide-react';

const BlogPage = () => {
  const blogPosts = [
    {
      id: 1,
      title: "Introducing Cloud Edifix",
      excerpt: "We're excited to announce the launch of Cloud Edifix, the unified cloud storage solution that brings together all your favorite providers.",
      date: "2023-04-01",
      author: {
        name: "Sarah Johnson",
        role: "Co-founder",
        avatar: "https://i.pravatar.cc/300?img=1"
      },
      category: "Announcement",
      imageUrl: "https://images.unsplash.com/photo-1633409361618-c73427e4e206"
    },
    {
      id: 2,
      title: "How to Get the Most Out of Multiple Cloud Storage Providers",
      excerpt: "Learn how to effectively use multiple cloud storage providers without the headache of managing them separately.",
      date: "2023-04-15",
      author: {
        name: "Michael Chen",
        role: "Product Manager",
        avatar: "https://i.pravatar.cc/300?img=3"
      },
      category: "Tutorials",
      imageUrl: "https://images.unsplash.com/photo-1544396821-4dd40b938ad3"
    },
    {
      id: 3,
      title: "The Future of Cloud Storage: Multi-Cloud Strategies",
      excerpt: "Why businesses are increasingly adopting multi-cloud strategies, and how Cloud Edifix helps with this transition.",
      date: "2023-05-02",
      author: {
        name: "Alex Rodriguez",
        role: "Cloud Architect",
        avatar: "https://i.pravatar.cc/300?img=4"
      },
      category: "Insights",
      imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa"
    },
    {
      id: 4,
      title: "Security Best Practices for Cloud Storage",
      excerpt: "Keep your files safe with these essential security practices for cloud storage, no matter which provider you use.",
      date: "2023-05-20",
      author: {
        name: "Olivia Williams",
        role: "Security Specialist",
        avatar: "https://i.pravatar.cc/300?img=5"
      },
      category: "Security",
      imageUrl: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7"
    },
    {
      id: 5,
      title: "Cloud Edifix API: Building Custom Integrations",
      excerpt: "A deep dive into our API and how developers can build custom integrations with their favorite tools.",
      date: "2023-06-10",
      author: {
        name: "David Park",
        role: "Developer Advocate",
        avatar: "https://i.pravatar.cc/300?img=7"
      },
      category: "Developers",
      imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c"
    },
    {
      id: 6,
      title: "Comparing Cloud Storage Providers: Which One Is Right for You?",
      excerpt: "An in-depth comparison of popular cloud storage providers and how to choose the best one for your needs.",
      date: "2023-06-25",
      author: {
        name: "Emma Thompson",
        role: "Content Strategist",
        avatar: "https://i.pravatar.cc/300?img=9"
      },
      category: "Guides",
      imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"
    }
  ];

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const categories = ["All", "Announcement", "Tutorials", "Insights", "Security", "Developers", "Guides"];

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
      
      {/* Hero Section */}
      <section className="container mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The latest news, updates, and insights about cloud storage and Cloud Edifix.
          </p>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
          <div className="relative w-full md:w-auto md:min-w-[320px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search articles..." 
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {categories.map((category, index) => (
              <Badge 
                key={index} 
                variant={category === "All" ? "default" : "outline"}
                className="cursor-pointer"
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Featured Post */}
        <div className="mb-12">
          <div className="relative rounded-lg overflow-hidden">
            <div 
              className="absolute inset-0 bg-cover bg-center" 
              style={{ backgroundImage: `url(${blogPosts[0].imageUrl})` }}
            >
              <div className="absolute inset-0 bg-black bg-opacity-60"></div>
            </div>
            <div className="relative p-8 md:p-12 text-white">
              <Badge>{blogPosts[0].category}</Badge>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mt-4 mb-4">
                {blogPosts[0].title}
              </h2>
              <p className="mb-6 max-w-2xl text-gray-200 text-lg">
                {blogPosts[0].excerpt}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src={blogPosts[0].author.avatar} />
                    <AvatarFallback>{blogPosts[0].author.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{blogPosts[0].author.name}</p>
                    <p className="text-sm text-gray-300">{blogPosts[0].author.role}</p>
                  </div>
                </div>
                <div className="flex items-center sm:ml-4">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm">{formatDate(blogPosts[0].date)}</span>
                </div>
              </div>
              <Button size="lg" className="mt-4">Read More</Button>
            </div>
          </div>
        </div>
        
        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.slice(1).map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <div 
                className="h-48 bg-cover bg-center" 
                style={{ backgroundImage: `url(${post.imageUrl})` }}
              ></div>
              <CardHeader>
                <div className="flex justify-between items-center mb-2">
                  <Badge variant="outline">{post.category}</Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(post.date)}
                  </div>
                </div>
                <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                <CardDescription className="line-clamp-3 mt-2">
                  {post.excerpt}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback>{post.author.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <p className="font-medium">{post.author.name}</p>
                    <p className="text-muted-foreground">{post.author.role}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">Read More</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        {/* Pagination */}
        <div className="flex justify-center mt-12">
          <div className="flex gap-2">
            <Button variant="outline" disabled>Previous</Button>
            <Button variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">1</Button>
            <Button variant="outline">2</Button>
            <Button variant="outline">3</Button>
            <Button variant="outline">Next</Button>
          </div>
        </div>
      </section>
      
      {/* Newsletter */}
      <section className="container mx-auto py-16 my-12 bg-muted/30 rounded-lg">
        <div className="text-center max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Subscribe to our newsletter</h2>
          <p className="text-muted-foreground mb-8">
            Stay up to date with the latest news, updates, and insights from Cloud Edifix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input type="email" placeholder="Your email address" />
            <Button>Subscribe</Button>
          </div>
        </div>
      </section>
      
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
            <p className="text-muted-foreground">© 2023 Cloud Edifix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogPage;
