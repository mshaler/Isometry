import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function CommandBar() {
  const [commandText, setCommandText] = useState('');
  const { theme } = useTheme();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to DSL parser
    console.log('Command submitted:', commandText);
    setCommandText('');
  };

  return (
    <div className={`h-10 flex items-center px-3 gap-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#e8e8e8]'
        : 'bg-white/50 backdrop-blur-xl border-t border-gray-200'
    }`}>
      <button
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        title="Command"
      >
        <span className="text-lg leading-none">⌘</span>
      </button>

      <form onSubmit={handleCommandSubmit} className="flex-1">
        <input
          type="text"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          placeholder="Enter command..."
          className={`w-full h-7 px-3 focus:outline-none ${
            theme === 'NeXTSTEP'
              ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
              : 'bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
          }`}
        />
      </form>
    </div>
  );
}
