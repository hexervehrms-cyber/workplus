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
import {
  appendOrgIdParam,
  apiDelete,
  apiFetchBlob,
  apiGet,
  apiPost,
  apiPut,
  clearApiCache,
} from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/portalToast';

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

interface HolidayCalendarRecord {
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
  organizationId 
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'generate' | 'manage' | 'view'>('generate');
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [previewHolidays, setPreviewHolidays] = useState<Holiday[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [calendars, setCalendars] = useState<HolidayCalendarRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [calendarName, setCalendarName] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  
  // Form state for Add/Edit Holiday modal
  const [holidayFormData, setHolidayFormData] = useState({
    name: '',
    date: '',
    type: 'public' as 'public' | 'optional' | 'restricted',
    description: '',
    isRecurring: false
  });

  useEffect(() => {
    if (!organizationId) {
      setHolidays([]);
      return;
    }
    loadHolidays();
    loadCalendars();
  }, [organizationId, selectedYear]);

  const loadHolidays = async () => {
    try {
      if (!organizationId) {
        setHolidays([]);
        return;
      }
      const data = await apiGet<{ data?: Holiday[] }>(
        appendOrgIdParam(`holidays?year=${selectedYear}&limit=500`, user, organizationId),
        false
      );
      setHolidays(data?.data || []);
    } catch (error) {
      console.error('Error loading holidays:', error);
      setHolidays([]);
    }
  };

  const loadCalendars = async () => {
    try {
      // Get all holiday calendars
      const data = await apiGet<{ data?: { calendar?: Record<string, Holiday[]> } }>(
        appendOrgIdParam(`holidays/calendar/${selectedYear}`, user, organizationId),
        false
      );
      if (data?.data?.calendar) {
          const calendarData: HolidayCalendarRecord = {
            id: `cal_${selectedYear}`,
            name: `Holiday Calendar ${selectedYear}`,
            year: selectedYear,
            organizationId,
            holidays: (data.data.calendar ? Object.values(data.data.calendar).flat() : []) as Holiday[],
            isPublished: true,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setCalendars([calendarData]);
      } else {
        setCalendars([]);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      setCalendars([]);
    }
  };

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayFormData({
      name: '',
      date: '',
      type: 'public',
      description: '',
      isRecurring: false
    });
    setShowAddHoliday(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setHolidayFormData({
      name: holiday.name,
      date: holiday.date,
      type: holiday.type,
      description: holiday.description,
      isRecurring: holiday.isRecurring
    });
    setShowAddHoliday(true);
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      await apiDelete(appendOrgIdParam(`holidays/${holidayId}`, user, organizationId));
      setHolidays((prev) => prev.filter((h) => (h._id || h.id) !== holidayId));
      alert('Holiday deleted successfully!');
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Failed to delete holiday: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSaveHoliday = async () => {
    if (!organizationId) {
      toast.error('Organization context is required to save holidays');
      return;
    }
    if (!holidayFormData.name.trim()) {
      alert('Please enter holiday name');
      return;
    }
    if (!holidayFormData.date) {
      alert('Please select a date');
      return;
    }

    try {
      if (editingHoliday) {
        const holidayId = editingHoliday._id || editingHoliday.id;
        const updatedHoliday = await apiPut<{ data?: Holiday & { _id?: string } }>(
          appendOrgIdParam(`holidays/${holidayId}`, user, organizationId),
          {
            orgId: organizationId,
            name: holidayFormData.name,
            date: holidayFormData.date,
            type: holidayFormData.type,
            description: holidayFormData.description,
            isRecurring: holidayFormData.isRecurring,
          }
        );
        setHolidays((prev) =>
          prev.map((h) =>
            (h._id || h.id) === holidayId
              ? { ...h, ...updatedHoliday?.data, id: updatedHoliday?.data?._id }
              : h
          )
        );
        alert('Holiday updated successfully!');
      } else {
        const newHolidayData = await apiPost<{ data?: Holiday & { _id?: string } }>(
          appendOrgIdParam('holidays', user, organizationId),
          {
            orgId: organizationId,
            name: holidayFormData.name,
            date: holidayFormData.date,
            type: holidayFormData.type,
            description: holidayFormData.description,
            isRecurring: holidayFormData.isRecurring,
          }
        );

        if (newHolidayData?.data) {
          const newHoliday: Holiday = {
            id: newHolidayData.data._id,
            _id: newHolidayData.data._id,
            name: newHolidayData.data.name,
            date: newHolidayData.data.date,
            type: newHolidayData.data.type,
            description: newHolidayData.data.description,
            isRecurring: newHolidayData.data.isRecurring,
            organizationId,
            createdBy: 'admin',
            createdAt: new Date().toISOString()
          };
          setHolidays(prev => [...prev, newHoliday]);
          alert('Holiday added successfully!');
        } else {
          alert('Failed to add holiday');
        }
      }
      
      setShowAddHoliday(false);
      setEditingHoliday(null);
      setHolidayFormData({
        name: '',
        date: '',
        type: 'public',
        description: '',
        isRecurring: false
      });
      clearApiCache('/holidays');
      loadHolidays();
    } catch (error) {
      console.error('Error saving holiday:', error);
      const msg =
        error instanceof Error ? error.message : 'Failed to save holiday';
      toast.error(msg.includes('Route not found') ? 'Holiday API unavailable — redeploy backend or contact support.' : msg);
    }
  };

  const handleGenerateCalendar = async () => {
    if (!calendarName.trim()) {
      toast.error('Please enter a calendar name');
      return;
    }

    // Filter holidays for the selected year
    const holidaysForYear = holidays.filter(h => {
      const holidayYear = new Date(h.date).getFullYear();
      return holidayYear === selectedYear;
    });

    if (holidaysForYear.length === 0) {
      toast.error(`No holidays found for year ${selectedYear}. Add holidays in Manage Holidays first.`);
      return;
    }

    setLoading(true);
    try {
      // For now, we'll just create a local calendar object
      // In a real app, you'd save this to the backend
      const newCalendar: HolidayCalendarRecord = {
        id: `cal_${Date.now()}`,
        name: calendarName,
        year: selectedYear,
        organizationId,
        holidays: holidaysForYear,
        isPublished: isPublished,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to local state
      setCalendars(prev => [...prev, newCalendar]);
      setCalendarName('');
      setIsPublished(false);
      toast.success(`Calendar "${calendarName}" created with ${holidaysForYear.length} holidays`);
      setActiveTab('view');
    } catch (error) {
      console.error('Error generating calendar:', error);
      toast.error('Failed to generate calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishCalendar = async (calendarId: string) => {
    try {
      await apiPost(
        appendOrgIdParam(`holidays/calendars/${calendarId}/publish`, user, organizationId),
        {}
      );
      setCalendars((prev) =>
        prev.map((cal) =>
          cal.id === calendarId
            ? { ...cal, isPublished: true, updatedAt: new Date().toISOString() }
            : cal
        )
      );
      toast.success('Calendar published successfully');
    } catch (error) {
      console.error('Error publishing calendar:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish calendar'
      );
    }
  };

  const openCalendarPreview = (title: string, list: Holiday[]) => {
    setPreviewTitle(title);
    setPreviewHolidays(list);
    setShowCalendarPreview(true);
  };

  const handleViewCalendar = (calendar: HolidayCalendarRecord) => {
    openCalendarPreview(calendar.name, calendar.holidays || []);
  };

  const handleDownloadCalendar = async (calendarId: string) => {
    try {
      const blob = await apiFetchBlob(
        appendOrgIdParam(`holidays/calendars/${calendarId}/download`, user, organizationId)
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `holiday-calendar-${selectedYear}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Calendar downloaded');
    } catch (error) {
      console.error('Error downloading calendar:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to download calendar'
      );
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
      case 'public': return 'bg-blue-100 text-blue-800';
      case 'optional': return 'bg-green-100 text-green-800';
      case 'restricted': return 'bg-purple-100 text-purple-800';
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
          type="button"
          variant={activeTab === 'generate' ? 'default' : 'outline'}
          onClick={() => setActiveTab('generate')}
          className="rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Calendar
        </Button>
        <Button
          type="button"
          variant={activeTab === 'manage' ? 'default' : 'outline'}
          onClick={() => setActiveTab('manage')}
          className="rounded-xl"
        >
          <Edit className="w-4 h-4 mr-2" />
          Manage Holidays
        </Button>
        <Button
          type="button"
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
                type="button"
                onClick={() => void handleGenerateCalendar()}
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
                type="button"
                variant="outline"
                onClick={() => {
                  const holidaysForYear = holidays.filter((h) => {
                    const holidayYear = new Date(h.date).getFullYear();
                    return holidayYear === selectedYear;
                  });
                  openCalendarPreview(`Preview ${selectedYear}`, holidaysForYear);
                }}
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
                  <SelectItem value="public">Public Holiday</SelectItem>
                  <SelectItem value="optional">Optional Holiday</SelectItem>
                  <SelectItem value="restricted">Restricted Holiday</SelectItem>
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
            <Button type="button" onClick={handleAddHoliday} className="rounded-xl">
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
                <Card key={holiday._id || holiday.id} className="p-4 rounded-xl">
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
                        onClick={() => handleDeleteHoliday(holiday._id || holiday.id)}
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
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleViewCalendar(calendar)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Calendar
                    </Button>
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
                  value={holidayFormData.name}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, name: e.target.value })}
                  placeholder="Enter holiday name"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={holidayFormData.date}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, date: e.target.value })}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={holidayFormData.type} onValueChange={(value) => setHolidayFormData({ ...holidayFormData, type: value as 'public' | 'optional' | 'restricted' })}>
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Select holiday type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public Holiday</SelectItem>
                    <SelectItem value="optional">Optional Holiday</SelectItem>
                    <SelectItem value="restricted">Restricted Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={holidayFormData.description}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, description: e.target.value })}
                  placeholder="Enter holiday description"
                  className="mt-2 rounded-xl"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="holiday-recurring"
                  checked={holidayFormData.isRecurring}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, isRecurring: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="holiday-recurring">Recurring holiday (repeats every year)</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveHoliday}>
                {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Calendar Preview Modal */}
      {showCalendarPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{previewTitle || 'Calendar Preview'}</h2>
              <Button type="button" variant="ghost" onClick={() => setShowCalendarPreview(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              {/* Calendar Header */}
              <div className="text-center">
                <h3 className="text-2xl font-bold">{previewTitle || `Holiday Calendar ${selectedYear}`}</h3>
                <p className="text-muted-foreground">Organization: {organizationId}</p>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const monthDate = new Date(selectedYear, monthIndex, 1);
                  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });
                  const monthHolidays = previewHolidays.filter(holiday => {
                    const holidayDate = new Date(holiday.date);
                    return holidayDate.getMonth() === monthIndex && holidayDate.getFullYear() === selectedYear;
                  });

                  return (
                    <Card key={monthIndex} className="p-4 rounded-xl">
                      <h4 className="font-semibold text-center mb-3">{monthName} {selectedYear}</h4>
                      <div className="space-y-2">
                        {monthHolidays.length > 0 ? (
                          monthHolidays.map((holiday) => (
                            <div key={holiday._id || holiday.id} className="p-2 rounded-lg border border-green-200" style={{ backgroundColor: '#F0FDF4' }}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{holiday.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(holiday.date).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </p>
                                </div>
                                <Badge className={getHolidayTypeColor(holiday.type)} variant="outline">
                                  {holiday.type}
                                </Badge>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground">No holidays</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Summary */}
              <Card className="p-4 rounded-xl bg-accent/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{previewHolidays.filter(h => new Date(h.date).getFullYear() === selectedYear).length}</p>
                    <p className="text-sm text-muted-foreground">Total Holidays</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{holidays.filter(h => h.type === 'public' && new Date(h.date).getFullYear() === selectedYear).length}</p>
                    <p className="text-sm text-muted-foreground">Public Holidays</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{previewHolidays.filter(h => h.type === 'optional' && new Date(h.date).getFullYear() === selectedYear).length}</p>
                    <p className="text-sm text-muted-foreground">Optional Holidays</p>
                  </div>
                </div>
              </Card>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HolidayCalendar;
