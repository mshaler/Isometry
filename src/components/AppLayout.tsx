import { Toolbar } from './Toolbar';
import { Navigator } from './Navigator';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { RightSidebar } from './RightSidebar';
import { NavigatorFooter } from './NavigatorFooter';
import { CommandBar } from './CommandBar';
import { useTheme } from '@/contexts/ThemeContext';

export function AppLayout() {
  const { theme } = useTheme();

  return (
    <div className={`h-screen flex flex-col ${
      theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-100'
    }`}>
      {/* Top section: Toolbar + Navigator (includes PAFVNavigator) */}
      <Toolbar />
      <Navigator />

      {/* Middle section: Sidebar + Canvas + RightSidebar */}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <Canvas />
        <RightSidebar />
      </div>

      {/* Bottom section: NavigatorFooter + CommandBar */}
      <NavigatorFooter />
      <CommandBar />
    </div>
  );
}
