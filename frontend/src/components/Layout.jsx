import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation */}
      <nav className="bg-[#0B2B5C] text-white shadow-lg" data-testid="main-navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="font-manrope font-bold text-xl tracking-tight" data-testid="app-logo">
                <span className="text-white">SMART</span>
                <span className="text-[#FFD700]"> ITBOX</span>
              </div>
              <div className="hidden md:flex gap-4">
                <button
                  onClick={() => navigate('/')}
                  data-testid="nav-dashboard-btn"
                  className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors duration-200 ${
                    location.pathname === '/' ? 'bg-white/10 text-[#FFD700]' : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Home size={18} />
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/invoices')}
                  data-testid="nav-invoices-btn"
                  className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors duration-200 ${
                    location.pathname === '/invoices' ? 'bg-white/10 text-[#FFD700]' : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FileText size={18} />
                  All Invoices
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/80" data-testid="user-name-display">{user.name}</span>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                data-testid="logout-btn"
                className="border-white/20 text-white hover:bg-white/10 hover:text-white"
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