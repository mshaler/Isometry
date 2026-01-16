import { Toolbar } from "@/app/components/Toolbar";
import { CommandBar } from "@/app/components/CommandBar";
import { Sidebar } from "@/app/components/Sidebar";
import { RightSidebar } from "@/app/components/RightSidebar";
import { Navigator } from "@/app/components/Navigator";
import { Canvas } from "@/app/components/Canvas";
import { NavigatorFooter } from "@/app/components/NavigatorFooter";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <div className={`size-full flex flex-col ${
      theme === 'NeXTSTEP' ? 'bg-[#a0a0a0]' : 'bg-[#ececec]'
    }`}>
      <Toolbar />
      <CommandBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navigator />
          <Canvas />
          <NavigatorFooter />
        </div>
        <RightSidebar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}