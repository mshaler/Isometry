import React from 'react';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ children, className, ...props }: LabelProps) {
  return (
    <label
      className={`text-sm font-medium text-gray-700 ${className || ''}`}
      {...props}
    >
      {children}
    </label>
  );
}