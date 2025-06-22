
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { providersList, ProviderComparison } from '@/components/providers/ProviderInfo';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
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
            <span className="text-xl font-bold">CloudUnity</span>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#providers" className="text-muted-foreground hover:text-foreground">Providers</a>
            <a href="#comparison" className="text-muted-foreground hover:text-foreground">Comparison</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a>
          </div>
          
          <div className="flex space-x-4">
            <Link to="/auth">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/auth">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </nav>
      </header>
      
      {/* Hero Section */}
      <section className="container mx-auto py-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">
          All Your Cloud Storage <br />
          <span className="text-primary">In One Place</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Access, manage, and share files from all your cloud storage providers with a single unified interface.
          No more switching between apps or losing track of your files.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="px-8">Get Started</Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg">Learn More</Button>
          </a>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="bg-muted/50 py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Powerful Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a7 7 0 0 0-7 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Unified Access</h3>
              <p className="text-muted-foreground">
                Connect all your cloud storage accounts and access them from a single dashboard. 
                No need to switch between different services.
              </p>
            </div>
            
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">File Sharing</h3>
              <p className="text-muted-foreground">
                Share files from any connected storage with customizable permissions. 
                Control who can view, edit, or download your files.
              </p>
            </div>
            
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="m21 8-5-5v5" />
                  <path d="M3 8v12a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V8" />
                  <path d="M3 17h18" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Storage Management</h3>
              <p className="text-muted-foreground">
                Visualize and manage your storage usage across providers. Identify large files 
                and optimize your storage allocation.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10">
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M2 20h20" />
                  <path d="M5 20V8.2a1 1 0 0 1 .4-.8l4.2-3.2a1 1 0 0 1 1.2 0l4.2 3.2a1 1 0 0 1 .4.8V20" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                  <path d="M8 16h8" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">API Access</h3>
              <p className="text-muted-foreground">
                Integrate CloudUnity with your websites and applications. Use our API to access your 
                files programmatically from any platform.
              </p>
            </div>
            
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect width="16" height="16" x="4" y="4" rx="2" />
                  <path d="M10 10h4v4h-4z" />
                  <path d="m17 7-5 5" />
                  <path d="m7 17 5-5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Advanced Security</h3>
              <p className="text-muted-foreground">
                Protect your files with end-to-end encryption. Set expiration dates on shared links 
                and control access with fine-grained permissions.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Providers Section */}
      <section id="providers" className="py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Supported Storage Providers</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {providersList.map(provider => (
              <div key={provider.id} className="bg-background rounded-lg p-6 shadow-sm flex flex-col items-center">
                <div className="h-16 w-16 mb-4 relative">
                  <img 
                    src={provider.icon} 
                    alt={`${provider.name} logo`} 
                    className="object-contain h-full w-full"
                    onError={(e) => {
                      e.currentTarget.src = '/images/cloud-logo.png';
                    }}
                  />
                </div>
                <h3 className="text-lg font-medium mb-1 text-center">{provider.name}</h3>
                <p className="text-sm text-muted-foreground text-center">{provider.freeStorageSize} free</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Comparison Section */}
      <section id="comparison" className="bg-muted/50 py-20">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Provider Comparison</h2>
          <ProviderComparison />
        </div>
      </section>
      
      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-16">Frequently Asked Questions</h2>
          
          <div className="space-y-8">
            <div className="border-b pb-6">
              <h3 className="text-xl font-bold mb-2">Is CloudUnity free to use?</h3>
              <p className="text-muted-foreground">
                Yes, CloudUnity is free to use with basic features. We offer premium plans for 
                additional storage, enhanced features, and API access for businesses and developers.
              </p>
            </div>
            
            <div className="border-b pb-6">
              <h3 className="text-xl font-bold mb-2">Can I access my files offline?</h3>
              <p className="text-muted-foreground">
                CloudUnity primarily provides online access to your cloud storage. However, you can mark specific 
                files for offline access, which will download and cache them on your device.
              </p>
            </div>
            
            <div className="border-b pb-6">
              <h3 className="text-xl font-bold mb-2">How secure is my data?</h3>
              <p className="text-muted-foreground">
                We take security seriously. CloudUnity uses industry-standard encryption for data transfer and 
                stores only the necessary information to connect to your providers. We never store your actual 
                files - those remain in your original cloud storage accounts.
              </p>
            </div>
            
            <div className="border-b pb-6">
              <h3 className="text-xl font-bold mb-2">How do I connect my cloud storage accounts?</h3>
              <p className="text-muted-foreground">
                After signing up, go to the Providers page and click on "Add Provider". Follow the authentication 
                process for each provider you want to connect. CloudUnity uses OAuth, so we never see your 
                provider passwords.
              </p>
            </div>
            
            <div className="border-b pb-6">
              <h3 className="text-xl font-bold mb-2">Can I use CloudUnity for my business?</h3>
              <p className="text-muted-foreground">
                Absolutely! We offer business plans with team management, enhanced security, and API access. 
                Contact our sales team for custom enterprise solutions tailored to your organization's needs.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to simplify your cloud storage?</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10">
            Join thousands of users who have streamlined their file management with CloudUnity.
            Get started for free today!
          </p>
          <Link to="/auth">
            <Button variant="secondary" size="lg" className="px-8">
              Create Free Account
            </Button>
          </Link>
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
                <span className="text-xl font-bold">CloudUnity</span>
              </div>
              <p className="text-muted-foreground">
                Unify your cloud storage experience across all providers.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-muted-foreground hover:text-foreground">Features</a></li>
                <li><a href="#providers" className="text-muted-foreground hover:text-foreground">Providers</a></li>
                <li><Link to="/auth" className="text-muted-foreground hover:text-foreground">Get Started</Link></li>
                <li><a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
                <li><Link to="/auth" className="text-muted-foreground hover:text-foreground">Login</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground">© 2024 CloudUnity. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Twitter</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.1-4.8 4-8.9 9-5.8 1.7-1 3-2.2 4-3.1z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">GitHub</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                  <path d="M9 18c-4.51 2-5-2-7-2"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">LinkedIn</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect width="4" height="12" x="2" y="9"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
