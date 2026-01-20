import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  LogOut,
  Settings as SettingsIcon,
  User,
  Shield,
  BarChart3,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [companySettings, setCompanySettings] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const isAdmin = user.role === "admin";

  useEffect(() => {
    // Only load company settings for non-admin users
    if (!isAdmin) {
      loadCompanySettings();
    }
    loadUserProfile();
  }, [isAdmin]);

  const loadCompanySettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/settings/company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data && response.data.company_name) {
        setCompanySettings(response.data);
      }
    } catch (error) {
      // Settings not configured yet
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserProfile(response.data);
    } catch (error) {
      // Profile load failed
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation - Enhanced Design */}
      <nav
        className="bg-gradient-to-r from-[#0B2B5C] via-[#164E8C] to-[#0B2B5C] text-white shadow-2xl border-b-4 border-[#FFD700]"
        data-testid="main-navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-8">
              {/* Company Logo and Name */}
              <div className="gap-3" data-testid="app-logo">
                {!isAdmin && companySettings?.company_logo ? (
                  <img
                    src={companySettings.company_logo}
                    alt={companySettings.company_name}
                    className="h-10 object-contain"
                    style={{ imageRendering: "crisp-edges" }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white/20">
                    <span className="text-2xl font-bold text-[#0B2B5C]">
                      {isAdmin
                        ? "A"
                        : companySettings?.company_name?.charAt(0) || "S"}
                    </span>
                  </div>
                )}
              </div>

              <div className="hidden md:flex gap-1 ml-4 rounded-xl backdrop-blur-sm">
                {/* Admin Navigation - Only Admin Panel and Reports */}
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => navigate("/admin")}
                      data-testid="nav-admin-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                        location.pathname === "/admin"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <Shield size={18} />
                      User Management
                    </button>
                    <button
                      onClick={() => navigate("/admin/reports")}
                      data-testid="nav-admin-reports-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                        location.pathname === "/admin/reports"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <BarChart3 size={18} />
                      All Invoices
                    </button>
                  </>
                ) : (
                  /* Regular User Navigation - Settings moved to last */
                  <>
                    <button
                      onClick={() => navigate("/")}
                      data-testid="nav-dashboard-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <Home size={18} />
                      Dashboard
                    </button>
                    <button
                      onClick={() => navigate("/invoices")}
                      data-testid="nav-invoices-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/invoices"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <FileText size={18} />
                      Invoices
                    </button>
                    <button
                      onClick={() => navigate("/manual-entry")}
                      data-testid="nav-manual-entry-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/manual-entry"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <PlusCircle size={18} />
                      Entry
                    </button>
                    <button
                      onClick={() => navigate("/reports")}
                      data-testid="nav-reports-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/reports"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <BarChart3 size={18} />
                      Reports
                    </button>
                    <button
                      onClick={() => navigate("/bank-reconciliation")}
                      data-testid="nav-bank-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/bank-reconciliation"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <CreditCard size={18} />
                      Bank Recon
                    </button>
                    <button
                      onClick={() => navigate("/settings")}
                      data-testid="nav-settings-btn"
                      className={`flex items-center gap-2 px-4 py-2 text-nowrap rounded-lg text-xs font-medium transition-all duration-300 ${
                        location.pathname === "/settings"
                          ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0B2B5C] shadow-lg transform scale-105"
                          : "text-white/80 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      <SettingsIcon size={18} />
                      Settings
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-right mr-2 hover:bg-white/10 p-2 rounded-lg transition-all border border-white/10">
                    <div>
                      <div
                        className="text-sm font-medium text-white"
                        data-testid="user-name-display"
                      >
                        {user.name}
                      </div>
                      <div className="text-[10px] text-white/60">
                        {user.email}
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center shadow-md">
                      <User size={16} className="text-[#0B2B5C]" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    data-testid="profile-menu-item"
                  >
                    <User size={16} className="mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <SettingsIcon size={16} className="mr-2" />
                      Company Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                data-testid="logout-btn"
                className="border-white/30 bg-white/10 text-white hover:bg-red-500/80 hover:text-white hover:border-red-500 transition-all duration-300"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-10">
        {children}
      </main>

      <div className="w-full border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-4 fixed bottom-0">
        <div className="mx-auto flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Copyright */}
          <div className="text-center md:text-left">
            <p className="text-xs font-medium text-gray-600">
              © 2026 <span className="text-[#0B2B5C]">SMART ITBOX</span>. All
              rights reserved.
            </p>
          </div>

          {/* Center - Branding */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Designed with ❤️ and crafted with care by Team{" "}
              <a
                className="font-bold text-yellow-500"
                href="https://smartitbox.in"
              >
                SMART ITBOX
              </a>{" "}
              Your Business Automation Partner
            </p>
          </div>
        </div>

        {/* Mobile Bottom Links */}
        <div className="mt-4 flex justify-center gap-4 md:hidden">
          <a
            href="https://smartitbox.in/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-[#0B2B5C] transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-gray-300">•</span>
          <a
            href="https://smartitbox.in/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-[#0B2B5C] transition-colors"
          >
            Terms of Service
          </a>
          <span className="text-gray-300">•</span>
          <a
            href="https://smartitbox.in/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-[#0B2B5C] transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
