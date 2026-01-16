import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  const { theme } = useTheme();
  
  return (
    <div
      className={`animate-pulse ${
        theme === 'NeXTSTEP' ? 'bg-[#a0a0a0]' : 'bg-gray-200 rounded'
      } ${className}`}
    />
  );
}
