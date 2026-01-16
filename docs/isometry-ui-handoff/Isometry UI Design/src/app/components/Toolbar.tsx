import { useState } from 'react';
import { 
  FileText, 
  Save, 
  FolderOpen, 
  Download, 
  Grid3x3, 
  Menu,
  X,
  Layers,
  BarChart3
} from 'lucide-react';
import appIcon from 'figma:asset/e114b7afa529d3f027cf8b8f18c991be3962ece7.png';
import { useTheme } from '@/contexts/ThemeContext';

interface MenuItem {
  label: string;
  action?: () => void;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

export function Toolbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const menuSections: MenuSection[] = [
    {
      label: 'Isometry',
      items: [
        { label: 'About Isometry', action: () => console.log('About') },
        { separator: true },
        { 
          label: 'Settings',
          submenu: [
            { 
              label: 'Theme', 
              submenu: [
                { 
                  label: '✓ NeXTSTEP', 
                  action: () => {
                    setTheme('NeXTSTEP');
                    console.log('Theme: NeXTSTEP');
                  } 
                },
                { 
                  label: 'Modern', 
                  action: () => {
                    setTheme('Modern');
                    console.log('Theme: Modern');
                  } 
                },
              ]
            },
          ]
        },
        { separator: true },
        { label: 'Services', action: () => console.log('Services') },
        { separator: true },
        { label: 'Hide Isometry', action: () => console.log('Hide') },
        { label: 'Hide Others', action: () => console.log('Hide Others') },
        { label: 'Show All', action: () => console.log('Show All') },
        { separator: true },
        { label: 'Quit Isometry', action: () => console.log('Quit') },
      ]
    },
    {
      label: 'File',
      items: [
        { label: 'New…', action: () => console.log('New') },
        { label: 'New Card', action: () => console.log('New Card') },
        { label: 'Open…', action: () => console.log('Open') },
        { separator: true },
        { label: 'Save As…', action: () => console.log('Save As') },
        { separator: true },
        { label: 'Share…', action: () => console.log('Share') },
        { separator: true },
        { label: 'Print…', action: () => console.log('Print') },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', action: () => console.log('Undo') },
        { label: 'Redo', action: () => console.log('Redo') },
        { separator: true },
        { label: 'Cut', action: () => console.log('Cut') },
        { label: 'Copy', action: () => console.log('Copy') },
        { label: 'Paste', action: () => console.log('Paste') },
        { label: 'Paste Special…', action: () => console.log('Paste Special') },
        { separator: true },
        { label: 'Find…', action: () => console.log('Find') },
        { label: 'Select…', action: () => console.log('Select') },
        { separator: true },
        { label: 'Writing Tools…', action: () => console.log('Writing Tools') },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Workbench', action: () => console.log('Workbench') },
        { label: 'Apps', action: () => console.log('Apps') },
        { label: 'Datasets', action: () => console.log('Datasets') },
        { label: 'Views', action: () => console.log('Views') },
        { label: 'Filters', action: () => console.log('Filters') },
        { label: 'Formats', action: () => console.log('Formats') },
        { separator: true },
        { label: 'Zoom…', action: () => console.log('Zoom') },
      ]
    },
    {
      label: 'Format',
      items: [
        { label: 'View', action: () => console.log('Format View') },
        { label: 'Cell', action: () => console.log('Cell') },
        { label: 'Text', action: () => console.log('Text') },
        { label: 'Arrange', action: () => console.log('Arrange') },
      ]
    },
    {
      label: 'Window',
      items: [
        { label: 'New…', action: () => console.log('New Window') },
        { separator: true },
        { label: 'Minimize', action: () => console.log('Minimize') },
        { label: 'Zoom', action: () => console.log('Zoom Window') },
        { separator: true },
        { label: 'Bring All to Front', action: () => console.log('Bring All to Front') },
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Isometry Help', action: () => console.log('Help') },
      ]
    },
  ];

  const commandButtons = [
    { icon: FileText, label: 'New', action: () => console.log('New') },
    { icon: FolderOpen, label: 'Open', action: () => console.log('Open') },
    { icon: Save, label: 'Save', action: () => console.log('Save') },
    { icon: Download, label: 'Export', action: () => console.log('Export') },
  ];

  const appLauncherButtons = [
    { icon: Grid3x3, label: 'Grid View', action: () => console.log('Grid View') },
    { icon: Layers, label: 'Dimensions', action: () => console.log('Dimensions') },
    { icon: BarChart3, label: 'Charts', action: () => console.log('Charts') },
  ];

  const handleMenuClick = (menuLabel: string) => {
    setOpenMenu(openMenu === menuLabel ? null : menuLabel);
  };

