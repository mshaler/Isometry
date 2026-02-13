import React, { useState } from 'react';

export interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Collapsible({ open: controlledOpen, onOpenChange, children }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <div data-state={isOpen ? 'open' : 'closed'} data-open={isOpen}>
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, { onOpenChange: handleOpenChange, open: isOpen } as Record<string, unknown>)
          : child
      )}
    </div>
  );
}

export interface CollapsibleTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function CollapsibleTrigger({ children, onOpenChange, open }: CollapsibleTriggerProps) {
  const handleClick = () => {
    onOpenChange?.(!open);
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  open?: boolean;
  maxHeight?: string;
}

/**
 * CollapsibleContent with smooth max-height animation
 * Uses inline styles for maxHeight because Tailwind JIT cannot detect
 * classes inside template literals with dynamic values.
 * 300ms duration matches existing view transition timing in the codebase.
 */
export function CollapsibleContent({
  children,
  open,
  className,
  maxHeight = '24rem', // Default ~384px, suitable for Notebook panel
  ...props
}: CollapsibleContentProps) {
  return (
    <div
      style={{
        maxHeight: open ? maxHeight : '0',
        transition: 'max-height 300ms ease-in-out',
      }}
      className={`overflow-hidden ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}