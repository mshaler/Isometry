/**
 * Dropdown Component
 *
 * Theme-aware dropdown/select component.
 * Extracted pattern from Navigator.tsx inline Dropdown.
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps<T = string> {
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

// ============================================
// Component
// ============================================

export function Dropdown<T = string>({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select...',
  disabled = false,
  fullWidth = false,
  className = '',
}: DropdownProps<T>) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || placeholder;

  const buttonStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#d4d4d4] text-[#404040]
        border-t-2 border-l-2 border-[#ffffff]
        border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]
        active:border-t-[#707070] active:border-l-[#707070]
        active:border-b-[#ffffff] active:border-r-[#ffffff]
      `
      : `
        bg-white text-gray-700
        rounded-lg border border-gray-300
        hover:bg-gray-50
        shadow-sm
      `;

  const menuStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#d4d4d4]
        border-2 border-[#707070]
        shadow-[2px_2px_0_#505050]
      `
      : `
        bg-white
        rounded-lg border border-gray-200
        shadow-lg
      `;

  const itemStyles =
    theme === 'NeXTSTEP'
      ? 'hover:bg-[#2850a0] hover:text-white'
      : 'hover:bg-gray-100 rounded';

  const labelStyles =
    theme === 'NeXTSTEP'
      ? 'text-xs text-[#404040]'
      : 'text-xs text-gray-600 font-medium';

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      <div className="flex items-center gap-1">
        {label && (
          <span className={`${labelStyles} whitespace-nowrap`}>{label}:</span>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            h-7 px-3 flex items-center gap-2 text-sm
            ${fullWidth ? 'w-full' : 'min-w-[120px]'}
            justify-between
            ${buttonStyles}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            transition-colors duration-150
          `}
        >
          <span className="truncate">
            {selectedOption?.icon && (
              <span className="mr-2">{selectedOption.icon}</span>
            )}
            {displayValue}
          </span>
          <ChevronDown
            className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 top-full left-0 mt-1
            min-w-full max-h-60 overflow-auto
            ${menuStyles}
          `}
        >
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) {
                  onSelect(option.value);
                  setIsOpen(false);
                }
              }}
              className={`
                w-full px-3 py-1.5 text-sm text-left
                flex items-center gap-2
                ${option.value === value ? 'font-medium' : ''}
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : itemStyles}
                ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'}
              `}
            >
              {option.icon && <span className="w-4 h-4">{option.icon}</span>}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
