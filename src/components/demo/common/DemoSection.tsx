import { useTheme } from '@/contexts/ThemeContext';

interface DemoSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function DemoSection({
  title,
  description,
  children,
}: DemoSectionProps) {
  const { theme } = useTheme();

  return (
    <section className="mb-8">
      <h2
        className={`text-lg font-semibold mb-1 ${
          theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-800'
        }`}
      >
        {title}
      </h2>
      <p
        className={`text-sm mb-4 ${
          theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
        }`}
      >
        {description}
      </p>
      <div
        className={`rounded-lg p-4 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
            : 'bg-white border border-gray-200 shadow-sm'
        }`}
      >
        {children}
      </div>
    </section>
  );
}