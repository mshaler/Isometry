import { useTheme } from '../../contexts/ThemeContext';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();
  
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Icon className={`w-12 h-12 mb-4 ${
        theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'
      }`} />
      <p className={`text-lg font-medium mb-1 ${
        theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
      }`}>{title}</p>
      {description && (
        <p className={`text-sm mb-4 ${
          theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
        }`}>{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className={`px-4 py-2 text-sm ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-blue-500 text-white rounded-lg hover:bg-blue-600'
        }`}>{action.label}</button>
      )}
    </div>
  );
}
