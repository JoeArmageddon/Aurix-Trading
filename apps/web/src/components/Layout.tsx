'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Bell,
  FolderOpen,
  FileText,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AIAssistant } from './AIAssistant';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: FolderOpen },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Reports', href: '/reports', icon: FileText },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Safely get user initials
  const getUserInitial = (): string => {
    const email = user?.email;
    if (!email || typeof email !== 'string' || email.length === 0) {
      return '?';
    }
    return email[0].toUpperCase();
  };

  // Safely get display email
  const getDisplayEmail = (): string => {
    return user?.email || 'Guest';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <span className="text-xl font-bold text-white">Aurix</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="text-white" /> : <Menu className="text-white" />}
          </Button>
        </div>

        {sidebarOpen && (
          <div className="absolute z-50 w-full bg-surface border-b border-border">
            <nav className="p-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    pathname === item.href
                      ? 'bg-accent/20 text-accent'
                      : 'text-gray-400 hover:bg-surface-light hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
              <button
                onClick={logout}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-surface-light hover:text-white w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-surface">
          <div className="flex items-center h-16 px-6 border-b border-border">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
                <span className="text-white font-bold">A</span>
              </div>
              <span className="text-xl font-bold text-white">Aurix</span>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                  pathname === item.href
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-400 hover:bg-surface-light hover:text-white'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-surface-light rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {getUserInitial()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white truncate max-w-[120px]">
                    {getDisplayEmail()}
                  </span>
                  <span className={cn(
                    'text-xs',
                    user?.plan === 'pro' ? 'text-accent' : 'text-gray-400'
                  )}>
                    {user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={logout}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:ml-64">
          <main className="p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>

      {/* AI Assistant */}
      {isAuthenticated && <AIAssistant />}
    </div>
  );
}
