import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2 } from 'lucide-react';

interface Props {
  show: boolean;
  message?: string;
}

export default function SuccessToast({ show, message = "Saved Successfully" }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 bg-slate-900 text-white rounded-xl shadow-2xl shadow-slate-900/20 border border-slate-700"
        >
          <div className="relative flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 size={24} className="text-emerald-400" />
            </motion.div>
            <motion.div
              className="absolute inset-0 border-2 border-emerald-400 rounded-full"
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
            />
          </div>
          <span className="font-semibold">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
