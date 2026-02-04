import { useState } from 'react';
import { Search, Settings, Menu, Bell, User, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppState } from '../../contexts/AppStateContext';
import { useLocation, Link } from 'react-router-dom';

interface HeaderBarProps {
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
  current?: boolean;
}

export function HeaderBar({ onSidebarToggle, sidebarCollapsed = false }: HeaderBarProps) {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => {
    setTheme(theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP');
  };
  const { activeApp, activeView, activeDataset } = useAppState();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  // Generate breadcrumbs based on current context and route
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Isometry', path: '/' }
    ];

    // Add app-level breadcrumb
    if (activeApp && activeApp !== 'Demo') {
      breadcrumbs.push({ label: activeApp, path: `/${activeApp.toLowerCase()}` });
    }

    // Add route-specific breadcrumbs
    const pathname = location.pathname;
    if (pathname.includes('/notebook')) {
      breadcrumbs.push({ label: 'Notebook', path: '/notebook' });
    } else if (pathname.includes('/supergrid')) {
      breadcrumbs.push({ label: 'SuperGrid', path: '/supergrid' });
    } else if (pathname.includes('/canvas')) {
      breadcrumbs.push({ label: 'Canvas', path: '/canvas' });
    }

    // Add view and dataset context if available
    if (activeView && activeView !== 'List') {
      breadcrumbs.push({ label: activeView });
    }

    if (activeDataset && activeDataset !== 'ETL') {
      breadcrumbs.push({ label: activeDataset, current: true });
    }

    // Mark the last item as current if no dataset
    if (breadcrumbs.length > 0 && !breadcrumbs[breadcrumbs.length - 1]?.current) {
      breadcrumbs[breadcrumbs.length - 1]!.current = true;
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement global search functionality
    console.log('Search query:', searchQuery);
  };

  const headerStyle = theme === 'NeXTSTEP'
    ? 'bg-[#b8b8b8] border-b-2 border-[#505050] shadow-none'
    : 'bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm';

  const buttonStyle = theme === 'NeXTSTEP'
    ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#c8c8c8]'
    : 'bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200';

  const searchStyle = theme === 'NeXTSTEP'
    ? 'bg-white border-2 border-[#808080] border-b-[#ffffff] border-r-[#ffffff]'
    : 'bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <header className={`h-14 flex items-center justify-between px-4 ${headerStyle}`}>
      {/* Left Section: Menu toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className={`h-8 w-8 flex items-center justify-center ${buttonStyle}`}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Breadcrumb Navigation */}
        <nav className="flex items-center">
          <ol className="flex items-center space-x-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-3 h-3 mx-2 text-gray-400" />
                )}
                {crumb.path && !crumb.current ? (
                  <Link
                    to={crumb.path}
                    className={`${
                      theme === 'NeXTSTEP'
                        ? 'text-[#404040] hover:text-black hover:underline'
                        : 'text-gray-600 hover:text-gray-900 hover:underline'
                    } transition-colors`}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`${
                      crumb.current
                        ? theme === 'NeXTSTEP'
                          ? 'text-black font-medium'
                          : 'text-gray-900 font-medium'
                        : theme === 'NeXTSTEP'
                          ? 'text-[#404040]'
                          : 'text-gray-600'
                    }`}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Center Section: Global Search */}
      <div className="flex-1 max-w-md mx-4">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nodes, content, or graphs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 text-sm ${searchStyle} transition-all focus:outline-none`}
            />
          </div>
        </form>
      </div>

      {/* Right Section: Actions + Profile */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`h-8 w-8 flex items-center justify-center ${buttonStyle}`}
          title={`Switch to ${theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP'} theme`}
        >
          <div className={`w-3 h-3 rounded ${
            theme === 'NeXTSTEP' ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-400 to-purple-500'
          }`} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`h-8 w-8 flex items-center justify-center ${buttonStyle} relative`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          {/* Notification dropdown (placeholder) */}
          {showNotifications && (
            <div className={`absolute right-0 top-10 w-80 z-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#c0c0c0] border-2 border-[#808080] shadow-md'
                : 'bg-white border border-gray-200 rounded-lg shadow-lg'
            }`}>
              <div className="p-3">
                <h3 className="font-medium mb-2">Notifications</h3>
                <p className="text-sm text-gray-500">No new notifications</p>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          className={`h-8 w-8 flex items-center justify-center ${buttonStyle}`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile */}
        <button
          className={`h-8 w-8 flex items-center justify-center ${buttonStyle}`}
          title="User profile"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Click outside handler for notifications */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </header>
  );
}