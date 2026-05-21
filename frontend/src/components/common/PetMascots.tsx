import { Cat, Dog, HeartPulse, PawPrint } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PetMascots({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-32 w-44", className)}>
      <motion.div
        className="absolute left-2 top-8 rounded-2xl bg-white/85 p-3 text-primary shadow-lg shadow-orange-200/60 ring-1 ring-orange-100"
        animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cat className="h-10 w-10" />
      </motion.div>
      <motion.div
        className="absolute right-2 top-2 rounded-2xl bg-amber-100 p-3 text-amber-700 shadow-lg shadow-orange-200/60 ring-1 ring-amber-200"
        animate={{ y: [0, 7, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Dog className="h-11 w-11" />
      </motion.div>
      <motion.div
        className="absolute bottom-4 left-20 rounded-full bg-rose-100 p-2 text-rose-500 shadow-sm"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartPulse className="h-5 w-5" />
      </motion.div>
      <motion.div
        className="absolute bottom-0 right-12 rounded-full bg-white/80 p-2 text-orange-400 shadow-sm"
        animate={{ opacity: [0.55, 1, 0.55], y: [0, -4, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <PawPrint className="h-4 w-4" />
      </motion.div>
    </div>
  );
}

export function FloatingPaws() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[0, 1, 2, 3, 4].map((item) => (
        <motion.div
          key={item}
          className="absolute text-orange-300/25"
          style={{
            left: `${12 + item * 18}%`,
            top: `${18 + (item % 3) * 22}%`,
          }}
          animate={{ y: [0, -14, 0], rotate: [0, 12, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{
            duration: 5 + item * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: item * 0.35,
          }}
        >
          <PawPrint className="h-8 w-8" />
        </motion.div>
      ))}
    </div>
  );
}
