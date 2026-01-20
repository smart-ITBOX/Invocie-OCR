import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      toast.success("Welcome back!", {
        description: "Login successful",
        icon: "👋",
      });

      // Redirect admin to admin panel, regular users to dashboard
      if (response.data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (error) {
      toast.error("Login failed", {
        description:
          error.response?.data?.detail || "Please check your credentials",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, registerData);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      toast.success("Account created!", {
        description: "Welcome to Smart ITBox",
        icon: "🎉",
      });
      navigate("/");
    } catch (error) {
      toast.error("Registration failed", {
        description: error.response?.data?.detail || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Email required", {
        description: "Please enter your email address",
      });
      return;
    }
    setSendingReset(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
      toast.success("Reset link sent", {
        description: "Check your email for password reset instructions",
      });
      setForgotPasswordOpen(false);
      setForgotEmail("");
    } catch (error) {
      toast.error("Failed to send reset link", {
        description: error.response?.data?.detail || "Please try again later",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const features = [
    {
      icon: Sparkles,
      text: "AI-Powered Extraction",
      color: "text-blue-400",
      description: "Extract data from any invoice format with 99.5% accuracy",
    },
    {
      icon: ShieldCheck,
      text: "Bank-Level Security",
      color: "text-green-400",
      description: "End-to-end encryption and SOC 2 compliance",
    },
    {
      icon: Lock,
      text: "Data Encryption",
      color: "text-purple-400",
      description: "AES-256 encryption at rest and in transit",
    },
    {
      icon: Zap,
      text: "Fast Processing",
      color: "text-amber-400",
      description: "Process 1000+ invoices in minutes, not hours",
    },
  ];

  return (
    <div
      className="min-h-screen grid md:grid-cols-2 bg-gradient-to-br from-gray-50 to-blue-50"
      data-testid="login-page"
    >
      {/* Left Panel - Enhanced Brand Section */}
      <div className="hidden md:flex flex-col  space-y-10 p-12 bg-gradient-to-br from-[#7eb1fd] to-[#001037] text-white relative overflow-hidden">
        <div className="relative z-10">
          <img className="h-14" src="/logo.png" alt="logo png" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-manrope font-bold leading-tight mb-4">
              Transform Your
              <br />
              <span className="text-[#FFD700]">
                GST & Bank Reconciliation Processing
              </span>
            </h2>
            <p className="text-blue-100/80 text-lg">
              Extract, verify, and export invoice data with AI-powered accuracy
              and efficiency.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <span className="text-white/90">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <p className="text-sm text-white/70 italic">
              "Smart ITBox reduced our invoice processing time by 80% and
              improved accuracy to 99.5%."
            </p>
          </div>
        </div>

        <div className="absolute bottom-5 z-10">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Smart ITBox. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Enhanced Auth Forms */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-5 duration-500">
          {/* Logo for mobile */}
          <div className="md:hidden flex justify-center mb-8">
            <img src="/logo.png" className="h-14" alt="Logo" />
          </div>

          <Card className="border-none shadow-2xl shadow-blue-500/5 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-6">
              <div className="space-y-1">
                <CardTitle className="text-3xl font-manrope font-bold text-[#0B2B5C]">
                  {activeTab === "login" ? "Welcome Back" : "Get Started"}
                </CardTitle>
                <CardDescription className="text-gray-500">
                  {activeTab === "login"
                    ? "Sign in to your account to continue"
                    : "Create your account to get started"}
                </CardDescription>
              </div>
            </CardHeader>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsContent value="login" className="m-0">
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="login-email"
                          className="text-gray-700 font-medium"
                        >
                          Email Address
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="login-email"
                            type="email"
                            data-testid="login-email-input"
                            placeholder="you@example.com"
                            value={loginData.email}
                            onChange={(e) =>
                              setLoginData({
                                ...loginData,
                                email: e.target.value,
                              })
                            }
                            required
                            className="pl-10 h-11 rounded-lg border-gray-300 focus:border-[#0B2B5C] focus:ring-[#0B2B5C]/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label
                            htmlFor="login-password"
                            className="text-gray-700 font-medium"
                          >
                            Password
                          </Label>
                          <button
                            type="button"
                            onClick={() => setForgotPasswordOpen(true)}
                            className="text-sm text-[#0B2B5C] hover:text-[#0B2B5C]/80 transition-colors font-medium"
                            data-testid="forgot-password-link"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="login-password"
                            type={showLoginPassword ? "text" : "password"}
                            data-testid="login-password-input"
                            placeholder="••••••••"
                            value={loginData.password}
                            onChange={(e) =>
                              setLoginData({
                                ...loginData,
                                password: e.target.value,
                              })
                            }
                            required
                            className="pl-10 pr-10 h-11 rounded-lg border-gray-300 focus:border-[#0B2B5C] focus:ring-[#0B2B5C]/20"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowLoginPassword(!showLoginPassword)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            data-testid="toggle-login-password"
                          >
                            {showLoginPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      data-testid="login-submit-btn"
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-[#0B2B5C] to-[#1A3D7C] hover:from-[#1A3D7C] hover:to-[#0B2B5C] text-white font-manrope font-bold text-sm transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Sign In <ArrowRight size={16} />
                        </span>
                      )}
                    </Button>
                  </form>

                  <div className="mt-8">
                    <Separator className="my-6" />
                    <p className="text-center text-sm text-gray-500">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("register")}
                        className="text-[#0B2B5C] hover:text-[#0B2B5C]/80 font-medium transition-colors"
                      >
                        Create one now
                      </button>
                    </p>
                  </div>
                </CardContent>
              </TabsContent>

              <TabsContent value="register" className="m-0">
                <CardContent className="pt-6">
                  <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="register-name"
                          className="text-gray-700 font-medium"
                        >
                          Full Name
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="register-name"
                            type="text"
                            data-testid="register-name-input"
                            placeholder="John Doe"
                            value={registerData.name}
                            onChange={(e) =>
                              setRegisterData({
                                ...registerData,
                                name: e.target.value,
                              })
                            }
                            required
                            className="pl-10 h-11 rounded-lg border-gray-300 focus:border-[#FFD700] focus:ring-[#FFD700]/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="register-email"
                          className="text-gray-700 font-medium"
                        >
                          Email Address
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="register-email"
                            type="email"
                            data-testid="register-email-input"
                            placeholder="you@example.com"
                            value={registerData.email}
                            onChange={(e) =>
                              setRegisterData({
                                ...registerData,
                                email: e.target.value,
                              })
                            }
                            required
                            className="pl-10 h-11 rounded-lg border-gray-300 focus:border-[#FFD700] focus:ring-[#FFD700]/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="register-password"
                          className="text-gray-700 font-medium"
                        >
                          Password
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="register-password"
                            type={showRegisterPassword ? "text" : "password"}
                            data-testid="register-password-input"
                            placeholder="••••••••"
                            value={registerData.password}
                            onChange={(e) =>
                              setRegisterData({
                                ...registerData,
                                password: e.target.value,
                              })
                            }
                            required
                            className="pl-10 pr-10 h-11 rounded-lg border-gray-300 focus:border-[#FFD700] focus:ring-[#FFD700]/20"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowRegisterPassword(!showRegisterPassword)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            data-testid="toggle-register-password"
                          >
                            {showRegisterPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Use at least 8 characters with a mix of letters,
                          numbers & symbols
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      data-testid="register-submit-btn"
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-[#FFD700] to-yellow-400 hover:from-yellow-400 hover:to-[#FFD700] text-[#0B2B5C] font-manrope font-bold text-sm transition-all duration-300 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B2B5C] border-t-transparent"></div>
                          Creating Account...
                        </span>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>

                  <div className="mt-8">
                    <Separator className="my-6" />
                    <p className="text-center text-sm text-gray-500">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("login")}
                        className="text-[#0B2B5C] hover:text-[#0B2B5C]/80 font-medium transition-colors"
                      >
                        Sign in here
                      </button>
                    </p>
                  </div>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              By continuing, you agree to our{" "}
              <a
                href="#"
                className="text-[#0B2B5C] hover:underline font-medium"
              >
                Terms
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-[#0B2B5C] hover:underline font-medium"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-[#0B2B5C]" />
            </div>
            <DialogTitle className="text-xl text-center text-[#0B2B5C] font-manrope">
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Enter your email address and we'll send you a link to reset your
              password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label
                htmlFor="forgot-email"
                className="text-gray-700 font-medium"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 h-11 rounded-lg border-gray-300 focus:border-[#0B2B5C] focus:ring-[#0B2B5C]/20"
                  data-testid="forgot-email-input"
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotPasswordOpen(false)}
                className="h-11 rounded-lg border-gray-300 hover:bg-gray-50 flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-lg bg-gradient-to-r from-[#0B2B5C] to-[#1A3D7C] hover:from-[#1A3D7C] hover:to-[#0B2B5C] text-white flex-1"
                disabled={sendingReset}
                data-testid="send-reset-btn"
              >
                {sendingReset ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Sending...
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
