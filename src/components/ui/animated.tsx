"use client";

import { motion, type Variants } from "motion/react";
import { type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Shared variant presets                                            */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const slideRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

const VARIANT_MAP = {
  "fade-up": fadeUp,
  "fade-in": fadeIn,
  "scale-in": scaleIn,
  "slide-left": slideLeft,
  "slide-right": slideRight,
} as const;

type AnimationVariant = keyof typeof VARIANT_MAP;

/* ------------------------------------------------------------------ */
/*  AnimatedContainer – wraps page / section content                  */
/* ------------------------------------------------------------------ */

interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
}

export function AnimatedContainer({
  children,
  className,
  variant = "fade-up",
  delay = 0,
  duration = 0.4,
}: AnimatedContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={VARIANT_MAP[variant]}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  StaggerContainer – animates children one after another            */
/* ------------------------------------------------------------------ */

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  initialDelay = 0,
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  StaggerItem – a single child inside a StaggerContainer            */
/* ------------------------------------------------------------------ */

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  variant?: AnimationVariant;
}

export function StaggerItem({
  children,
  className,
  variant = "fade-up",
}: StaggerItemProps) {
  return (
    <motion.div
      variants={VARIANT_MAP[variant]}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  HoverCard – card with subtle lift & shadow on hover               */
/* ------------------------------------------------------------------ */

interface HoverCardProps {
  children: ReactNode;
  className?: string;
}

export function HoverCard({ children, className }: HoverCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  HoverScale – subtle scale-up on hover (for buttons, icons, etc.)  */
/* ------------------------------------------------------------------ */

interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverScale({
  children,
  className,
  scale = 1.04,
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  PageTransition – fade-up entrance for entire pages                */
/* ------------------------------------------------------------------ */

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  PulseLoader – three bouncing dots for inline loading states       */
/* ------------------------------------------------------------------ */

export function PulseLoader({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-2 rounded-full bg-primary"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonShimmer – a shimmer overlay for skeleton loading states    */
/* ------------------------------------------------------------------ */

interface SkeletonShimmerProps {
  className?: string;
  lines?: number;
}

export function SkeletonShimmer({
  className,
  lines = 3,
}: SkeletonShimmerProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 rounded-md bg-muted skeleton-shimmer ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}
