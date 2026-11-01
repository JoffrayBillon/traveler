import { motion } from "motion/react";

export function TabSelectionIndicator({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  return (
    <motion.span
      aria-hidden="true"
      className="absolute inset-0 z-0 rounded-control bg-surface shadow-sm"
      layoutId="organizer-tab-selection"
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 520, damping: 38 }
      }
    />
  );
}
