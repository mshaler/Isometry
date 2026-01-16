/**
 * Input Component
 *
 * Theme-aware text input primitive.
 * Extracted pattern from CommandBar and filter inputs.
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
  fullWidth?: boolean;
}

// ============================================
// Style Maps
// ============================================

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

const iconPadding: Record<InputSize, { left: string; right: string }> = {
  sm: { left: 'pl-7', right: 'pr-7' },
  md: { left: 'pl-9', right: 'pr-9' },
  lg: { left: 'pl-11', right: 'pr-11' },
};

// ============================================
// Component
// ============================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      leftIcon,
      rightIcon,
      error = false,
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();

    const baseStyles =
      theme === 'NeXTSTEP'
        ? `
          bg-white text-[#404040]
          border-t-2 border-l-2 border-[#707070]
          border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]
          placeholder:text-[#909090]
          focus:outline-none focus:border-[#2850a0]
        `
        : `
          bg-white text-gray-900
          rounded-lg border border-gray-300
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          shadow-sm
        `;

    const errorStyles =
      theme === 'NeXTSTEP'
        ? 'border-[#c04040]'
        : 'border-red-500 focus:ring-red-500 focus:border-red-500';

    const disabledStyles =
      theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] text-[#909090] cursor-not-allowed'
        : 'bg-gray-100 text-gray-500 cursor-not-allowed';

    const paddingStyles = `
      ${leftIcon ? iconPadding[size].left : ''}
      ${rightIcon ? iconPadding[size].right : ''}
    `;

    return (
      <div className={`relative ${fullWidth ? 'w-full' : 'inline-flex'}`}>
        {leftIcon && (
          <span
            className={`
              absolute left-2 top-1/2 -translate-y-1/2
              ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}
              pointer-events-none
            `}
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`
            w-full
            transition-colors duration-150
            ${sizeStyles[size]}
            ${baseStyles}
            ${paddingStyles}
            ${error ? errorStyles : ''}
            ${disabled ? disabledStyles : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <span
            className={`
              absolute right-2 top-1/2 -translate-y-1/2
              ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}
              pointer-events-none
            `}
          >
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
