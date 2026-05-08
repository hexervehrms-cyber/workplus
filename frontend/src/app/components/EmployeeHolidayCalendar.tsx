import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Calendar, 
  Download, 
  Search, 
  Filter,
  MapPin,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Holiday {
  id: string;
  _id?: string;
  name: string;
  date: string;
  type: 'public' | 'optional' | 'restricted';
  description: string;
  isRecurring: boolean;
  organizationId: string;
  createdBy: string;
  createdAt: string;
}

interface HolidayCalendar {
  id: string;
  name: string;
  year: number;
  organizationId: string;
  holidays: Holiday[];
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const EmployeeHolidayCalendar: React.FC<{ organizationId?: string }> = ({ 
  organizationId = 'ORG-001' 
}) => {
  const [calendars, setCalendars] = useState<HolidayCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<HolidayCalendar | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadCalendars();
  }, [organizationId, selectedYear]);

  const loadCalendars = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }
      
      // Load holidays for the selected year
      const response = await fetch(`/api/holidays?year=${selectedYear}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const holidays = data.data || [];
        
        // Create a calendar object from the holidays
        const calendar: HolidayCalendar = {
          id: `cal_${selectedYear}`,
          name: `Holiday Calendar ${selectedYear}`,
          year: selectedYear,
          organizationId,
          holidays: holidays,
          isPublished: true,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setCalendars([calendar]);
        setSelectedCalendar(calendar);
      } else {
        console.error('Failed to load holidays');
        setCalendars([]);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCalendar = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/holiday-calendars/${calendarId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'holiday-calendar.pdf';
        a.click();
      } else {
        alert('Failed to download calendar');
      }
    } catch (error) {
      console.error('Error downloading calendar:', error);
      alert('Failed to download calendar');
    }
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'public': return 'bg-blue-100 text-blue-800';
      case 'optional': return 'bg-green-100 text-green-800';
      case 'restricted': return 'bg-purple-100 text-purple-800';
      case 'company': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getUpcomingHolidays = () => {
    if (!selectedCalendar) return [];
    
    const today = new Date();
    return selectedCalendar.holidays
      .filter(holiday => new Date(holiday.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  };

  const filteredHolidays = selectedCalendar?.holidays.filter(holiday => {
    const matchesSearch = holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         holiday.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || holiday.type === filterType;
    return matchesSearch && matchesType;
  }) || [];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Holiday Calendar</h3>
            <p className="text-sm text-muted-foreground">View holidays and festivals for your organization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{organizationId}</span>
        </div>
      </div>

      {/* Calendar Selection */}
      {calendars.length > 0 && (
        <Card className="p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">Select Calendar</h4>
            <Select value={selectedYear.toString()} onValueChange={(value) => {
              const year = parseInt(value);
              setSelectedYear(year);
              const calendar = calendars.find(cal => cal.isPublished && cal.year === year);
              setSelectedCalendar(calendar || null);
            }}>
              <SelectTrigger className="rounded-xl w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {calendars.filter(cal => cal.isPublished).map(cal => (
                  <SelectItem key={cal.year} value={cal.year.toString()}>
                    {cal.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {calendars.filter(cal => cal.isPublished).map((calendar) => (
              <Card
                key={calendar.id}
                className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                  selectedCalendar?.id === calendar.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedCalendar(calendar)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">{calendar.name}</h5>
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Published
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {calendar.holidays.length} holidays
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {selectedCalendar && (
        <>
          {/* Upcoming Holidays */}
          <Card className="p-6 rounded-xl">
            <h4 className="font-semibold mb-4">Upcoming Holidays</h4>
            <div className="space-y-3">
              {getUpcomingHolidays().length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming holidays</p>
                </div>
              ) : (
                getUpcomingHolidays().map((holiday) => (
                  <div key={holiday.id} className="flex items-center gap-3 p-3 rounded-lg border border-green-200" style={{ backgroundColor: '#F0FDF4' }}>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-sm">{holiday.name}</h5>
                        <Badge className={getHolidayTypeColor(holiday.type)} variant="outline">
                          {holiday.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(holiday.date)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search holidays..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="rounded-xl w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="public">Public Holiday</SelectItem>
                <SelectItem value="optional">Optional Holiday</SelectItem>
                <SelectItem value="restricted">Restricted Holiday</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleDownloadCalendar(selectedCalendar.id)}
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>

          {/* Holiday List */}
          <Card className="p-6 rounded-xl">
            <h4 className="font-semibold mb-4">
              {selectedCalendar.name} - {selectedCalendar.year}
            </h4>
            <div className="space-y-3">
              {filteredHolidays.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-medium text-muted-foreground">No holidays found</h4>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || filterType !== 'all'
                      ? 'Try adjusting your search or filter criteria'
                      : 'No holidays available for this calendar'}
                  </p>
                </div>
              ) : (
                filteredHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium">{holiday.name}</h5>
                          <Badge className={getHolidayTypeColor(holiday.type)}>
                            {holiday.type}
                          </Badge>
                          {holiday.isRecurring && (
                            <Badge variant="outline" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(holiday.date)}
                        </div>
                        {holiday.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {holiday.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {new Date(holiday.date) >= new Date() ? (
                          <span className="text-green-600">Upcoming</span>
                        ) : (
                          <span className="text-gray-500">Past</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {calendars.length === 0 && !loading && (
        <Card className="p-12 rounded-xl text-center">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h4 className="font-semibold text-lg mb-2">No Holiday Calendars Available</h4>
          <p className="text-muted-foreground">
            Holiday calendars will appear here once your admin publishes them.
          </p>
        </Card>
      )}
    </div>
  );
};

export default EmployeeHolidayCalendar;
