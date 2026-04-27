import { useState } from 'react';
import { Clock, LogIn, LogOut, Coffee, Users, Calendar } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';

const attendanceHistory = [
  { date: '2024-04-17', checkIn: '09:00 AM', checkOut: '06:00 PM', hours: '9h 0m', status: 'Present', breaks: '1h 0m' },
  { date: '2024-04-16', checkIn: '09:15 AM', checkOut: '06:15 PM', hours: '9h 0m', status: 'Present', breaks: '1h 0m' },
  { date: '2024-04-15', checkIn: '09:00 AM', checkOut: '06:30 PM', hours: '9h 30m', status: 'Present', breaks: '1h 0m' },
  { date: '2024-04-14', checkIn: '-', checkOut: '-', hours: '-', status: 'Weekend', breaks: '-' },
  { date: '2024-04-13', checkIn: '-', checkOut: '-', hours: '-', status: 'Weekend', breaks: '-' },
  { date: '2024-04-12', checkIn: '09:30 AM', checkOut: '06:00 PM', hours: '8h 30m', status: 'Late', breaks: '1h 0m' },
  { date: '2024-04-11', checkIn: '09:00 AM', checkOut: '06:00 PM', hours: '9h 0m', status: 'Present', breaks: '1h 0m' },
];

const weekStats = [
  { day: 'Mon', hours: 9, status: 'complete' },
  { day: 'Tue', hours: 9, status: 'complete' },
  { day: 'Wed', hours: 9.5, status: 'complete' },
  { day: 'Thu', hours: 8.5, status: 'complete' },
  { day: 'Fri', hours: 7.5, status: 'current' },
  { day: 'Sat', hours: 0, status: 'future' },
  { day: 'Sun', hours: 0, status: 'future' },
];

export default function Attendance() {
  const [status, setStatus] = useState<'working' | 'break' | 'meeting'>('working');
  const [checkedIn, setCheckedIn] = useState(true);

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Attendance</h1>
        <p className="text-muted-foreground">Track your daily attendance and hours</p>
      </div>

      {/* Check In/Out Card */}
      <Card className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Status */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Today's Attendance</h3>
                <p className="text-sm text-muted-foreground">Friday, April 17, 2024</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <LogIn className="w-4 h-4 text-secondary" />
                  <span className="text-sm text-muted-foreground">Check-in</span>
                </div>
                <p className="text-2xl font-bold text-foreground">09:00 AM</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Hours Today</span>
                </div>
                <p className="text-2xl font-bold text-foreground">7h 30m</p>
              </div>
            </div>

            {/* Status Toggle */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Current Status</p>
              <div className="flex gap-2">
                <Button
                  variant={status === 'working' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl"
                  onClick={() => setStatus('working')}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Working
                </Button>
                <Button
                  variant={status === 'break' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl"
                  onClick={() => setStatus('break')}
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Break
                </Button>
                <Button
                  variant={status === 'meeting' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl"
                  onClick={() => setStatus('meeting')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Meeting
                </Button>
              </div>
            </div>
          </div>

          {/* Check Out Button */}
          <div className="flex flex-col justify-between">
            <div className="p-6 rounded-xl bg-background/50 border border-border text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                <Badge className="bg-secondary text-secondary-foreground">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <p className="text-lg font-semibold capitalize">{status}</p>
            </div>
            <Button
              variant="destructive"
              size="lg"
              className="w-full rounded-xl"
              onClick={() => setCheckedIn(false)}
            >
              <LogOut className="w-5 h-5 mr-2" />
              Check Out
            </Button>
          </div>
        </div>
      </Card>

      {/* Weekly Overview */}
      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg mb-6">This Week's Overview</h3>
        <div className="grid grid-cols-7 gap-4">
          {weekStats.map((day, index) => (
            <div key={index} className={`p-4 rounded-xl text-center ${
              day.status === 'current' ? 'bg-primary/10 border border-primary/20' :
              day.status === 'complete' ? 'bg-accent/50' : 'bg-muted/30'
            }`}>
              <p className="text-xs text-muted-foreground mb-2">{day.day}</p>
              <p className="text-2xl font-bold text-foreground mb-1">{day.hours}h</p>
              {day.status === 'complete' && (
                <div className="w-2 h-2 rounded-full bg-secondary mx-auto" />
              )}
              {day.status === 'current' && (
                <div className="w-2 h-2 rounded-full bg-primary mx-auto animate-pulse" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 rounded-xl bg-accent/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Weekly Progress</span>
            <span className="text-sm font-medium">38.5h / 40h</span>
          </div>
          <Progress value={96.25} className="h-2" />
        </div>
      </Card>

      {/* Attendance History */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Attendance History</h3>
          <p className="text-sm text-muted-foreground">Your recent attendance records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-in</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-out</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Hours</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Breaks</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attendanceHistory.map((record, index) => (
                <tr key={index} className="hover:bg-accent/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{record.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{record.checkIn}</td>
                  <td className="px-6 py-4 text-sm">{record.checkOut}</td>
                  <td className="px-6 py-4 text-sm font-medium">{record.hours}</td>
                  <td className="px-6 py-4 text-sm">{record.breaks}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        record.status === 'Present' ? 'default' :
                        record.status === 'Late' ? 'secondary' :
                        'outline'
                      }
                    >
                      {record.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
