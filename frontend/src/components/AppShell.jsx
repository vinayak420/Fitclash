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
    <div className="fc-app-shell">
      <div className={`fc-app-frame ${showTabs ? 'has-tabs' : ''}`}>
        <main className="fc-app-main">
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
