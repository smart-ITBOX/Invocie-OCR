import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, LogOut, Settings as SettingsIcon, User, Shield, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [companySettings, setCompanySettings] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    // Only load company settings for non-admin users
    if (!isAdmin) {
      loadCompanySettings();
    }
    loadUserProfile();
  }, [isAdmin]);

  const loadCompanySettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/settings/company`, {
        headers: { Authorization: `Bearer ${token}` }
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
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(response.data);
    } catch (error) {
      // Profile load failed
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation */}
      <nav className="bg-gradient-to-r from-[#0B2B5C] to-[#164E8C] text-white shadow-xl border-b-2 border-[#FFD700]" data-testid="main-navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-8">
              {/* Company Logo and Name */}
              <div className="flex items-center gap-3" data-testid="app-logo">
                {!isAdmin && companySettings?.company_logo ? (
                  <div className="w-16 h-16 rounded-md p-2 flex items-center justify-center shadow-xl" style={{ background: 'rgba(255, 255, 255, 0.98)' }}>
                    <img 
                      src={companySettings.company_logo} 
                      alt={companySettings.company_name} 
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-[#FFD700] rounded-md flex items-center justify-center shadow-xl">
                    <span className="text-3xl font-bold text-[#0B2B5C]">
                      {isAdmin ? 'A' : (companySettings?.company_name?.charAt(0) || 'S')}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-manrope font-bold text-xl tracking-tight leading-tight">
                    {isAdmin ? (
                      <>
                        <span className="text-white">SMART</span>
                        <span className="text-[#FFD700]"> ITBOX</span>
                      </>
                    ) : (
                      companySettings?.company_name || (
                        <>
                          <span className="text-white">SMART</span>
                          <span className="text-[#FFD700]"> ITBOX</span>
                        </>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="bg-[#FFD700] text-[#0B2B5C] text-xs font-semibold px-2 py-0.5 hover:bg-[#FFD700]">
                      {isAdmin ? 'Admin Panel' : 'Invoice Manager'}
                    </Badge>
                    {!isAdmin && companySettings?.company_gst_no && (
                      <span className="text-[10px] text-white/70 font-mono">
                        GST: {companySettings.company_gst_no.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="hidden md:flex gap-2 ml-4">
                {/* Admin Navigation - Only Admin Panel and Reports */}
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => navigate('/admin')}
                      data-testid="nav-admin-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/admin' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Shield size={18} />
                      User Management
                    </button>
                    <button
                      onClick={() => navigate('/admin/reports')}
                      data-testid="nav-admin-reports-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/admin/reports' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <BarChart3 size={18} />
                      All Invoices
                    </button>
                  </>
                ) : (
                  /* Regular User Navigation */
                  <>
                    <button
                      onClick={() => navigate('/')}
                      data-testid="nav-dashboard-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Home size={18} />
                      Dashboard
                    </button>
                    <button
                      onClick={() => navigate('/invoices')}
                      data-testid="nav-invoices-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/invoices' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <FileText size={18} />
                      All Invoices
                    </button>
                    <button
                      onClick={() => navigate('/settings')}
                      data-testid="nav-settings-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/settings' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <SettingsIcon size={18} />
                      Settings
                    </button>
                    <button
                      onClick={() => navigate('/reports')}
                      data-testid="nav-reports-btn"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-200 ${
                        location.pathname === '/reports' 
                          ? 'bg-white/15 text-[#FFD700] shadow-md' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <BarChart3 size={18} />
                      Reports
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-right mr-2 hover:bg-white/10 p-2 rounded-sm transition-all">
                    <div>
                      <div className="text-sm font-medium text-white" data-testid="user-name-display">{user.name}</div>
                      <div className="text-[10px] text-white/60">{user.email}</div>
                    </div>
                    <User size={16} className="text-white/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="profile-menu-item">
                    <User size={16} className="mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <SettingsIcon size={16} className="mr-2" />
                      Company Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white hover:border-white/50"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}