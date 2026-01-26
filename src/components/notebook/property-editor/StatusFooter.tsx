import { Check, AlertCircle } from 'lucide-react';

interface StatusFooterProps {
  propertyCount: number;
  isSaving: boolean;
  saveSuccess: boolean;
  errorCount: number;
  theme: 'NeXTSTEP' | 'Modern';
}

export function StatusFooter({
  propertyCount,
  isSaving,
  saveSuccess,
  errorCount,
  theme
}: StatusFooterProps) {
  return (
    <div className={`flex items-center justify-between text-xs pt-2 border-t ${
      theme === 'NeXTSTEP' ? 'border-[#707070] text-[#666666]' : 'border-gray-200 text-gray-500'
    }`}>
      <span>{propertyCount} properties set</span>
      <div className="flex items-center gap-2">
        {isSaving && (
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </span>
        )}
        {saveSuccess && (
          <span className="flex items-center gap-1 text-green-600">
            <Check size={12} />
            Saved
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <AlertCircle size={12} />
            {errorCount} errors
          </span>
        )}
      </div>
    </div>
  );
}