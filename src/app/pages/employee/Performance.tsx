import { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, CheckCircle, AlertCircle, Trophy } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAuth } from '../../context/AuthContext';

interface PerformanceData {
  month: string;
  score: number;
}

interface SkillData {
  skill: string;
  score: number;
}

interface KPI {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning';
}

interface Achievement {
  title: string;
  description: string;
  date: string;
  icon: any;
  color: string;
}

interface TeamMember {
  rank: number;
  name: string;
  score: number;
  avatar: string;
  isYou?: boolean;
}

export default function Performance() {
  const { user } = useAuth();
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [skillsData, setSkillsData] = useState<SkillData[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [teamRanking, setTeamRanking] = useState<TeamMember[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformanceData();
  }, [user]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch performance data from API
      const response = await fetch(`/api/performance/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.performanceTrend || []);
        setSkillsData(data.skills || []);
        setKpis(data.kpis || []);
        setAchievements(data.achievements || []);
        setTeamRanking(data.teamRanking || []);
        setOverallScore(data.overallScore || 0);
      } else {
        // Fallback to default data if API fails
        setPerformanceData([
          { month: 'Jan', score: 85 },
          { month: 'Feb', score: 88 },
          { month: 'Mar', score: 92 },
          { month: 'Apr', score: 89 },
          { month: 'May', score: 95 },
          { month: 'Jun', score: 92 },
        ]);
        setSkillsData([
          { skill: 'Communication', score: 95 },
          { skill: 'Technical', score: 88 },
          { skill: 'Leadership', score: 82 },
          { skill: 'Teamwork', score: 92 },
          { skill: 'Problem Solving', score: 90 },
          { skill: 'Time Management', score: 85 },
        ]);
        setKpis([
          { name: 'Task Completion Rate', value: 95, target: 90, status: 'good' },
          { name: 'Quality Score', value: 88, target: 85, status: 'good' },
          { name: 'Attendance', value: 98, target: 95, status: 'good' },
          { name: 'Customer Satisfaction', value: 82, target: 85, status: 'warning' },
        ]);
        setAchievements([
          { title: 'Top Performer', description: 'Ranked #3 in Q1 2024', date: 'March 2024', icon: Trophy, color: 'text-accent' },
          { title: 'Perfect Attendance', description: '100% attendance for 3 months', date: 'February 2024', icon: Award, color: 'text-secondary' },
          { title: 'Quick Learner', description: 'Completed 5 certifications', date: 'January 2024', icon: Target, color: 'text-primary' },
        ]);
        setTeamRanking([
          { rank: 1, name: 'Sarah Johnson', score: 98, avatar: 'SJ' },
          { rank: 2, name: 'Mike Chen', score: 96, avatar: 'MC' },
          { rank: 3, name: user?.name || 'You', score: 92, avatar: 'JD', isYou: true },
          { rank: 4, name: 'Emma Wilson', score: 88, avatar: 'EW' },
          { rank: 5, name: 'Alex Brown', score: 85, avatar: 'AB' },
        ]);
        setOverallScore(92);
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
      // Set default data on error
      setPerformanceData([
        { month: 'Jan', score: 85 },
        { month: 'Feb', score: 88 },
        { month: 'Mar', score: 92 },
        { month: 'Apr', score: 89 },
        { month: 'May', score: 95 },
        { month: 'Jun', score: 92 },
      ]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Performance Dashboard</h1>
        <p className="text-muted-foreground">Track your performance metrics and goals</p>
      </div>

      {/* Overall Performance Card */}
      <Card className="p-8 rounded-2xl bg-gradient-to-br from-secondary/10 to-primary/10 border-secondary/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg text-muted-foreground mb-2">Overall Performance Score</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-foreground">{overallScore}</span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge className="bg-secondary text-secondary-foreground">Excellent</Badge>
              <span className="text-sm text-muted-foreground">+5 points from last month</span>
            </div>
          </div>
          <div className="w-32 h-32 rounded-full bg-secondary/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-8 border-secondary" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 92%, 0 92%)' }} />
            <TrendingUp className="w-16 h-16 text-secondary" />
          </div>
        </div>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <Card key={index} className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">{kpi.name}</h4>
              {kpi.status === 'good' ? (
                <CheckCircle className="w-5 h-5 text-secondary" />
              ) : (
                <AlertCircle className="w-5 h-5 text-accent" />
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold">{kpi.value}%</span>
              <span className="text-sm text-muted-foreground">/ {kpi.target}%</span>
            </div>
            <Progress 
              value={kpi.value} 
              className={`h-2 ${kpi.status === 'good' ? '[&>div]:bg-secondary' : '[&>div]:bg-accent'}`} 
            />
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" domain={[0, 100]} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#22C55E" 
                strokeWidth={3} 
                dot={{ fill: '#22C55E', r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Skills Radar */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Skills Assessment</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={skillsData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="skill" stroke="#6B7280" fontSize={12} />
              <PolarRadiusAxis domain={[0, 100]} stroke="#6B7280" />
              <Radar 
                name="Score" 
                dataKey="score" 
                stroke="#4F46E5" 
                fill="#4F46E5" 
                fillOpacity={0.3} 
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Achievements & Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achievements */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Recent Achievements</h3>
          <div className="space-y-4">
            {achievements.map((achievement, index) => {
              const Icon = achievement.icon;
              return (
                <div key={index} className="flex gap-4 p-4 rounded-xl bg-accent/50">
                  <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center ${achievement.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{achievement.title}</h4>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{achievement.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Team Ranking */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Team Ranking</h3>
          <div className="space-y-3">
            {teamRanking.map((member) => (
              <div 
                key={member.rank} 
                className={`flex items-center gap-4 p-4 rounded-xl ${
                  member.isYou ? 'bg-primary/10 border border-primary/30' : 'bg-accent/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  member.rank === 1 ? 'bg-accent text-accent-foreground' :
                  member.rank === 2 ? 'bg-muted text-muted-foreground' :
                  member.rank === 3 ? 'bg-amber-700/20 text-amber-700' :
                  'bg-background text-foreground'
                }`}>
                  {member.rank}
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                  {member.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{member.score}</p>
                  <p className="text-xs text-muted-foreground">score</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
