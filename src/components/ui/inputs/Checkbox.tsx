/**
 * Checkbox Component
 *
 * Theme-aware checkbox input.
 * Used in filter panels and settings.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export type CheckboxSize = 'sm' | 'md' | 'lg';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: CheckboxSize;
  label?: string;
}

// ============================================
// Style Maps
// ============================================

const sizeStyles: Record<CheckboxSize, { box: string; check: string; label: string }> = {
  sm: { box: 'w-4 h-4', check: 'w-3 h-3', label: 'text-xs' },
  md: { box: 'w-5 h-5', check: 'w-3.5 h-3.5', label: 'text-sm' },
  lg: { box: 'w-6 h-6', check: 'w-4 h-4', label: 'text-base' },
};

// ============================================
// Component
// ============================================

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ size = 'md', label, className = '', disabled, checked, ...props }, ref) => {
    const { theme } = useTheme();

    const boxStyles =
      theme === 'NeXTSTEP'
        ? `
          bg-white
          border-t-2 border-l-2 border-[#707070]
          border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]
        `
        : `
          bg-white
          rounded border border-gray-300
          shadow-sm
        `;

    const checkedStyles =
      theme === 'NeXTSTEP'
        ? 'bg-[#2850a0] border-[#2850a0]'
        : 'bg-blue-500 border-blue-500';

    const disabledStyles =
      theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] cursor-not-allowed'
        : 'bg-gray-100 cursor-not-allowed';

    const labelStyles =
      theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700';

    return (
      <label
        className={`
          inline-flex items-center gap-2 cursor-pointer
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${className}
        `}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              ${sizeStyles[size].box}
              ${boxStyles}
              ${checked ? checkedStyles : ''}
              ${disabled ? disabledStyles : ''}
              flex items-center justify-center
              transition-colors duration-150
              peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500
            `}
          >
            {checked && (
              <Check
                className={`${sizeStyles[size].check} text-white`}
                strokeWidth={3}
              />
            )}
          </div>
        </div>
        {label && (
          <span className={`${sizeStyles[size].label} ${labelStyles}`}>
            {label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