  const handleMenuItemClick = (action?: () => void) => {
    if (action) action();
    setOpenMenu(null);
  };

  const handleSubmenuClick = (submenuLabel: string) => {
    setOpenSubmenu(openSubmenu === submenuLabel ? null : submenuLabel);
  };

  return (
    <div className="relative">
      {/* Menu Bar */}
      <div className={`h-7 flex items-center px-1 ${
        theme === 'NeXTSTEP' 
          ? 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_2px_2px_2px_rgba(255,255,255,0.7),inset_-2px_-2px_2px_rgba(0,0,0,0.3)]'
          : 'bg-white/80 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {/* App Icon */}
        <div className={`w-5 h-5 flex items-center justify-center mr-2 ml-1 ${
          theme === 'NeXTSTEP' 
            ? 'bg-[#000000] rounded-sm shadow-[1px_1px_2px_rgba(0,0,0,0.6)]'
            : 'rounded-md'
        }`}>
          <img src={appIcon} alt="App Icon" className="w-5 h-5" />
        </div>

        {/* Menu Items */}
        <div className="flex items-center gap-0">
          {menuSections.map((section) => (
            <div key={section.label} className="relative">
              <button
                onClick={() => handleMenuClick(section.label)}
                className={`px-3 py-0.5 transition-colors ${
                  theme === 'NeXTSTEP'
                    ? `hover:bg-[#000000] hover:text-white ${openMenu === section.label ? 'bg-[#000000] text-white' : ''}`
                    : `rounded-md hover:bg-gray-100 ${openMenu === section.label ? 'bg-gray-100' : ''}`
                }`}
              >
                {section.label}
              </button>

              {/* Dropdown Menu */}
              {openMenu === section.label && (
                <>
                  <div 
                    className="fixed inset-0 z-[100]" 
                    onClick={() => setOpenMenu(null)}
                  />
                  <div className={`absolute top-full left-0 mt-0 min-w-[200px] z-[110] ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[3px_3px_6px_rgba(0,0,0,0.5)]'
                      : 'bg-white/95 backdrop-blur-xl rounded-lg shadow-2xl border border-gray-200'
                  }`}>
                    <div className={theme === 'NeXTSTEP' ? 'border border-[#909090] m-1 py-1' : 'py-1'}>
                      {section.items.map((item, index) => (
                        item.separator ? (
                          <div key={`sep-${index}`} className={
                            theme === 'NeXTSTEP' 
                              ? 'h-[2px] bg-gradient-to-b from-[#606060] to-[#a0a0a0] mx-2 my-1'
                              : 'h-px bg-gray-200 mx-2 my-1'
                          } />
                        ) : item.submenu ? (
                          <div key={index} className="relative">
                            <button
                              onMouseEnter={() => handleSubmenuClick(`${section.label}-${item.label}`)}
                              className={`w-full px-4 py-1.5 text-left transition-colors text-sm flex items-center justify-between ${
                                theme === 'NeXTSTEP'
                                  ? 'hover:bg-[#000000] hover:text-white'
                                  : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                              }`}
                            >
                              {item.label}
                              <span className="ml-2">▶</span>
                            </button>
                            {/* Submenu */}
                            {openSubmenu === `${section.label}-${item.label}` && (
                              <div className={`absolute left-full top-0 ml-[-4px] min-w-[180px] z-30 ${
                                theme === 'NeXTSTEP'
                                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[3px_3px_6px_rgba(0,0,0,0.5)]'
                                  : 'bg-white/95 backdrop-blur-xl rounded-lg shadow-2xl border border-gray-200'
                              }`}>
                                <div className={theme === 'NeXTSTEP' ? 'border border-[#909090] m-1 py-1' : 'py-1'}>
                                  {item.submenu.map((subitem, subindex) => (
                                    subitem.separator ? (
                                      <div key={`subsep-${subindex}`} className={
                                        theme === 'NeXTSTEP' 
                                          ? 'h-[2px] bg-gradient-to-b from-[#606060] to-[#a0a0a0] mx-2 my-1'
                                          : 'h-px bg-gray-200 mx-2 my-1'
                                      } />
                                    ) : subitem.submenu ? (
                                      <div key={subindex} className="relative">
                                        <button
                                          onMouseEnter={() => handleSubmenuClick(`${section.label}-${item.label}-${subitem.label}`)}
                                          className={`w-full px-4 py-1.5 text-left transition-colors text-sm flex items-center justify-between ${
                                            theme === 'NeXTSTEP'
                                              ? 'hover:bg-[#000000] hover:text-white'
                                              : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                                          }`}
                                        >
                                          {subitem.label}
                                          <span className="ml-2">▶</span>
                                        </button>
                                        {/* Second Level Submenu */}
                                        {openSubmenu === `${section.label}-${item.label}-${subitem.label}` && (
                                          <div className={`absolute left-full top-0 ml-[-4px] min-w-[160px] z-40 ${
                                            theme === 'NeXTSTEP'
                                              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[3px_3px_6px_rgba(0,0,0,0.5)]'
                                              : 'bg-white/95 backdrop-blur-xl rounded-lg shadow-2xl border border-gray-200'
                                          }`}>
                                            <div className={theme === 'NeXTSTEP' ? 'border border-[#909090] m-1 py-1' : 'py-1'}>
                                              {subitem.submenu.map((subsubitem, subsubindex) => (
                                                <button
                                                  key={subsubindex}
                                                  onClick={() => handleMenuItemClick(subsubitem.action)}
                                                  className={`w-full px-4 py-1.5 text-left transition-colors text-sm ${
                                                    theme === 'NeXTSTEP'
                                                      ? 'hover:bg-[#000000] hover:text-white'
                                                      : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                                                  }`}
                                                >
                                                  {theme === 'NeXTSTEP' && subsubitem.label.includes('NeXTSTEP') ? '✓ ' : ''}
                                                  {theme === 'Modern' && subsubitem.label.includes('Modern') ? '✓ ' : ''}
                                                  {subsubitem.label.replace('✓ ', '')}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        key={subindex}
                                        onClick={() => handleMenuItemClick(subitem.action)}
                                        className={`w-full px-4 py-1.5 text-left transition-colors text-sm ${
                                          theme === 'NeXTSTEP'
                                            ? 'hover:bg-[#000000] hover:text-white'
                                            : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                                        }`}
                                      >
                                        {subitem.label}
                                      </button>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            key={index}
                            onClick={() => handleMenuItemClick(item.action)}
                            className={`w-full px-4 py-1.5 text-left transition-colors text-sm ${
                              theme === 'NeXTSTEP'
                                ? 'hover:bg-[#000000] hover:text-white'
                                : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                            }`}
                          >
                            {item.label}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme Toggle Buttons */}
        <div className={`flex items-center gap-1 mr-1 ${
          theme === 'NeXTSTEP' ? '' : 'gap-2'
        }`}>
          <button
            onClick={() => setTheme('NeXTSTEP')}
            className={`px-3 py-0.5 text-xs transition-all ${
              theme === 'NeXTSTEP'
                ? theme === 'NeXTSTEP'
                  ? 'bg-[#000000] text-white border-t-2 border-l-2 border-[#505050] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)]'
                  : 'bg-blue-500 text-white rounded-md px-3 py-1'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_2px_rgba(0,0,0,0.3)] hover:bg-[#d8d8d8]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1'
            }`}
            title="Switch to NeXTSTEP theme"
          >
            NeXTSTEP
          </button>
          <button
            onClick={() => setTheme('Modern')}
            className={`px-3 py-0.5 text-xs transition-all ${
              theme === 'Modern'
                ? theme === 'NeXTSTEP'
                  ? 'bg-[#000000] text-white border-t-2 border-l-2 border-[#505050] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)]'
                  : 'bg-blue-500 text-white rounded-md px-3 py-1'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_2px_rgba(0,0,0,0.3)] hover:bg-[#d8d8d8]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1'
            }`}
            title="Switch to macOS 26 theme"
          >
            macOS 26
          </button>
        </div>
      </div>

      {/* Toolbar Container */}
      <div className={`h-12 flex items-center px-2 gap-1 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.7),inset_-2px_-2px_3px_rgba(0,0,0,0.3)]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {/* Command Buttons */}
        <div className="flex items-center gap-1">
          {commandButtons.map((button, index) => (
            <button
              key={index}
              onClick={button.action}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'rounded-lg hover:bg-gray-100 active:bg-gray-200'
              }`}
              aria-label={button.label}
              title={button.label}
            >
              <button.icon className={`w-5 h-5 ${theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'}`} />
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className={theme === 'NeXTSTEP' 
          ? 'w-[3px] h-8 bg-gradient-to-r from-[#606060] via-[#808080] to-[#a0a0a0] mx-1 shadow-[1px_0_1px_rgba(255,255,255,0.5),-1px_0_1px_rgba(0,0,0,0.3)]'
          : 'w-px h-8 bg-gray-300 mx-2'
        } />

        {/* App Launcher Buttons */}
        <div className="flex items-center gap-1">
          {appLauncherButtons.map((button, index) => (
            <button
              key={index}
              onClick={button.action}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'rounded-lg hover:bg-gray-100 active:bg-gray-200'
              }`}
              aria-label={button.label}
              title={button.label}
            >
              <button.icon className={`w-5 h-5 ${theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'}`} />
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>
    </div>
  );
}