import { Cat, Dog, HeartPulse, PawPrint } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PetMascots({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-36 w-56", className)}>
      <div className="absolute inset-x-8 bottom-2 h-5 rounded-full bg-orange-900/10 blur-xl" />
      <motion.div
        className="absolute left-4 top-7 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/90 text-primary shadow-xl shadow-orange-200/35 ring-1 ring-orange-100/90"
        animate={{ y: [0, -6, 0], rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cat className="h-12 w-12 stroke-[1.7]" />
      </motion.div>
      <motion.div
        className="absolute right-4 top-2 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-orange-100/90 text-orange-700 shadow-xl shadow-orange-200/40 ring-1 ring-orange-200/80"
        animate={{ y: [0, 6, 0], rotate: [1.5, -1.5, 1.5] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Dog className="h-14 w-14 stroke-[1.7]" />
      </motion.div>
      <motion.div
        className="absolute bottom-4 left-24 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-md shadow-orange-200/30 ring-1 ring-orange-100"
        animate={{ scale: [1, 1.08, 1], opacity: [0.86, 1, 0.86] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartPulse className="h-5 w-5 stroke-[1.8]" />
      </motion.div>
      {[0, 1, 2].map((item) => (
        <motion.div
          key={item}
          className="absolute text-orange-300/60"
          style={{ left: `${40 + item * 18}px`, bottom: `${12 + item * 12}px` }}
          animate={{ opacity: [0.22, 0.58, 0.22], y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: item * 0.35 }}
        >
          <PawPrint className="h-4 w-4 rotate-12 stroke-[1.8]" />
        </motion.div>
      ))}
    </div>
  );
}

export function FloatingPaws() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[0, 1, 2, 3].map((item) => (
        <motion.div
          key={item}
          className="absolute text-orange-300/14"
          style={{
            right: `${8 + item * 17}%`,
            top: `${20 + (item % 2) * 34}%`,
          }}
          animate={{ y: [0, -10, 0], rotate: [0, 8, 0], opacity: [0.08, 0.2, 0.08] }}
          transition={{
            duration: 8 + item * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: item * 0.5,
          }}
        >
          <PawPrint className="h-10 w-10 stroke-[1.4]" />
        </motion.div>
      ))}
    </div>
  );
}
