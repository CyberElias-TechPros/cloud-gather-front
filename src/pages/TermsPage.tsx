
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const TermsPage = () => {
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
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
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
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-lg">
            <p className="lead">
              These Terms of Service ("Terms") govern your access to and use of CloudUnity's services, 
              including our website, mobile applications, and other online products and services (collectively, the "Services").
            </p>
            
            <p>
              By accessing or using our Services, you agree to be bound by these Terms. If you do not agree to 
              these Terms, you may not access or use the Services.
            </p>
            
            <h2>1. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Services. By agreeing to these Terms, you represent and 
              warrant that you are at least 13 years old and have the legal capacity to enter into these Terms.
            </p>
            
            <h2>2. Account Registration</h2>
            <p>
              When you register for an account, you may be required to provide us with some information about yourself, 
              such as your email address or other contact information. You agree to provide accurate, current, and 
              complete information and to keep this information updated.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities 
              that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
            
            <h2>3. Cloud Storage Integration</h2>
            <p>
              Our Service allows you to integrate with third-party cloud storage providers. By connecting these providers 
              to our Service, you authorize us to access and interact with your accounts on those services on your behalf.
            </p>
            <p>
              You acknowledge that:
            </p>
            <ul>
              <li>We do not control third-party services and are not responsible for their availability, reliability, or security.</li>
              <li>Your use of third-party services is subject to their own terms of service and privacy policies.</li>
              <li>You are responsible for any fees charged by third-party services.</li>
              <li>We will only access your third-party accounts as authorized by you and as required to provide our Services.</li>
            </ul>
            
            <h2>4. Your Content</h2>
            <p>
              You retain ownership of any content that you upload, store, or share through our Services ("Your Content"). 
              By using our Services, you grant us a worldwide, non-exclusive, royalty-free license to use, copy, 
              modify, and display Your Content, but only as necessary to provide the Services to you.
            </p>
            <p>
              You are solely responsible for Your Content and the consequences of sharing it. You represent and warrant that:
            </p>
            <ul>
              <li>You own or have obtained all necessary rights to Your Content.</li>
              <li>Your Content does not violate any laws or infringe on the rights of any third party.</li>
              <li>Your Content does not violate these Terms or any applicable policies.</li>
            </ul>
            
            <h2>5. Prohibited Conduct</h2>
            <p>
              You agree not to:
            </p>
            <ul>
              <li>Use the Services in any manner that could interfere with, disrupt, negatively affect, or inhibit other users from fully enjoying the Services.</li>
              <li>Use the Services to store or transmit malware, viruses, or other harmful code.</li>
              <li>Attempt to circumvent any security or access restrictions of the Services.</li>
              <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with a person or entity.</li>
              <li>Use the Services to violate any applicable laws or regulations.</li>
            </ul>
            
            <h2>6. Intellectual Property</h2>
            <p>
              Our Services and all content, features, and functionality thereof, including but not limited to all information, 
              software, text, displays, images, and the design, selection, and arrangement thereof, are owned by CloudUnity, 
              its licensors, or other providers and are protected by copyright, trademark, patent, trade secret, and other 
              intellectual property or proprietary rights laws.
            </p>
            
            <h2>7. Termination</h2>
            <p>
              We may terminate or suspend your access to all or part of the Services at any time, with or without cause, 
              with or without notice, effective immediately.
            </p>
            <p>
              Upon termination, your right to use the Services will immediately cease. All provisions of these Terms which 
              by their nature should survive termination shall survive termination, including, without limitation, ownership 
              provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
            
            <h2>8. Disclaimers</h2>
            <p>
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
              INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
              TITLE, AND NON-INFRINGEMENT.
            </p>
            
            <h2>9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL CLOUDUNITY, ITS AFFILIATES, OR THEIR RESPECTIVE 
              OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, 
              GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, THAT RESULT FROM THE USE OF, OR INABILITY TO USE, 
              THE SERVICES.
            </p>
            
            <h2>10. Changes to These Terms</h2>
            <p>
              We may revise these Terms from time to time. The most current version will always be posted on our website. 
              If a revision, in our sole discretion, is material, we will notify you via email or through the Services. 
              By continuing to access or use the Services after those revisions become effective, you agree to be bound 
              by the revised Terms.
            </p>
            
            <h2>11. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at legal@cloudunity.io.
            </p>
            
            <p className="text-muted-foreground mt-8">
              Last updated: June 1, 2023
            </p>
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

export default TermsPage;
