import React from 'react';
import { motion } from "motion/react";

interface SuccessAnimationProps {
  title: string;
  message: React.ReactNode;
  subMessage?: string;
  color?: 'emerald' | 'rose' | 'sky';
}

export default function SuccessAnimation({ title, message, subMessage, color = 'emerald' }: SuccessAnimationProps) {
  const colors = {
    emerald: {
      bg1: 'bg-emerald-100',
      bg2: 'bg-emerald-200',
      bg3: 'bg-emerald-500',
      shadow: 'shadow-emerald-200',
      text: 'text-emerald-600',
      bar: 'bg-emerald-500'
    },
    rose: {
      bg1: 'bg-rose-100',
      bg2: 'bg-rose-200',
      bg3: 'bg-rose-500',
      shadow: 'shadow-rose-200',
      text: 'text-rose-600',
      bar: 'bg-rose-500'
    },
    sky: {
      bg1: 'bg-sky-100',
      bg2: 'bg-sky-200',
      bg3: 'bg-sky-500',
      shadow: 'shadow-sky-200',
      text: 'text-sky-600',
      bar: 'bg-sky-500'
    }
  };

  const theme = colors[color];

  return (
    <motion.div
      key="success-animation"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center w-full h-full min-h-[400px]"
    >
      <div className="relative mb-8">
        <motion.div
          className={`absolute inset-0 rounded-full ${theme.bg1}`}
          animate={{ scale: [1, 1.6, 1.6], opacity: [0.7, 0, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          className={`absolute inset-0 rounded-full ${theme.bg2}`}
          animate={{ scale: [1, 1.35, 1.35], opacity: [0.5, 0, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.1 }}
        />
        <motion.div
          className={`relative w-28 h-28 rounded-full ${theme.bg3} flex items-center justify-center shadow-lg ${theme.shadow}`}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          <motion.svg
            width="56" height="56" viewBox="0 0 56 56" fill="none"
            initial="hidden"
            animate="visible"
          >
            <motion.path
              d="M12 28 L24 40 L44 18"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeInOut', delay: 0.2 }}
            />
          </motion.svg>
        </motion.div>
      </div>

      <motion.h2
        className="text-3xl font-extrabold text-slate-900 mb-2"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {title}
      </motion.h2>
      <motion.p
        className="text-base text-slate-500 mb-1"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        {message}
      </motion.p>
      
      {subMessage && (
        <motion.p
          className="text-sm text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {subMessage}
        </motion.p>
      )}

      <motion.div
        className="mt-8 w-48 h-1.5 rounded-full bg-slate-100 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <motion.div
          className={`h-full rounded-full ${theme.bar}`}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, delay: 0.3, ease: 'linear' }}
        />
      </motion.div>
    </motion.div>
  );
}
