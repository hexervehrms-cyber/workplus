import { useEffect, useState } from 'react';

interface LoadingProgressBarProps {
  isLoading: boolean;
  color?: string;
}

export const LoadingProgressBar = ({ isLoading, color = 'bg-blue-500' }: LoadingProgressBarProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      const timer = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timer);
    }

    setProgress(10);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 30;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-transparent">
      <div
        className={`h-full ${color} transition-all duration-300 ease-out shadow-lg`}
        style={{
          width: `${progress}%`,
          boxShadow: `0 0 10px ${color === 'bg-blue-500' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(34, 197, 94, 0.8)'}`
        }}
      />
    </div>
  );
};

export default LoadingProgressBar;
