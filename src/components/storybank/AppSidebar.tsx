'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  LayoutDashboard,
  Upload,
  BookMarked,
  Sparkles,
  Target,
  GitBranch,
  MessageCircle,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_SECTIONS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Upload', href: '/upload', icon: Upload },
    ],
  },
  {
    label: 'Library',
    items: [
      { label: 'Example Bank', href: '/examples', icon: BookMarked },
      { label: 'Mirror', href: '/mirror', icon: Sparkles },
      { label: 'Job Match', href: '/match', icon: Target },
    ],
  },
  {
    label: 'Track',
    items: [
      { label: 'Consistency', href: '/consistency', icon: GitBranch },
    ],
  },
  {
    label: 'Prepare',
    items: [
      { label: 'Practice', href: '/practice', icon: MessageCircle },
    ],
  },
];

interface AppSidebarProps {
  userEmail: string;
  userName: string;
  signOutAction: () => Promise<void>;
}

export function AppSidebar({ userEmail, userName, signOutAction }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Initials for the avatar — first letter of name or email
  const initials = (userName || userEmail).charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-50 p-2 rounded-md lg:hidden"
        style={{ background: 'var(--sidebar)', color: 'var(--mist)' }}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        id="sidebar"
        aria-label="Main navigation"
        className={[
          'fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{
          background: '#0e1520',
          borderRight: '1px solid var(--sidebar-border)',
          width: collapsed ? '48px' : '220px',
        }}
      >
        {/* Mobile close button */}
        <button
          className="absolute top-3 right-3 p-1 rounded lg:hidden"
          style={{ color: 'var(--sage)' }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        {/* Wordmark */}
        <div
          className="flex items-center gap-2 px-3 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <span style={{ color: 'var(--amber)', fontSize: '12px', flexShrink: 0 }}>◆</span>
          {!collapsed && (
            <span
              className="font-heading font-semibold text-sm tracking-tight select-none truncate"
              style={{ color: 'var(--mist)' }}
            >
              StoryBank
            </span>
          )}
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <>
                  <p
                    className="px-3 pt-4 pb-1 text-xs uppercase tracking-widest select-none"
                    style={{ color: 'var(--sage)' }}
                  >
                    {section.label}
                  </p>
                  <div
                    className="mx-3 mb-1"
                    style={{ height: '1px', background: 'var(--sidebar-border)' }}
                  />
                </>
              )}
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 mx-1 my-0.5 rounded-md transition-colors duration-100"
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      background: isActive ? 'var(--amber-glow)' : 'transparent',
                      borderLeft: isActive
                        ? '2px solid var(--amber)'
                        : '2px solid transparent',
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={18}
                      strokeWidth={1.5}
                      style={{
                        color: isActive ? 'var(--amber)' : 'var(--sage)',
                        flexShrink: 0,
                      }}
                    />
                    {!collapsed && (
                      <span
                        className="text-sm truncate"
                        style={{
                          color: 'var(--mist)',
                          opacity: isActive ? 1 : 0.85,
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom: user + settings + collapse */}
        <div
          className="shrink-0 px-1 py-2 flex flex-col gap-1"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          <Link
            href="/settings"
            className="flex items-center gap-3 mx-1 rounded-md transition-colors duration-100"
            style={{ height: '40px', padding: '0 12px' }}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings2
              size={18}
              strokeWidth={1.5}
              style={{ color: 'var(--sage)', flexShrink: 0 }}
            />
            {!collapsed && (
              <span className="text-sm" style={{ color: 'var(--mist)', opacity: 0.85 }}>
                Settings
              </span>
            )}
          </Link>

          {/* User row with sign-out */}
          <div
            className="flex items-center gap-3 mx-1 rounded-md"
            style={{ height: '40px', padding: '0 12px' }}
          >
            {/* Avatar — initials circle */}
            <div
              className="flex items-center justify-center rounded-full shrink-0 text-xs font-semibold select-none"
              style={{
                width: '28px',
                height: '28px',
                background: 'var(--tay)',
                border: '1px solid var(--sidebar-border)',
                color: 'var(--amber)',
              }}
              title={userEmail}
            >
              {initials}
            </div>
            {!collapsed && (
              <form action={signOutAction} className="flex-1 min-w-0">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-sm truncate w-full text-left"
                  style={{ color: 'var(--sage)' }}
                  title={`Sign out (${userEmail})`}
                >
                  <span className="truncate">{userEmail || 'Sign out'}</span>
                  <LogOut size={13} strokeWidth={1.5} className="shrink-0" />
                </button>
              </form>
            )}
          </div>

          {/* Collapse toggle — desktop only */}
          <button
            className="hidden lg:flex items-center justify-center mx-1 rounded-md transition-colors duration-100"
            style={{ height: '32px', color: 'var(--sage)', minWidth: '32px' }}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls="sidebar"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={16} strokeWidth={1.5} />
            ) : (
              <ChevronLeft size={16} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      {/* Spacer that pushes main content right on desktop */}
      <div
        className="hidden lg:block shrink-0 transition-all duration-200"
        style={{ width: collapsed ? '48px' : '220px' }}
        aria-hidden="true"
      />
    </>
  );
}
