import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Megaphone, Plus, Search, Send, Calendar } from 'lucide-react';

export default function Announcements() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Manage system-wide announcements</p>
        </div>
        <Button className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Create New Announcement</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  type="text"
                  placeholder="Enter announcement title..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <textarea
                  placeholder="Enter your announcement message..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background resize-none"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">Target Audience</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-xl bg-background">
                    <option>All Users</option>
                    <option>Super Admins</option>
                    <option>Admins</option>
                    <option>Employees</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">Schedule</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-xl bg-background">
                    <option>Immediate</option>
                    <option>Scheduled</option>
                  </select>
                </div>
              </div>
              <Button className="rounded-xl">
                <Send className="w-4 h-4 mr-2" />
                Send Announcement
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Sent</span>
                <span className="font-semibold">156</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Month</span>
                <span className="font-semibold">23</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active</span>
                <span className="font-semibold">8</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Recent Announcements</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-accent/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-1">System Update {i}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Important system maintenance scheduled...
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>2024-01-0{i}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
