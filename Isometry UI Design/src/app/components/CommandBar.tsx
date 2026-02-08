import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function CommandBar() {
  const [commandText, setCommandText] = useState('');
  const { theme } = useTheme();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Command submitted:', commandText);
    // Handle command execution here
    setCommandText('');
  };

  return (
    <div className={`h-10 flex items-center px-3 gap-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.7),inset_-2px_-2px_3px_rgba(0,0,0,0.3)]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }`}>
      {/* Command Button with Cloverleaf */}
      <button
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
            : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
        }`}
        aria-label="Command key"
        title="Command"
      >
        <span className={`text-lg leading-none ${theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'}`}>⌘</span>
      </button>

      {/* Command Input Field */}
      <form onSubmit={handleCommandSubmit} className="flex-1">
        <input
          type="text"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          placeholder="Enter command..."
          className={`w-full h-7 px-3 focus:outline-none ${
            theme === 'NeXTSTEP'
              ? 'bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] focus:ring-2 focus:ring-[#000000] focus:ring-inset text-[#000000] placeholder:text-[#808080]'
              : 'bg-white/80 backdrop-blur-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400'
          }`}
        />
      </form>
    </div>
  );
}