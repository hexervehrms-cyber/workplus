import { useEffect, useState } from 'react';
import { Sun, Moon, Coffee, Sunset } from 'lucide-react';

interface GreetingData {
  greeting: string;
  message: string;
  icon: React.ReactNode;
  emoji: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export const DynamicGreeting = ({ userName }: { userName?: string }) => {
  const [greetingData, setGreetingData] = useState<GreetingData | null>(null);

  useEffect(() => {
    const updateGreeting = () => {
      const now = new Date();
      const hour = now.getHours();
      let greeting: GreetingData;

      if (hour >= 5 && hour < 12) {
        // Morning: 5 AM - 12 PM
        greeting = {
          greeting: 'Good Morning',
          message: "Here's what's happening with your work today",
          icon: <Sun className="w-5 h-5 text-yellow-500" />,
          emoji: '??',
          timeOfDay: 'morning'
        };
      } else if (hour >= 12 && hour < 17) {
        // Afternoon: 12 PM - 5 PM
        greeting = {
          greeting: 'Good Afternoon',
          message: "Keep up the great work! Here's your progress",
          icon: <Coffee className="w-5 h-5 text-amber-600" />,
          emoji: '??',
          timeOfDay: 'afternoon'
        };
      } else if (hour >= 17 && hour < 21) {
        // Evening: 5 PM - 9 PM
        greeting = {
          greeting: 'Good Evening',
          message: "Wrapping up? Here's your day's summary",
          icon: <Sunset className="w-5 h-5 text-orange-500" />,
          emoji: '??',
          timeOfDay: 'evening'
        };
      } else {
        // Night: 9 PM - 5 AM
        greeting = {
          greeting: 'Good Night',
          message: "Working late? Here's your night shift overview",
          icon: <Moon className="w-5 h-5 text-indigo-500" />,
          emoji: '??',
          timeOfDay: 'night'
        };
      }

      setGreetingData(greeting);
    };

    updateGreeting();

    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!greetingData) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{greetingData.emoji}</span>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {greetingData.greeting}, {userName || 'Employee'}!
          </h1>
          <p className="text-muted-foreground mt-1">{greetingData.message}</p>
        </div>
      </div>
    </div>
  );
};

export default DynamicGreeting;
