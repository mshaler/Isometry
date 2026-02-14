/**
 * IconButton Component
 *
 * Square icon button for toolbars and actions.
 * Extracted pattern from Toolbar command buttons.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export type IconButtonVariant = 'default' | 'ghost' | 'active';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label?: string; // For accessibility
  active?: boolean;
}

// ============================================
// Style Maps
// ============================================

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
};

const iconSizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

// NeXTSTEP beveled border pattern
const nextStepVariants: Record<IconButtonVariant, string> = {
  default: `
    bg-[#d4d4d4]
    border-t-2 border-l-2 border-[#ffffff]
    border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]
    active:border-t-[#707070] active:border-l-[#707070]
    active:border-b-[#ffffff] active:border-r-[#ffffff]
  `,
  ghost: `
    bg-transparent
    border-2 border-transparent
    hover:bg-[#c8c8c8]
  `,
  active: `
    bg-[#b0b0b0]
    border-t-2 border-l-2 border-[#707070]
    border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]
  `,
};

// Modern rounded pattern
const modernVariants: Record<IconButtonVariant, string> = {
  default: `
    bg-white
    rounded-lg border border-gray-300
    hover:bg-gray-50 active:bg-gray-100
    shadow-sm
  `,
  ghost: `
    bg-transparent
    rounded-lg border border-transparent
    hover:bg-gray-100 active:bg-gray-200
  `,
  active: `
    bg-blue-100
    rounded-lg border border-blue-300
    text-blue-600
  `,
};

// ============================================
// Component
// ============================================

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'default',
      size = 'md',
      label,
      active = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();

    const effectiveVariant = active ? 'active' : variant;
    const variantStyles =
      theme === 'NeXTSTEP'
        ? nextStepVariants[effectiveVariant]
        : modernVariants[effectiveVariant];

    const disabledStyles = 'opacity-50 cursor-not-allowed';

    const textColor =
      theme === 'NeXTSTEP'
        ? 'text-[#404040]'
        : effectiveVariant === 'active'
          ? 'text-blue-600'
          : 'text-gray-600';

    return (
      <button
        ref={ref}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`
          inline-flex items-center justify-center
          transition-colors duration-150
          ${sizeStyles[size]}
          ${variantStyles}
          ${textColor}
          ${disabled ? disabledStyles : ''}
          ${className}
        `}
        {...props}
      >
        <span className={iconSizeStyles[size]}>{icon}</span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

