
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const AboutPage = () => {
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
            <Link to="/" className="text-xl font-bold">CloudUnity</Link>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/about" className="text-foreground font-medium">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link>
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
      
      {/* Main Content */}
      <main className="container mx-auto py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">About CloudUnity</h1>
          
          <div className="prose prose-lg">
            <p className="lead">
              CloudUnity was founded in 2023 with a simple mission: to solve the fragmentation problem in cloud storage. 
              As users increasingly rely on multiple cloud storage providers, we saw the need for a unified solution 
              to bring all these services together.
            </p>
            
            <h2>Our Mission</h2>
            <p>
              Our mission is to simplify how people interact with their digital files by providing a single, 
              seamless interface to access, manage, and share files across different cloud storage providers. 
              We believe in making technology work for people, not the other way around.
            </p>
            
            <h2>Our Team</h2>
            <p>
              CloudUnity was built by a team of engineers and designers who experienced firsthand the frustration 
              of managing files across multiple cloud services. With backgrounds at companies like Dropbox, Microsoft, 
              and Google, our team brings together extensive experience in cloud storage, security, and user experience design.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-muted mx-auto mb-4"></div>
                <h3 className="text-lg font-bold">Alex Rodriguez</h3>
                <p className="text-sm text-muted-foreground">Co-Founder & CEO</p>
              </div>
              
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-muted mx-auto mb-4"></div>
                <h3 className="text-lg font-bold">Sarah Chen</h3>
                <p className="text-sm text-muted-foreground">Co-Founder & CTO</p>
              </div>
              
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-muted mx-auto mb-4"></div>
                <h3 className="text-lg font-bold">Marcus Johnson</h3>
                <p className="text-sm text-muted-foreground">Head of Design</p>
              </div>
            </div>
            
            <h2>Our Values</h2>
            <ul>
              <li>
                <strong>User Privacy:</strong> We believe your files are your business. CloudUnity never stores your 
                actual files - they remain in your original cloud storage providers.
              </li>
              <li>
                <strong>Simplicity:</strong> Technology should make life simpler, not more complex. We strive to create 
                products that are intuitive and easy to use.
              </li>
              <li>
                <strong>Transparency:</strong> We believe in being clear about how our service works, how we use your data, 
                and how we make money.
              </li>
              <li>
                <strong>Security:</strong> We implement industry-best security practices to protect your data and connections.
              </li>
            </ul>
            
            <h2>Our Approach</h2>
            <p>
              CloudUnity uses OAuth to securely connect to your cloud storage providers. We never see or store your 
              provider passwords. Instead, we receive access tokens that allow us to interact with your files on your behalf. 
              This approach ensures security while providing a seamless experience.
            </p>
            
            <p>
              Our platform is built on modern, scalable architecture that allows us to provide reliable service 
              while continuing to add features and support for new cloud providers.
            </p>
            
            <h2>Looking Forward</h2>
            <p>
              We're just getting started on our journey to unify cloud storage. Our roadmap includes support for 
              more cloud providers, enhanced collaboration features, and powerful search capabilities across all 
              your storage providers.
            </p>
            
            <p>
              We invite you to join us on this journey. Your feedback helps us improve and build the features that 
              matter most to you.
            </p>
          </div>
          
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-6">Ready to simplify your cloud storage experience?</h2>
            <Link to="/auth?signup=true">
              <Button size="lg">Get Started for Free</Button>
            </Link>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-background border-t py-12 mt-12">
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
                <span className="text-xl font-bold">CloudUnity</span>
              </div>
              <p className="text-muted-foreground">
                Unify your cloud storage experience across all providers.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link to="/#features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link to="/#providers" className="text-muted-foreground hover:text-foreground">Providers</Link></li>
                <li><Link to="/#pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link to="/#faq" className="text-muted-foreground hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                <li><Link to="/careers" className="text-muted-foreground hover:text-foreground">Careers</Link></li>
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
            <p className="text-muted-foreground">© 2023 CloudUnity. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
