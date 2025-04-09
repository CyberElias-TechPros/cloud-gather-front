
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PrivacyPage = () => {
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
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg">
            <p className="lead">
              Protecting your privacy is important to us. This Privacy Policy explains how CloudUnity 
              collects, uses, and safeguards your information when you use our website, mobile application, 
              and services ("Services").
            </p>
            
            <p>
              By using our Services, you agree to the collection and use of information in accordance with this policy.
            </p>
            
            <h2>1. Information We Collect</h2>
            <p>
              We collect several types of information from and about users of our Services, including:
            </p>
            
            <h3>a) Information You Provide to Us</h3>
            <ul>
              <li>Account information: When you register for an account, we collect your email address and password.</li>
              <li>Profile information: Information you choose to add to your profile, such as your name and profile picture.</li>
              <li>Payment information: If you subscribe to a paid plan, we collect payment details through our payment processors.</li>
              <li>Communications: Your correspondence with us, including customer support inquiries.</li>
            </ul>
            
            <h3>b) Information From Third-Party Services</h3>
            <p>
              When you connect your third-party cloud storage providers to CloudUnity:
            </p>
            <ul>
              <li>We receive access tokens that allow us to access your files and folders in these services on your behalf.</li>
              <li>We collect metadata about your files and folders (such as names, sizes, and locations), but we don't store the actual file contents on our servers.</li>
              <li>We may collect information about your storage usage, quotas, and account details from these services.</li>
            </ul>
            
            <h3>c) Automatically Collected Information</h3>
            <ul>
              <li>Usage data: Information about how you interact with our Services, including the features you use and the actions you take.</li>
              <li>Device information: Information about your device, operating system, browser type, IP address, and unique device identifiers.</li>
              <li>Cookies and similar technologies: We use cookies and similar technologies to collect information about your browsing activities.</li>
            </ul>
            
            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul>
              <li>Provide, maintain, and improve our Services</li>
              <li>Process and complete transactions</li>
              <li>Send you technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Personalize your experience</li>
              <li>Monitor and analyze trends, usage, and activities in connection with our Services</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Protect the rights and property of CloudUnity and others</li>
            </ul>
            
            <h2>3. Sharing of Information</h2>
            <p>
              We may share your information in the following circumstances:
            </p>
            <ul>
              <li>With third-party service providers that help us operate our Services</li>
              <li>To comply with legal obligations</li>
              <li>To protect and defend our rights and property</li>
              <li>With your consent or at your direction</li>
            </ul>
            <p>
              We will never sell your personal information to third parties.
            </p>
            
            <h2>4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information from 
              unauthorized access, alteration, disclosure, or destruction. However, no method of 
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
            
            <h2>5. Your Choices</h2>
            <p>
              You can access, update, or delete your personal information through your account settings. 
              You may also have certain rights regarding your personal data, depending on your location:
            </p>
            <ul>
              <li>Access: You can request a copy of your personal information.</li>
              <li>Correction: You can request that we correct inaccurate or incomplete information.</li>
              <li>Deletion: You can request that we delete your personal information.</li>
              <li>Objection: You can object to our processing of your personal information.</li>
              <li>Portability: You can request a copy of your personal information in a structured, commonly used, machine-readable format.</li>
            </ul>
            <p>
              To exercise these rights, please contact us at privacy@cloudunity.io.
            </p>
            
            <h2>6. Third-Party Services</h2>
            <p>
              Our Services may contain links to third-party websites and services. We are not responsible for 
              the content or privacy practices of these third parties. We encourage you to review the privacy 
              policies of any third-party services you access.
            </p>
            
            <h2>7. Children's Privacy</h2>
            <p>
              Our Services are not intended for children under the age of 13, and we do not knowingly collect 
              personal information from children under 13. If we become aware that we have collected personal 
              information from a child under 13, we will take steps to delete such information.
            </p>
            
            <h2>8. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review 
              this Privacy Policy periodically for any changes.
            </p>
            
            <h2>9. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@cloudunity.io.
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

export default PrivacyPage;
