import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Edit, Lock, Globe } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { useCurrency } from '../../context/CurrencyContext';
import CurrencySelector from '../../components/CurrencySelector';
import { useState } from 'react';

const documents = [
  { name: 'Resume.pdf', size: '245 KB', uploadedAt: '2024-01-15', status: 'Verified' },
  { name: 'ID_Proof.pdf', size: '1.2 MB', uploadedAt: '2024-01-15', status: 'Verified' },
  { name: 'Education_Certificate.pdf', size: '890 KB', uploadedAt: '2024-01-15', status: 'Verified' },
  { name: 'Address_Proof.pdf', size: '675 KB', uploadedAt: '2024-01-15', status: 'Pending' },
];

const experienceDocuments = [
  { name: 'Experience_Letter.pdf', size: '345 KB', uploadedAt: '2024-01-20', status: 'Verified' },
  { name: 'Offer_Letter.pdf', size: '567 KB', uploadedAt: '2024-01-20', status: 'Verified' },
  { name: 'Relieving_Letter.pdf', size: '234 KB', uploadedAt: '2024-01-20', status: 'Pending' },
  { name: 'Appraisal_Letter_2023.pdf', size: '890 KB', uploadedAt: '2024-01-20', status: 'Verified' },
  { name: 'Salary_Slips_Jan2024.pdf', size: '1.2 MB', uploadedAt: '2024-01-20', status: 'Verified' },
  { name: 'Bank_Statement.pdf', size: '2.3 MB', uploadedAt: '2024-01-20', status: 'Pending' },
];

export default function Profile() {
  const { selectedCurrency, formatCurrency } = useCurrency();
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and documents</p>
      </div>

      {/* Profile Completion */}
      <Card className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Profile Completion</h3>
            <p className="text-sm text-muted-foreground">Complete your profile to unlock all features</p>
          </div>
          <Button variant="outline" className="rounded-xl">Complete Profile</Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-medium">75%</span>
          </div>
          <Progress value={75} className="h-2" />
          <p className="text-xs text-muted-foreground">Add emergency contact and banking details to complete</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 rounded-2xl text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 rounded-full w-10 h-10"
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-2xl font-bold mb-1">John Doe</h2>
            <p className="text-muted-foreground mb-4">Senior Software Engineer</p>
            <Badge className="mb-6">Full-time Employee</Badge>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>john.doe@workplus.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>San Francisco, CA</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Joined Jan 2022</span>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-medium">EMP-2024-001</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">Engineering</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reporting To</span>
                <span className="font-medium">Sarah Johnson</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Personal Information</h3>
              <Button variant="outline" size="sm" className="rounded-xl">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>First Name</Label>
                <Input value="John" className="mt-2 rounded-xl" />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value="Doe" className="mt-2 rounded-xl" />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input value="john.doe@workplus.com" className="mt-2 rounded-xl" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value="+1 (555) 123-4567" className="mt-2 rounded-xl" />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value="1990-05-15" className="mt-2 rounded-xl" />
              </div>
              <div>
                <Label>Gender</Label>
                <Input value="Male" className="mt-2 rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input value="123 Main St, Apt 4B, San Francisco, CA 94102" className="mt-2 rounded-xl" />
              </div>
            </div>
          </Card>

          {/* Official Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Official Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Employee ID</Label>
                <Input value="EMP-2024-001" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input type="date" value="2022-01-15" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Department</Label>
                <Input value="Engineering" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value="Senior Software Engineer" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Employment Type</Label>
                <Input value="Full-time" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Work Location</Label>
                <Input value="San Francisco Office" disabled className="mt-2 rounded-xl bg-muted" />
              </div>
            </div>
          </Card>

          {/* Currency Settings */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Currency Settings</h3>
                  <p className="text-sm text-muted-foreground">Choose your preferred currency</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCurrencySelector(true)}
                className="rounded-xl"
              >
                <Edit className="w-4 h-4 mr-2" />
                Change
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                  <span className="text-lg font-bold">{selectedCurrency.symbol}</span>
                </div>
                <div>
                  <div className="font-medium">{selectedCurrency.code}</div>
                  <div className="text-sm text-muted-foreground">{selectedCurrency.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Example:</div>
                <div className="font-semibold">{formatCurrency(1000)}</div>
              </div>
            </div>
          </Card>

          {/* Sensitive Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Sensitive Information</h3>
                <p className="text-sm text-muted-foreground">Locked fields for security</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Aadhar Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value="**** **** ****" disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>PAN Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value="*****1234" disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Bank Account</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value="*********4567" disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>IFSC Code</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value="HDFC0001234" disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Documents */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Documents</h3>
                <p className="text-sm text-muted-foreground">Upload and manage your documents</p>
              </div>
              <Button className="rounded-xl">
                <FileText className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
            <div className="divide-y divide-border">
              {documents.map((doc, index) => (
                <div key={index} className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{doc.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {doc.size} • Uploaded {doc.uploadedAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={doc.status === 'Verified' ? 'default' : 'secondary'}>
                      {doc.status}
                    </Badge>
                    <Button variant="outline" size="sm" className="rounded-xl">View</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Experience */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Experience</h3>
                <p className="text-sm text-muted-foreground">Upload and manage your experience documents</p>
              </div>
              <Button className="rounded-xl">
                <FileText className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
            <div className="divide-y divide-border">
              {experienceDocuments.map((doc: any, index: number) => (
                <div key={index} className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{doc.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {doc.size} • Uploaded {doc.uploadedAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={doc.status === 'Verified' ? 'default' : 'secondary'}>
                      {doc.status}
                    </Badge>
                    <Button variant="outline" size="sm" className="rounded-xl">View</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Currency Selector Modal */}
      {showCurrencySelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CurrencySelector 
              onClose={() => setShowCurrencySelector(false)}
              showSaveButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
} 
