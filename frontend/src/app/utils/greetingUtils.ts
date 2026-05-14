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

  // Morning: 5 AM - 11:59 AM
  if (hour >= 5 && hour < 12) {
    const greetings = [
      { message: `Good morning, ${userName}.`, emoji: '🌅', subMessage: 'Let’s align on your priorities for today.' },
      { message: `Good morning, ${userName}.`, emoji: '🌅', subMessage: 'Here is your work overview for the day.' },
      { message: `Good morning, ${userName}.`, emoji: '🌅', subMessage: 'Ready to make today productive.' },
      { message: `Good morning, ${userName}.`, emoji: '🌅', subMessage: 'Focus on what matters most today.' },
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
      { message: `Good afternoon, ${userName}.`, emoji: '☀️', subMessage: 'Here is your dashboard summary.' },
      { message: `Good afternoon, ${userName}.`, emoji: '☀️', subMessage: 'Continue your strong progress this afternoon.' },
      { message: `Good afternoon, ${userName}.`, emoji: '☀️', subMessage: 'Review your priorities and stay on track.' },
      { message: `Good afternoon, ${userName}.`, emoji: '☀️', subMessage: 'Maintain momentum through the rest of the day.' },
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
      { message: `Good evening, ${userName}.`, emoji: '🌆', subMessage: 'Review your progress and next steps.' },
      { message: `Good evening, ${userName}.`, emoji: '🌆', subMessage: 'Finish the day with a clear summary.' },
      { message: `Good evening, ${userName}.`, emoji: '🌆', subMessage: 'Here is your status for the day.' },
      { message: `Good evening, ${userName}.`, emoji: '🌆', subMessage: 'Keep your final tasks in view.' },
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
    { message: `Good evening, ${userName}.`, emoji: '🌙', subMessage: 'Review your updates before wrapping up.' },
    { message: `Good evening, ${userName}.`, emoji: '🌙', subMessage: 'Here is your summary for tonight.' },
    { message: `Good evening, ${userName}.`, emoji: '🌙', subMessage: 'Keep an eye on your key tasks.' },
    { message: `Good evening, ${userName}.`, emoji: '🌙', subMessage: 'Wind down with a clear task overview.' },
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
