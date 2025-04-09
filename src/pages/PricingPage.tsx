
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, X } from 'lucide-react';

const PricingPage = () => {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      description: 'For individual users who want to connect their cloud storage.',
      features: [
        'Connect up to 3 cloud providers',
        '10GB Cloud Edifix storage',
        'Basic file sharing',
        'Mobile app access',
        'Email support',
      ],
      limitations: [
        'No API access',
        'No advanced security features',
        'No team collaboration'
      ],
      popular: false,
      buttonText: 'Get Started'
    },
    {
      name: 'Pro',
      price: '$9.99',
      period: 'per month',
      description: 'For professionals who need more power and security.',
      features: [
        'Connect unlimited cloud providers',
        '100GB Cloud Edifix storage',
        'Advanced file sharing options',
        'Priority cloud provider selection',
        'API access with 1,000 requests/day',
        '24/7 priority support',
        'Advanced security features',
      ],
      limitations: [
        'Limited team collaboration',
      ],
      popular: true,
      buttonText: 'Subscribe'
    },
    {
      name: 'Business',
      price: '$24.99',
      period: 'per user/month',
      description: 'For teams and businesses with advanced needs.',
      features: [
        'Everything in Pro',
        'Unlimited Cloud Edifix storage',
        'Team workspaces',
        'Admin console',
        'Usage analytics',
        'API access with unlimited requests',
        'Custom integration options',
        'Dedicated account manager',
        'SLA with 99.9% uptime',
      ],
      limitations: [],
      popular: false,
      buttonText: 'Contact Sales'
    }
  ];

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
            <Link to="/pricing" className="text-foreground font-medium">Pricing</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link>
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
      <section className="container mx-auto py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
          Choose the plan that works for you. All plans include access to our unified cloud management platform.
        </p>
      </section>
      
      {/* Pricing Cards */}
      <section className="container mx-auto py-8 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg relative' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-medium rounded-bl-lg rounded-tr-lg">
                  Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground ml-2">{plan.period}</span>}
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Features include:</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.limitations.length > 0 && (
                    <>
                      <h4 className="font-medium mt-4">Limitations:</h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, i) => (
                          <li key={i} className="flex items-start">
                            <X className="h-5 w-5 text-red-500 mr-2 mt-0.5 shrink-0" />
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
      
      {/* FAQ Section */}
      <section className="container mx-auto py-16 bg-muted/30 rounded-lg mb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-2">Can I switch plans later?</h3>
              <p className="text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be prorated for the 
                remainder of your billing cycle. When downgrading, the new rate will apply at the start of your next billing cycle.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Do you offer annual subscriptions?</h3>
              <p className="text-muted-foreground">
                Yes, we offer annual subscriptions at a 20% discount compared to monthly billing. 
                Contact our sales team for more information on annual plans.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">What happens if I exceed my API request limit?</h3>
              <p className="text-muted-foreground">
                If you exceed your API request limit, additional requests will be charged at $0.01 per request. 
                You can monitor your API usage in your dashboard and set up alerts to notify you when you're approaching your limit.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Do you offer a free trial for paid plans?</h3>
              <p className="text-muted-foreground">
                Yes, all paid plans come with a 14-day free trial. You can try all the features without any 
                commitment, and you won't be charged until the end of the trial period.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, including Visa, Mastercard, American Express, and Discover. 
                For Business plans, we also support invoicing and wire transfers.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="container mx-auto py-16 text-center mb-16">
        <h2 className="text-3xl font-bold mb-4">Still have questions?</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Our team is here to help you find the perfect plan for your needs.
        </p>
        <Link to="/contact">
          <Button size="lg">Contact Sales</Button>
        </Link>
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

export default PricingPage;
