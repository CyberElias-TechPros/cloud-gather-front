import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  AtSign, 
  User, 
  Key, 
  Loader2, 
  Check, 
  Shield, 
  ArrowRight,
  Eye,
  EyeOff,
  Github,
  Mail,
  AlertTriangle
} from 'lucide-react';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();
  
  // If user is already logged in, redirect to home
  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  // Form states
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });
  
  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0, // 0-4 password strength score
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecial: false,
    hasMinLength: false
  });
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setRegistrationForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Calculate password strength when password field changes
    if (name === 'password') {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }
  };
  
  // Calculate password strength
  const calculatePasswordStrength = (password: string) => {
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;
    
    // Calculate score based on criteria
    let score = 0;
    if (hasLowercase) score++;
    if (hasUppercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    if (hasMinLength) score++;
    
    // Normalize score to 0-4 range
    score = Math.min(4, Math.floor(score / 5 * 4));
    
    return {
      score,
      hasLowercase,
      hasUppercase,
      hasNumber,
      hasSpecial,
      hasMinLength
    };
  };
  
  // Get password strength label and color
  const getPasswordStrengthInfo = () => {
    const { score } = passwordStrength;
    
    switch (score) {
      case 0:
        return { label: 'Very Weak', color: 'bg-red-500' };
      case 1:
        return { label: 'Weak', color: 'bg-orange-500' };
      case 2:
        return { label: 'Fair', color: 'bg-yellow-500' };
      case 3:
        return { label: 'Good', color: 'bg-lime-500' };
      case 4:
        return { label: 'Strong', color: 'bg-green-500' };
      default:
        return { label: 'Very Weak', color: 'bg-red-500' };
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form inputs
    if (!registrationForm.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!registrationForm.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    if (!registrationForm.password) {
      toast.error('Please enter a password');
      return;
    }
    
    if (registrationForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    
    if (registrationForm.password !== registrationForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (!registrationForm.agreeTerms) {
      toast.error('You must agree to the terms of service');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Register the user with email and password only
      await register(
        registrationForm.email,
        registrationForm.password
      );
      
      // Registration successful - auth provider will handle redirecting
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <Card className="border-border shadow-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="bg-primary rounded-full p-3">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
            <CardDescription>
              Join Cloud Edifix to manage all your cloud storage in one place
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Full Name
                  </span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter your name"
                  value={registrationForm.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">
                  <span className="flex items-center">
                    <AtSign className="h-4 w-4 mr-1" />
                    Email Address
                  </span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={registrationForm.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">
                  <span className="flex items-center">
                    <Key className="h-4 w-4 mr-1" />
                    Password
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={registrationForm.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                
                {/* Password strength indicator */}
                {registrationForm.password && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Password strength:</span>
                      <span className="text-sm font-medium">
                        {getPasswordStrengthInfo().label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getPasswordStrengthInfo().color} transition-all`}
                        style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                      ></div>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        {passwordStrength.hasMinLength ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        )}
                        At least 8 characters
                      </li>
                      <li className="flex items-center">
                        {passwordStrength.hasUppercase ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        )}
                        At least one uppercase letter
                      </li>
                      <li className="flex items-center">
                        {passwordStrength.hasNumber ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        )}
                        At least one number
                      </li>
                      <li className="flex items-center">
                        {passwordStrength.hasSpecial ? (
                          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        )}
                        At least one special character
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  <span className="flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Confirm Password
                  </span>
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={registrationForm.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                {registrationForm.password && registrationForm.confirmPassword && 
                  registrationForm.password !== registrationForm.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="agreeTerms" 
                  name="agreeTerms"
                  checked={registrationForm.agreeTerms}
                  onCheckedChange={(checked) => 
                    setRegistrationForm(prev => ({ ...prev, agreeTerms: !!checked }))
                  }
                  required
                />
                <label
                  htmlFor="agreeTerms"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>
                  {" "}and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                    Creating Account...
                  </>
                ) : (
                  <>
                    Sign Up <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="w-full" disabled={isLoading}>
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
              <Button variant="outline" className="w-full" disabled={isLoading}>
                <Mail className="h-4 w-4 mr-2" />
                Google
              </Button>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center">
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
