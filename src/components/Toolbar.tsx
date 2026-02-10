import { useState } from 'react';
import { FileText, Save, FolderOpen, Download, LayoutGrid, Layers, BarChart3, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { IconButton } from '@/components/ui/buttons/IconButton';
import { ImportWizard } from './ImportWizard';

interface MenuItem {
  label?: string;
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
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  // TODO: Implement submenus when needed
  const { theme, setTheme } = useTheme();

  const menuSections: MenuSection[] = [
    {
      label: 'Isometry',
      items: [
        { label: 'About Isometry', action: () => console.warn('About') },
        { separator: true },
        { 
          label: 'Settings',
          submenu: [
            { 
              label: 'Theme', 
              submenu: [
                { label: 'NeXTSTEP', action: () => setTheme('NeXTSTEP') },
                { label: 'Modern', action: () => setTheme('Modern') },
              ]
            },
          ]
        },
        { separator: true },
        { label: 'Quit Isometry', action: () => console.warn('Quit') },
      ]
    },
    {
      label: 'File',
      items: [
        { label: 'New…', action: () => console.warn('New') },
        { label: 'Open…', action: () => console.warn('Open') },
        { separator: true },
        { label: 'Import JSON…', action: () => setImportWizardOpen(true) },
        { label: 'Import Markdown…', action: () => setImportWizardOpen(true) },
        { label: 'Import Office Docs…', action: () => setImportWizardOpen(true) },
        { label: 'Import Web Page…', action: () => setImportWizardOpen(true) },
        { separator: true },
        { label: 'Save As…', action: () => console.warn('Save As') },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', action: () => console.warn('Undo') },
        { label: 'Redo', action: () => console.warn('Redo') },
        { separator: true },
        { label: 'Cut', action: () => console.warn('Cut') },
        { label: 'Copy', action: () => console.warn('Copy') },
        { label: 'Paste', action: () => console.warn('Paste') },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Workbench', action: () => console.warn('Workbench') },
        { label: 'Apps', action: () => console.warn('Apps') },
        { label: 'Datasets', action: () => console.warn('Datasets') },
      ]
    },
  ];

  const commandButtons: { icon: LucideIcon; label: string; action: () => void }[] = [
    { icon: FileText, label: 'New', action: () => console.warn('New') },
    { icon: FolderOpen, label: 'Open', action: () => console.warn('Open') },
    { icon: Save, label: 'Save', action: () => console.warn('Save') },
    { icon: Download, label: 'Export', action: () => console.warn('Export') },
  ];

  const appLauncherButtons: { icon: LucideIcon; label: string; action: () => void }[] = [
    { icon: LayoutGrid, label: 'Grid View', action: () => console.warn('Grid View') },
    { icon: Layers, label: 'Dimensions', action: () => console.warn('Dimensions') },
    { icon: BarChart3, label: 'Charts', action: () => console.warn('Charts') },
  ];

  return (
    <div className="relative">
      {/* Menu Bar */}
      <div className={`h-7 flex items-center px-1 ${
        theme === 'NeXTSTEP' 
          ? 'bg-[#c0c0c0] border-b-2 border-[#505050]'
          : 'bg-white/80 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {/* Menu Items */}
        <div className="flex items-center">
          {menuSections.map((section) => (
            <div key={section.label} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === section.label ? null : section.label)}
                className={`px-3 py-0.5 text-sm ${
                  theme === 'NeXTSTEP'
                    ? openMenu === section.label ? 'bg-black text-white' : 'hover:bg-[#a0a0a0]'
                    : openMenu === section.label ? 'bg-blue-500 text-white rounded' : 'hover:bg-gray-100 rounded'
                }`}
              >
                {section.label}
              </button>
              {openMenu === section.label && (
                <div className={`absolute top-full left-0 mt-0 min-w-[160px] z-50 ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border-2 border-black shadow-lg'
                    : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
                }`}>
                  {section.items.map((item, index) => (
                    item.separator ? (
                      <div key={index} className={`my-1 ${theme === 'NeXTSTEP' ? 'border-t border-gray-500' : 'border-t border-gray-200'}`} />
                    ) : (
                      <button
                        key={index}
                        onClick={() => { item.action?.(); setOpenMenu(null); }}
                        className={`w-full px-4 py-1.5 text-left text-sm ${
                          theme === 'NeXTSTEP'
                            ? 'hover:bg-black hover:text-white'
                            : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Theme Toggle */}
        <div className="flex items-center gap-1 mr-1">
          <button
            onClick={() => setTheme('NeXTSTEP')}
            className={`px-3 py-0.5 text-xs ${
              theme === 'NeXTSTEP' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
          >NeXTSTEP</button>
          <button
            onClick={() => setTheme('Modern')}
            className={`px-3 py-0.5 text-xs ${
              theme === 'Modern' ? 'bg-blue-500 text-white rounded' : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
          >Modern</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`h-12 flex items-center px-2 gap-1 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-b-2 border-[#505050]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {commandButtons.map((button, index) => (
          <IconButton
            key={index}
            icon={<button.icon className="w-5 h-5" />}
            label={button.label}
            onClick={button.action}
            variant="ghost"
            className="w-10 h-10"
          />
        ))}

        <div className={theme === 'NeXTSTEP' ? 'w-[3px] h-8 bg-[#808080] mx-1' : 'w-px h-8 bg-gray-300 mx-2'} />

        {appLauncherButtons.map((button, index) => (
          <IconButton
            key={index}
            icon={<button.icon className="w-5 h-5" />}
            label={button.label}
            onClick={button.action}
            variant="ghost"
            className="w-10 h-10"
          />
        ))}

        <div className="flex-1" />
      </div>

      {/* Import Wizard Modal */}
      <ImportWizard
        isOpen={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImportComplete={(nodes) => {
          console.warn('Import completed:', { count: nodes.length, nodes });
          // TODO: Integrate with database context to persist imported nodes
          setImportWizardOpen(false);
        }}
      />
    </div>
  );
}
