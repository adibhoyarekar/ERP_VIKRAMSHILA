import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Fetch the animation data globally once to avoid AbortError on unmount in StrictMode
let lottieBuffer: ArrayBuffer | null = null;
let fetchPromise: Promise<ArrayBuffer> | null = null;

const fetchLottieData = async () => {
  if (lottieBuffer) return lottieBuffer;
  if (!fetchPromise) {
    fetchPromise = fetch('/loader.lottie').then(r => r.arrayBuffer()).then(buffer => {
      lottieBuffer = buffer;
      return buffer;
    });
  }
  return fetchPromise;
};

export default function Loader({ show, fullScreen = true }: { show: boolean, fullScreen?: boolean }) {
  const [shouldRender, setShouldRender] = useState(false);
  const [data, setData] = useState<ArrayBuffer | null>(lottieBuffer);

  useEffect(() => {
    if (show && !data) {
      fetchLottieData().then(setData).catch(console.error);
    }
  }, [show, data]);

  useEffect(() => {
    let timer: any;
    if (show) {
      // Small delay to avoid flash for very fast loads
      timer = setTimeout(() => setShouldRender(true), 100);
    } else {
      setShouldRender(false);
    }
    return () => clearTimeout(timer);
  }, [show]);

  const loaderContent = (
    <div className="flex items-center justify-center w-full h-full">
      <div className="w-[160px] h-[160px] md:w-[220px] md:h-[220px] lg:w-[280px] lg:h-[280px]">
        {data && (
          <DotLottieReact
            data={data}
            loop
            autoplay
            backgroundColor="transparent"
          />
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {shouldRender && (
        fullScreen ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            {loaderContent}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-[inherit]"
          >
            {loaderContent}
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}
