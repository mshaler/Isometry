import React, { useState } from 'react';

export interface TooltipProps {
  children: React.ReactNode;
}

export function TooltipProvider({ children }: TooltipProps) {
  return <>{children}</>;
}

export interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  return <>{children}</>;
}

export interface TooltipContentProps {
  children: React.ReactNode;
}

export function TooltipContent({ children }: TooltipContentProps) {
  return (
    <div className="absolute z-10 px-2 py-1 text-sm text-white bg-black rounded opacity-0 pointer-events-none">
      {children}
    </div>
  );
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}