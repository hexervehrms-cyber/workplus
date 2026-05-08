"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils";
import { buttonVariants } from "./button";

interface CalendarProps {
  className?: string;
  selected?: Date | undefined;
  onSelect?: (date: Date | undefined) => void;
  mode?: "single" | "range";
}

function Calendar({ className, selected, onSelect, mode = "single" }: CalendarProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(selected);

  React.useEffect(() => {
    setSelectedDate(selected);
  }, [selected]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let firstDay = new Date(year, month, 1).getDay();
    // Convert Sunday (0) to 6, so Monday becomes 0
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onSelect?.(date);
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
    setCurrentDate(newDate);
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(currentDate);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className={cn("p-4 border rounded-xl bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "size-8 p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronLeft className="size-4" />
        </button>
        <h3 className="text-lg font-semibold">{monthYear}</h3>
        <button
          onClick={() => navigateMonth(1)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "size-8 p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {weeks.map((week, weekIndex) => (
          <React.Fragment key={weekIndex}>
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className="aspect-square"
              >
                {day && (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "w-full h-full p-2 text-sm rounded-lg transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isToday(day) && "bg-primary text-primary-foreground",
                      isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    {formatDate(day)}
                  </button>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export { Calendar };
