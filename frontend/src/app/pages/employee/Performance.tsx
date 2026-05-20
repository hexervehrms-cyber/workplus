import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Target, Award, CheckCircle, AlertCircle, Trophy, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../utils/apiHelper';
import { useTheme } from '../../context/ThemeContext';

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
  color: string;
}

interface TeamMember {
  rank: number;
  name: string;
  score: number;
  avatar: string;
  isYou?: boolean;
}

interface PerformancePayload {
  performanceTrend?: PerformanceData[];
  skills?: SkillData[];
  kpis?: KPI[];
  achievements?: Achievement[];
  teamRanking?: TeamMember[];
  overallScore?: number;
  scoreDelta?: number;
  lastUpdated?: string;
}

const ACHIEVEMENT_ICONS: Record<string, typeof Trophy> = {
  'Excellent Attendance': Award,
  'On Time': CheckCircle,
  'High Performer': Trophy,
};

export default function Performance() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const chartGrid = isDark ? '#334155' : '#E5E7EB';
  const chartAxis = isDark ? '#94A3B8' : '#6B7280';

  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [skillsData, setSkillsData] = useState<SkillData[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [teamRanking, setTeamRanking] = useState<TeamMember[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [scoreDelta, setScoreDelta] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPerformanceData = useCallback(async () => {
    if (!user?.id && !(user as { userId?: string })?.userId) return;
    try {
      setError(null);
      const res = await apiGet<PerformancePayload | { data?: PerformancePayload }>(
        `/performance/me?_t=${Date.now()}`,
        false
      );
      const data: PerformancePayload =
        res && typeof res === 'object' && 'data' in res && res.data
          ? res.data
          : (res as PerformancePayload);

      setPerformanceData(data.performanceTrend ?? []);
      setSkillsData(data.skills ?? []);
      setKpis(data.kpis ?? []);
      setAchievements(data.achievements ?? []);
      setTeamRanking(
        (data.teamRanking ?? []).map((m) => ({
          rank: m.rank,
          name: m.name,
          score: m.score,
          avatar: m.avatar,
          isYou: m.isYou,
        }))
      );
      setOverallScore(Number(data.overallScore) || 0);
      setScoreDelta(Number(data.scoreDelta) || 0);
      setLastUpdated(data.lastUpdated ?? new Date().toISOString());
    } catch (err) {
      console.error('Error loading performance data:', err);
      let msg = err instanceof Error ? err.message : 'Failed to load performance data';
      if (msg.toLowerCase().includes('route not found')) {
        msg = 'Performance API unavailable — redeploy backend or sign in again.';
      }
      setError(msg);
      setPerformanceData([]);
      setSkillsData([]);
      setKpis([]);
      setAchievements([]);
      setTeamRanking([]);
      setOverallScore(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.userId]);

  useEffect(() => {
    loadPerformanceData();
    const interval = setInterval(loadPerformanceData, 60000);
    return () => clearInterval(interval);
  }, [loadPerformanceData]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Live metrics from your attendance and activity
            {lastUpdated && (
              <span className="block text-xs mt-1">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => loadPerformanceData()} className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/10 text-destructive rounded-xl">
          {error}
        </Card>
      )}

      <Card className="p-8 rounded-2xl bg-gradient-to-br from-secondary/10 to-primary/10 border-secondary/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg text-muted-foreground mb-2">Overall Performance Score</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-foreground">{overallScore}</span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge className="bg-secondary text-secondary-foreground">
                {overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : 'Improving'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {scoreDelta >= 0 ? '+' : ''}
                {scoreDelta} points vs prior month
              </span>
            </div>
          </div>
          <div className="w-32 h-32 rounded-full bg-secondary/20 flex items-center justify-center">
            <TrendingUp className="w-16 h-16 text-secondary" />
          </div>
        </div>
      </Card>

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
              <span className="text-3xl font-bold text-foreground">{kpi.value}%</span>
              <span className="text-sm text-muted-foreground">/ {kpi.target}%</span>
            </div>
            <Progress
              value={kpi.value}
              className={`h-2 ${kpi.status === 'good' ? '[&>div]:bg-secondary' : '[&>div]:bg-accent'}`}
            />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Performance Trend</h3>
          {performanceData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">No attendance data yet for trend chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="month" stroke={chartAxis} />
                <YAxis stroke={chartAxis} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    border: `1px solid ${chartGrid}`,
                    color: isDark ? '#f8fafc' : '#111',
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Skills Assessment</h3>
          {skillsData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">No skill metrics available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={skillsData}>
                <PolarGrid stroke={chartGrid} />
                <PolarAngleAxis dataKey="skill" stroke={chartAxis} fontSize={12} />
                <PolarRadiusAxis domain={[0, 100]} stroke={chartAxis} />
                <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Recent Achievements</h3>
          {achievements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keep up attendance to unlock achievements.</p>
          ) : (
            <div className="space-y-4">
              {achievements.map((achievement, index) => {
                const Icon = ACHIEVEMENT_ICONS[achievement.title] || Target;
                return (
                  <div key={index} className="flex gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                    <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center ${achievement.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{achievement.title}</h4>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{achievement.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Team Ranking</h3>
          {teamRanking.length === 0 ? (
            <p className="text-muted-foreground text-sm">No team ranking data for your organization yet.</p>
          ) : (
            <div className="space-y-3">
              {teamRanking.map((member) => (
                <div
                  key={member.rank}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    member.isYou ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      member.rank === 1
                        ? 'bg-accent text-accent-foreground'
                        : member.rank === 2
                          ? 'bg-muted text-muted-foreground'
                          : member.rank === 3
                            ? 'bg-amber-700/30 text-amber-400'
                            : 'bg-background text-foreground'
                    }`}
                  >
                    {member.rank}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                    {member.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {member.name}
                      {member.isYou ? ' (You)' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{member.score}</p>
                    <p className="text-xs text-muted-foreground">score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
