import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';

const CardContext = React.createContext({ variant: 'default' });

const useCardContext = () => React.useContext(CardContext);

const cardVariants = cva('flex flex-col items-stretch text-card-foreground rounded-xl', {
  variants: {
    variant: {
      default: 'bg-card border border-border shadow-xs',
      accent: 'bg-muted shadow-xs p-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardHeaderVariants = cva('flex items-center justify-between flex-wrap px-5 min-h-14 gap-2.5', {
  variants: {
    variant: {
      default: 'border-b border-border',
      accent: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardContentVariants = cva('grow p-5', {
  variants: {
    variant: {
      default: '',
      accent: 'bg-card rounded-t-xl [&:last-child]:rounded-b-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Card({ className, variant = 'default', ...props }) {
  return (
    <CardContext.Provider value={{ variant: variant || 'default' }}>
      <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
    </CardContext.Provider>
  );
}

function CardHeader({ className, ...props }) {
  const { variant } = useCardContext();
  return <div data-slot="card-header" className={cn(cardHeaderVariants({ variant }), className)} {...props} />;
}

function CardContent({ className, ...props }) {
  const { variant } = useCardContext();
  return <div data-slot="card-content" className={cn(cardContentVariants({ variant }), className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }) {
  return <div data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardToolbar({ className, ...props }) {
  return <div data-slot="card-toolbar" className={cn('flex items-center gap-2.5', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle, CardToolbar };
