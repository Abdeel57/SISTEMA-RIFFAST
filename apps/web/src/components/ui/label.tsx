import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const admin = useAdminSurface();
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        admin
          ? 'mb-2 block text-callout font-medium text-rf-label peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
          : 'text-sm font-medium leading-none mb-1.5 block peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;
