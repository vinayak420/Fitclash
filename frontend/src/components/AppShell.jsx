import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { User, UserPlus, Users } from 'lucide-react';

const TABS = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/create', label: 'Create Community', icon: UserPlus },
  { to: '/communities', label: 'Your Communities', icon: Users },
];

export default function AppShell() {
  const { pathname } = useLocation();
  const showTabs = TABS.some((t) => t.to === pathname);

  return (
    <div className="min-h-full" style={{ background: 'var(--ink)' }}>
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col">
        <main className={`flex-1 px-4 pt-5 ${showTabs ? 'pb-24' : 'pb-8'}`}>
          <Outlet />
        </main>
        {showTabs && (
          <nav className="fc-tab-bar" aria-label="Main">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end
                  className={({ isActive }) => `fc-bottom-tab fc-focus ${isActive ? 'active' : ''}`}
                >
                  <Icon size={22} />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
