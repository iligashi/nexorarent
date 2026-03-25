'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-text-secondary text-sm font-medium mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-surface border border-border rounded px-4 py-2.5 text-white text-sm placeholder:text-text-muted',
              'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all',
              Icon && 'pl-10',
              error && 'border-error',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-error text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
