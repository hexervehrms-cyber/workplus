import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  X, 
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Users,
  Building2,
  Save,
  FileText
} from 'lucide-react';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'national' | 'religious' | 'cultural' | 'company';
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

const HolidayCalendar: React.FC<{ isAdmin?: boolean; organizationId?: string }> = ({ 
  isAdmin = false, 
  organizationId = 'ORG-001' 
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'manage' | 'view'>('generate');
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [calendars, setCalendars] = useState<HolidayCalendar[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [calendarName, setCalendarName] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    loadHolidays();
    loadCalendars();
  }, [organizationId]);

  const loadHolidays = async () => {
    try {
      const response = await fetch(`/api/holidays/organization/${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      } else {
        console.error('Failed to load holidays');
      }
    } catch (error) {
      console.error('Error loading holidays:', error);
    }
  };

  const loadCalendars = async () => {
    try {
      const response = await fetch(`/api/holiday-calendars/organization/${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setCalendars(data);
      } else {
        console.error('Failed to load calendars');
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setShowAddHoliday(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setShowAddHoliday(true);
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      const response = await fetch(`/api/holidays/${holidayId}`, { method: 'DELETE' });
      
      if (response.ok) {
        setHolidays(prev => prev.filter(h => h.id !== holidayId));
      } else {
        alert('Failed to delete holiday');
      }
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Failed to delete holiday');
    }
  };

  const handleSaveHoliday = async (holidayData: Partial<Holiday>) => {
    try {
      if (editingHoliday) {
        // Update existing holiday
        const response = await fetch(`/api/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(holidayData)
        });
        
        if (response.ok) {
          setHolidays(prev => prev.map(h => 
            h.id === editingHoliday.id 
              ? { ...h, ...holidayData, updatedAt: new Date().toISOString() }
              : h
          ));
        }
      } else {
        // Add new holiday
        const newHoliday: Holiday = {
          id: `hol_${Date.now()}`,
          name: holidayData.name!,
          date: holidayData.date!,
          type: holidayData.type!,
          description: holidayData.description!,
          isRecurring: holidayData.isRecurring || false,
          organizationId,
          createdBy: 'admin',
          createdAt: new Date().toISOString()
        };
        
        const response = await fetch('/api/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newHoliday)
        });
        
        if (response.ok) {
          setHolidays(prev => [...prev, newHoliday]);
        }
      }
      
      setShowAddHoliday(false);
      setEditingHoliday(null);
    } catch (error) {
      console.error('Error saving holiday:', error);
      alert('Failed to save holiday');
    }
  };

  const handleGenerateCalendar = async () => {
    if (!calendarName.trim()) {
      alert('Please enter a calendar name');
      return;
    }

    setLoading(true);
    try {
      const newCalendar: HolidayCalendar = {
        id: `cal_${Date.now()}`,
        name: calendarName,
        year: selectedYear,
        organizationId,
        holidays: holidays.filter(h => new Date(h.date).getFullYear() === selectedYear),
        isPublished: isPublished,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/holiday-calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCalendar)
      });

      if (response.ok) {
        setCalendars(prev => [...prev, newCalendar]);
        setCalendarName('');
        setIsPublished(false);
        alert('Holiday calendar generated successfully!');
      } else {
        alert('Failed to generate calendar');
      }
    } catch (error) {
      console.error('Error generating calendar:', error);
      alert('Failed to generate calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishCalendar = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/holiday-calendars/${calendarId}/publish`, {
        method: 'POST'
      });

      if (response.ok) {
        setCalendars(prev => prev.map(cal => 
          cal.id === calendarId 
            ? { ...cal, isPublished: true, updatedAt: new Date().toISOString() }
            : cal
        ));
        alert('Calendar published successfully!');
      } else {
        alert('Failed to publish calendar');
      }
    } catch (error) {
      console.error('Error publishing calendar:', error);
      alert('Failed to publish calendar');
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

  const filteredHolidays = holidays.filter(holiday => {
    const matchesSearch = holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         holiday.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || holiday.type === filterType;
    const matchesYear = new Date(holiday.date).getFullYear() === selectedYear;
    return matchesSearch && matchesType && matchesYear;
  });

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'national': return 'bg-blue-100 text-blue-800';
      case 'religious': return 'bg-green-100 text-green-800';
      case 'cultural': return 'bg-purple-100 text-purple-800';
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Holiday Calendar Generator</h3>
            <p className="text-sm text-muted-foreground">Create and manage holiday calendars for your organization</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'generate' ? 'default' : 'outline'}
          onClick={() => setActiveTab('generate')}
          className="rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Calendar
        </Button>
        <Button
          variant={activeTab === 'manage' ? 'default' : 'outline'}
          onClick={() => setActiveTab('manage')}
          className="rounded-xl"
        >
          <Edit className="w-4 h-4 mr-2" />
          Manage Holidays
        </Button>
        <Button
          variant={activeTab === 'view' ? 'default' : 'outline'}
          onClick={() => setActiveTab('view')}
          className="rounded-xl"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Calendars
        </Button>
      </div>

      {/* Generate Calendar Tab */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h4 className="font-semibold text-lg mb-4">Generate Holiday Calendar</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Calendar Name *</Label>
                <Input
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g., Holiday Calendar 2024"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Year *</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="publish-calendar"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="publish-calendar">Publish immediately (visible to all employees)</Label>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                onClick={handleGenerateCalendar}
                disabled={loading || !calendarName.trim()}
                className="rounded-xl"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Generate Calendar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCalendarPreview(true)}
                disabled={holidays.length === 0}
                className="rounded-xl"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Holidays</p>
                  <p className="font-semibold">{holidays.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Published</p>
                  <p className="font-semibold">{calendars.filter(c => c.isPublished).length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-semibold">{organizationId}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Visible To</p>
                  <p className="font-semibold">All Employees</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Manage Holidays Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search holidays..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-xl w-64"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="rounded-xl w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="religious">Religious</SelectItem>
                  <SelectItem value="cultural">Cultural</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="rounded-xl w-32">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddHoliday} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Holiday
            </Button>
          </div>

          <div className="space-y-3">
            {filteredHolidays.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium text-muted-foreground">No holidays found</h4>
                <p className="text-sm text-muted-foreground">Add your first holiday to get started</p>
              </div>
            ) : (
              filteredHolidays.map((holiday) => (
                <Card key={holiday.id} className="p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{holiday.name}</h4>
                          <Badge className={getHolidayTypeColor(holiday.type)}>
                            {holiday.type}
                          </Badge>
                          {holiday.isRecurring && (
                            <Badge variant="outline" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatDate(holiday.date)}</span>
                          <span>·</span>
                          <span>{holiday.description}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleEditHoliday(holiday)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-destructive hover:text-destructive"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* View Calendars Tab */}
      {activeTab === 'view' && (
        <div className="space-y-4">
          {calendars.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-muted-foreground">No calendars generated yet</h4>
              <p className="text-sm text-muted-foreground">Generate your first calendar to see it here</p>
            </div>
          ) : (
            calendars.map((calendar) => (
              <Card key={calendar.id} className="p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{calendar.name}</h4>
                        {calendar.isPublished && (
                          <Badge className="bg-green-100 text-green-800">
                            Published
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{calendar.year}</span>
                        <span>·</span>
                        <span>{calendar.holidays.length} holidays</span>
                        <span>·</span>
                        <span>Created {new Date(calendar.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleDownloadCalendar(calendar.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    {!calendar.isPublished && (
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handlePublishCalendar(calendar.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Publish
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Holiday Modal */}
      {showAddHoliday && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
              </h2>
              <Button variant="ghost" onClick={() => setShowAddHoliday(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Holiday Name *</Label>
                <Input
                  defaultValue={editingHoliday?.name}
                  placeholder="Enter holiday name"
                  className="mt-2 rounded-xl"
                  id="holiday-name"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  defaultValue={editingHoliday?.date}
                  className="mt-2 rounded-xl"
                  id="holiday-date"
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select defaultValue={editingHoliday?.type}>
                  <SelectTrigger className="mt-2 rounded-xl" id="holiday-type">
                    <SelectValue placeholder="Select holiday type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="religious">Religious</SelectItem>
                    <SelectItem value="cultural">Cultural</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  defaultValue={editingHoliday?.description}
                  placeholder="Enter holiday description"
                  className="mt-2 rounded-xl"
                  rows={3}
                  id="holiday-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="holiday-recurring"
                  defaultChecked={editingHoliday?.isRecurring}
                  className="rounded"
                />
                <Label htmlFor="holiday-recurring">Recurring holiday (repeats every year)</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const holidayData = {
                  name: (document.getElementById('holiday-name') as HTMLInputElement).value,
                  date: (document.getElementById('holiday-date') as HTMLInputElement).value,
                  type: (document.getElementById('holiday-type') as HTMLSelectElement).value as 'national' | 'religious' | 'cultural' | 'company',
                  description: (document.getElementById('holiday-description') as HTMLTextAreaElement).value,
                  isRecurring: (document.getElementById('holiday-recurring') as HTMLInputElement).checked
                };
                handleSaveHoliday(holidayData);
              }}>
                {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HolidayCalendar;
