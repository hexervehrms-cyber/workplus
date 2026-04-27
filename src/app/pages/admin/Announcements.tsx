import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Megaphone, Plus, Search, Send, Calendar, Users } from 'lucide-react';

export default function AnnouncementsAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Manage organization announcements</p>
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
                    <option>All Employees</option>
                    <option>Management Only</option>
                    <option>Specific Department</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">Priority</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-xl bg-background">
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
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
                <span className="font-semibold">89</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Month</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active</span>
                <span className="font-semibold">3</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Recent Announcements</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-accent/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-1">Office Update {i}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {i === 1 ? 'New parking policy effective next week...' :
                     i === 2 ? 'Team building event this Friday...' :
                     'System maintenance scheduled for weekend...'}
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

      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">All Announcements</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Audience</th>
                <th className="text-left p-4">Priority</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b hover:bg-accent/50">
                  <td className="p-4">
                    <p className="font-medium">Company Announcement {i}</p>
                    <p className="text-sm text-muted-foreground">
                      {i === 1 ? 'New policy updates for all employees...' :
                       i === 2 ? 'Holiday schedule for next quarter...' :
                       i === 3 ? 'Office relocation notice...' :
                       i === 4 ? 'Benefits program enhancement...' :
                       'Training schedule update...'}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {i === 1 ? 'All Employees' :
                       i === 2 ? 'Management Only' :
                       i === 3 ? 'All Employees' :
                       i === 4 ? 'HR Department' : 'All Employees'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      i === 1 ? 'bg-green-100 text-green-800' :
                      i === 2 ? 'bg-yellow-100 text-yellow-800' :
                      i === 3 ? 'bg-red-100 text-red-800' :
                      i === 4 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {i === 1 ? 'Normal' :
                       i === 2 ? 'High' :
                       i === 3 ? 'Urgent' :
                       i === 4 ? 'Normal' : 'High'}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">2024-01-0{i}</p>
                    <p className="text-sm text-muted-foreground">{i} days ago</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      i <= 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {i <= 2 ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        Delete
                      </Button>
                    </div>
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
