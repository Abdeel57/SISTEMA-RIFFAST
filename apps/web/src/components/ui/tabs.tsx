import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

export const Tabs = TabsPrimitive.Root;

// En el administrador las pestañas son un control segmentado de iOS.
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const admin = useAdminSurface();
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        admin
          ? 'grid h-11 w-full auto-cols-fr grid-flow-col items-stretch rounded-control bg-rf-fill-strong p-[3px]'
          : 'inline-flex h-11 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground w-full',
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const admin = useAdminSurface();
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        admin
          ? 'inline-flex items-center justify-center whitespace-nowrap rounded-[9px] px-3 text-callout font-semibold text-rf-label outline-none transition-[background-color,box-shadow] duration-base focus-visible:ring-2 focus-visible:ring-rf-accent/45 disabled:pointer-events-none disabled:opacity-40 data-[state=inactive]:active:opacity-60 data-[state=active]:bg-rf-surface data-[state=active]:shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]'
          : 'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';
