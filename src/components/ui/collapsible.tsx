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
}

export function CollapsibleContent({ children, open, className, ...props }: CollapsibleContentProps) {
  return (
    <div className={`overflow-hidden transition-all ${open ? 'block' : 'hidden'} ${className || ''}`} {...props}>
      {children}
    </div>
  );
}