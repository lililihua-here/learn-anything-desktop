import { useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { CardItem as CardItemType } from "../../types/cards";

interface Props {
  card: CardItemType;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onMastered: () => void;
}

export default function CardItem({ card, onSwipeRight, onSwipeLeft, onMastered }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -50, 0, 50, 200], [0.5, 1, 1, 1, 0.5]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) onSwipeRight();
    else if (info.offset.x < -100) onSwipeLeft();
  };

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onMastered();
    }, 800);
  }, [onMastered]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
      style={{ x, rotate, opacity }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-grab active:cursor-grabbing select-none touch-none"
      whileTap={{ scale: 0.98 }}>
      <h4 className="font-semibold text-gray-800 mb-1">{card.name}</h4>
      <p className="text-xs text-gray-400">{card.summary}</p>
      {card.status === "deferred" && (
        <span className="text-xs text-orange-400 mt-1 block">Deferred {card.deferCount} time(s)</span>
      )}
    </motion.div>
  );
}
