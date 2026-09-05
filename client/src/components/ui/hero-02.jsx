import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Balancer from 'react-wrap-balancer';
import { cn } from '@/lib/utils';
import { Cta } from '@/components/ui/hero-02-utils/cta';
import { DashboardDemo } from '@/components/ui/hero-02-utils/dashboard-demo';

const variantStyles = {
  standard: {
    section: 'py-20 sm:py-28',
    title: 'text-3xl sm:text-4xl md:text-5xl',
    description: 'max-w-md text-sm sm:text-base',
    header: 'gap-5',
    content: 'gap-14 sm:gap-20',
  },
  compact: {
    section: 'py-8 sm:py-10',
    title: 'text-2xl sm:text-3xl md:text-4xl',
    description: 'max-w-xl text-sm sm:text-base',
    header: 'gap-4',
    content: 'gap-8 sm:gap-10',
  },
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const mediaItem = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

function Reveal({ active, variants, className, children }) {
  if (!active) return <div className={className}>{children}</div>;

  return (
    <motion.div variants={variants ?? item} className={className}>
      {children}
    </motion.div>
  );
}

export function Hero02({
  title,
  titleLine2,
  description,
  washImage,
  animation = 'none',
  primaryCTA,
  secondaryCTA,
  variant = 'standard',
  dashboardProps,
  actions,
}) {
  const reduce = useReducedMotion();
  const animate = animation === 'subtle' && !reduce;
  const vs = variantStyles[variant];

  return (
    <section className="bg-background relative isolate w-full overflow-hidden rounded-2xl border border-border/70">
      <motion.div
        className={cn('relative z-10 mx-auto flex max-w-6xl flex-col px-4 sm:px-6', vs.section, vs.content)}
        variants={animate ? container : undefined}
        initial={animate ? 'hidden' : false}
        whileInView={animate ? 'visible' : undefined}
        viewport={{ once: true, margin: '-80px' }}
      >
        <Reveal active={animate} className={cn('flex max-w-2xl flex-col items-start', vs.header)}>
          {title && (
            <h1 className={cn('text-foreground font-serif font-normal tracking-tight text-balance', vs.title)}>
              <Balancer>{title}</Balancer>
              {titleLine2 && (
                <>
                  <br />
                  <Balancer>{titleLine2}</Balancer>
                </>
              )}
            </h1>
          )}
          {description && (
            <p className={cn('text-muted-foreground', vs.description)}>
              <Balancer>{description}</Balancer>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {primaryCTA && <Cta cta={primaryCTA} />}
            {secondaryCTA && <Cta cta={secondaryCTA} />}
            {actions}
          </div>
        </Reveal>

        <Reveal active={animate} variants={mediaItem} className="w-full">
          <div className="relative w-full overflow-hidden rounded-xl outline outline-black/10">
            {washImage && (
              <img
                src={washImage}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/40" />
            <div className="relative flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10">
              <DashboardDemo {...dashboardProps} />
            </div>
          </div>
        </Reveal>
      </motion.div>
    </section>
  );
}

export default Hero02;
