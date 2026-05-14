/**
 * Dynamic Greeting Utility
 * Generates time-based greetings with unique styling
 */

export interface GreetingData {
  message: string;
  emoji: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  bgGradient: string;
  textColor: string;
  accentColor: string;
  subMessage: string;
}

export function getDynamicGreeting(userName: string): GreetingData {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Capitalize first letter of name
  const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Morning: 5 AM - 11:59 AM
  if (hour >= 5 && hour < 12) {
    const greetings = [
      { message: `Good morning, ${capitalizedName}.`, emoji: '', subMessage: 'Your dashboard overview is ready.' },
      { message: `Good morning, ${capitalizedName}.`, emoji: '', subMessage: 'Please review your priorities for today.' },
      { message: `Good morning, ${capitalizedName}.`, emoji: '', subMessage: 'A focused start to the day is available.' },
      { message: `Good morning, ${capitalizedName}.`, emoji: '', subMessage: 'Begin with your current assignments in view.' },
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      message: greeting.message,
      emoji: greeting.emoji,
      timeOfDay: 'morning',
      bgGradient: 'from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950 dark:via-orange-950 dark:to-rose-950',
      textColor: 'text-amber-900 dark:text-amber-100',
      accentColor: 'text-orange-600 dark:text-orange-400',
      subMessage: greeting.subMessage
    };
  }

  // Afternoon: 12 PM - 4:59 PM
  if (hour >= 12 && hour < 17) {
    const greetings = [
      { message: `Good afternoon, ${capitalizedName}.`, emoji: '', subMessage: 'Your dashboard summary is ready.' },
      { message: `Good afternoon, ${capitalizedName}.`, emoji: '', subMessage: 'Review current tasks and progress.' },
      { message: `Good afternoon, ${capitalizedName}.`, emoji: '', subMessage: 'Maintain focus for the remainder of the day.' },
      { message: `Good afternoon, ${capitalizedName}.`, emoji: '', subMessage: 'Continue with your important priorities.' },
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      message: greeting.message,
      emoji: greeting.emoji,
      timeOfDay: 'afternoon',
      bgGradient: 'from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950 dark:via-cyan-950 dark:to-teal-950',
      textColor: 'text-blue-900 dark:text-blue-100',
      accentColor: 'text-cyan-600 dark:text-cyan-400',
      subMessage: greeting.subMessage
    };
  }

  // Evening: 5 PM - 8:59 PM
  if (hour >= 17 && hour < 21) {
    const greetings = [
      { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Review your progress and next steps.' },
      { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Finish the day with a clear summary.' },
      { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Your current status is available for review.' },
      { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Prepare for tomorrow from the current overview.' },
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    return {
      message: greeting.message,
      emoji: greeting.emoji,
      timeOfDay: 'evening',
      bgGradient: 'from-purple-50 via-pink-50 to-red-50 dark:from-purple-950 dark:via-pink-950 dark:to-red-950',
      textColor: 'text-purple-900 dark:text-purple-100',
      accentColor: 'text-pink-600 dark:text-pink-400',
      subMessage: greeting.subMessage
    };
  }

  // Night: 9 PM - 4:59 AM
  const greetings = [
    { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Review your updates before closing the day.' },
    { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Your night summary is available.' },
    { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'Keep track of your remaining items.' },
    { message: `Good evening, ${capitalizedName}.`, emoji: '', subMessage: 'End the day with a clear task overview.' },
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  return {
    message: greeting.message,
    emoji: greeting.emoji,
    timeOfDay: 'night',
    bgGradient: 'from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
    textColor: 'text-slate-100 dark:text-slate-200',
    accentColor: 'text-indigo-400 dark:text-indigo-300',
    subMessage: greeting.subMessage
  };
}

export function getTimeBasedEmoji(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) return '🌅';
  if (hour >= 12 && hour < 17) return '☀️';
  if (hour >= 17 && hour < 21) return '🌆';
  return '🌙';
}

export function getMotivationalQuote(): string {
  const quotes = [
    'Every moment is a fresh beginning.',
    'Success is the sum of small efforts repeated day in and day out.',
    'The only way to do great work is to love what you do.',
    'Don\'t watch the clock; do what it does. Keep going.',
    'Your work is going to fill a large part of your life.',
    'The future depends on what you do today.',
    'Excellence is not a destination; it is a continuous journey.',
    'Believe you can and you\'re halfway there.',
    'Success doesn\'t just find you. You have to go out and get it.',
    'The only limit to our realization of tomorrow is our doubts of today.',
  ];
  
  return quotes[Math.floor(Math.random() * quotes.length)];
}
