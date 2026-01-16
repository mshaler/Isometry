/**
 * Button Component
 *
 * Theme-aware button primitive supporting NeXTSTEP and Modern variants.
 * Extracted pattern from Navigator, Toolbar, and Sidebar components.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

// ============================================
// Style Maps
// ============================================

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-6 px-2 text-xs gap-1',
  md: 'h-7 px-3 text-sm gap-2',
  lg: 'h-9 px-4 text-base gap-2',
};

// NeXTSTEP beveled border pattern
const nextStepVariants: Record<ButtonVariant, string> = {
  primary: `
    bg-[#2850a0] text-white
    border-t-2 border-l-2 border-[#4070c0]
    border-b-2 border-r-2 border-b-[#203878] border-r-[#203878]
    active:border-t-[#203878] active:border-l-[#203878]
    active:border-b-[#4070c0] active:border-r-[#4070c0]
  `,
  secondary: `
    bg-[#d4d4d4] text-[#404040]
    border-t-2 border-l-2 border-[#ffffff]
    border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]
    active:border-t-[#707070] active:border-l-[#707070]
    active:border-b-[#ffffff] active:border-r-[#ffffff]
  `,
  ghost: `
    bg-transparent text-[#404040]
    border-2 border-transparent
    hover:bg-[#c8c8c8]
  `,
  danger: `
    bg-[#c04040] text-white
    border-t-2 border-l-2 border-[#e06060]
    border-b-2 border-r-2 border-b-[#802020] border-r-[#802020]
    active:border-t-[#802020] active:border-l-[#802020]
    active:border-b-[#e06060] active:border-r-[#e06060]
  `,
};

// Modern rounded pattern
const modernVariants: Record<ButtonVariant, string> = {
  primary: `
    bg-blue-500 text-white
    rounded-lg border border-blue-600
    hover:bg-blue-600 active:bg-blue-700
    shadow-sm hover:shadow
  `,
  secondary: `
    bg-white text-gray-700
    rounded-lg border border-gray-300
    hover:bg-gray-50 active:bg-gray-100
    shadow-sm
  `,
  ghost: `
    bg-transparent text-gray-600
    rounded-lg border border-transparent
    hover:bg-gray-100 active:bg-gray-200
  `,
  danger: `
    bg-red-500 text-white
    rounded-lg border border-red-600
    hover:bg-red-600 active:bg-red-700
    shadow-sm hover:shadow
  `,
};

// ============================================
// Component
// ============================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      children,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();

    const variantStyles =
      theme === 'NeXTSTEP' ? nextStepVariants[variant] : modernVariants[variant];

    const disabledStyles =
      theme === 'NeXTSTEP'
        ? 'opacity-50 cursor-not-allowed'
        : 'opacity-50 cursor-not-allowed hover:bg-inherit';

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center
          font-medium whitespace-nowrap
          transition-colors duration-150
          ${sizeStyles[size]}
          ${variantStyles}
          ${fullWidth ? 'w-full' : ''}
          ${disabled ? disabledStyles : ''}
          ${className}
        `}
        {...props}
      >
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
