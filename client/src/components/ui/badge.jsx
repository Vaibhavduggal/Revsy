import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { Slot as SlotPrimitive } from '@radix-ui/react-slot';

const badgeVariants = cva(
  'inline-flex items-center justify-center border border-transparent font-medium focus:outline-hidden [&_svg]:-ms-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-violet-500 text-white',
        outline: 'bg-transparent border border-border text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      appearance: {
        default: '',
        light: '',
        outline: '',
        ghost: 'border-transparent bg-transparent',
      },
      disabled: {
        true: 'opacity-50 pointer-events-none',
      },
      size: {
        lg: 'rounded-md px-[0.5rem] h-7 min-w-7 gap-1.5 text-xs [&_svg]:size-3.5',
        md: 'rounded-md px-[0.45rem] h-6 min-w-6 gap-1.5 text-xs [&_svg]:size-3.5',
        sm: 'rounded-sm px-[0.325rem] h-5 min-w-5 gap-1 text-[0.6875rem] leading-[0.75rem] [&_svg]:size-3',
        xs: 'rounded-sm px-[0.25rem] h-4 min-w-4 gap-1 text-[0.625rem] leading-[0.5rem] [&_svg]:size-3',
      },
      shape: {
        default: '',
        circle: 'rounded-full',
      },
    },
    compoundVariants: [
      {
        variant: 'success',
        appearance: 'light',
        className: 'text-green-800 bg-green-100',
      },
      {
        variant: 'destructive',
        appearance: 'light',
        className: 'text-red-700 bg-red-50',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'default',
      size: 'md',
    },
  },
);

function Badge({
  className,
  variant,
  size,
  appearance,
  shape,
  asChild = false,
  disabled,
  ...props
}) {
  const Comp = asChild ? SlotPrimitive : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, appearance, shape, disabled }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
