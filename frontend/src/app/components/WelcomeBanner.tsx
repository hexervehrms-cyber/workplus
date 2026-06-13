import { Sparkles, ArrowRight } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { useNavigate } from 'react-router';

export function WelcomeBanner() {
  const navigate = useNavigate();
  
  return (
    <Card className="p-8 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-white border-0 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-6 h-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">Welcome to WorkPlus Pro</span>
            </div>
            <h2 className="text-3xl font-bold mb-3">Premium HRMS Platform</h2>
            <p className="text-white/90 max-w-2xl mb-6">
              Experience enterprise-level HR management with our comprehensive suite of tools. 
              Switch between roles using the switcher at the bottom right to explore different dashboards.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="secondary" 
                className="rounded-xl"
                onClick={() => navigate('/super-admin/organizations')}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl bg-white/20 border-white/30 hover:bg-white/30 text-white"
                onClick={() => window.open('https://docs.workplus.app', '_blank')}
              >
                View Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
