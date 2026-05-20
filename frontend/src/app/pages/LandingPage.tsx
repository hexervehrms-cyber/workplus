import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
} from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  BarChart3,
  Shield,
  Users,
  Zap,
  ChevronDown,
} from 'lucide-react';

const LandingScene = lazy(() =>
  import('../components/landing/LandingScene').then((m) => ({ default: m.LandingScene }))
);

const features = [
  {
    icon: Users,
    title: 'People-first HR',
    desc: 'Onboarding, profiles, and org structure in one calm workspace.',
  },
  {
    icon: BarChart3,
    title: 'Live attendance',
    desc: 'Check-in, breaks, and weekly hours with real-time dashboards.',
  },
  {
    icon: Shield,
    title: 'Secure by design',
    desc: 'Role-based access, audit trails, and enterprise-ready controls.',
  },
  {
    icon: Zap,
    title: 'Built for speed',
    desc: 'Lightning-fast portals for admins, HR, and every employee.',
  },
];

const stats = [
  { value: '99.9%', label: 'Uptime target' },
  { value: '24/7', label: 'Cloud access' },
  { value: '1', label: 'Unified platform' },
];

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 28 });
  const scrollNorm = useTransform(smoothProgress, [0, 1], [0, 1]);
  const [scrollVal, setScrollVal] = useState(0);

  const heroY = useTransform(smoothProgress, [0, 0.35], [0, -120]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0.15]);
  const parallaxMid = useTransform(smoothProgress, [0.2, 0.7], [80, -80]);
  const parallaxDeep = useTransform(smoothProgress, [0.3, 0.9], [120, -160]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(34,211,238,0.12), transparent 65%)`;

  useEffect(() => {
    const unsub = scrollNorm.on('change', (v) => setScrollVal(v));
    return () => unsub();
  }, [scrollNorm]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="relative bg-[#030712] text-white selection:bg-cyan-500/30">
      <motion.div className="pointer-events-none fixed inset-0 z-[1]" style={{ background: spotlight }} />

      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#030712]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-bold text-[#030712]">
              H
            </div>
            <span className="font-semibold tracking-tight">
              Hexerve <span className="text-cyan-400">WorkPlus</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden text-sm text-white/70 transition hover:text-white sm:inline">
              Features
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24">
        <Suspense fallback={null}>
          <LandingScene scroll={scrollVal} />
        </Suspense>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4 text-sm uppercase tracking-[0.4em] text-cyan-400/90"
          >
            Human resources, reimagined
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl"
          >
            One platform for your{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300 bg-clip-text text-transparent">
              entire workforce
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-white/65"
          >
            WorkPlus by Hexerve brings attendance, leave, payroll, documents, and employee experience
            together — with a portal that feels as polished as your brand.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#030712] transition hover:scale-[1.02]"
            >
              <Briefcase className="h-4 w-4" />
              Open portal
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm font-medium text-white/90 backdrop-blur transition hover:border-cyan-400/40 hover:bg-white/5"
            >
              Explore features
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 text-white/40"
        >
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </section>

      <section id="features" className="relative z-10 py-28">
        <motion.div style={{ y: parallaxMid }} className="pointer-events-none absolute left-0 top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl font-bold sm:text-4xl"
          >
            Scroll through the experience
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-center text-white/55"
          >
            Parallax layers, 3D depth, and motion that responds to you — without slowing down your team.
          </motion.p>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/5 py-24">
        <motion.div style={{ y: parallaxDeep }} className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8 px-6 text-center">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
            >
              <p className="text-3xl font-bold text-cyan-300">{s.value}</p>
              <p className="mt-2 text-sm text-white/50">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-28">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 px-8 py-16 text-center backdrop-blur"
        >
          <h2 className="text-3xl font-bold">Ready to enter WorkPlus?</h2>
          <p className="mt-4 text-white/60">Sign in with your organization credentials to continue.</p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-8 py-3.5 font-medium shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
          >
            Go to login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-sm text-white/40">
        © {new Date().getFullYear()} Hexerve · WorkPlus HR Platform
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  index,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      whileHover={{ y: -6, borderColor: 'rgba(34,211,238,0.35)' }}
      className="group cursor-default rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md transition-shadow hover:shadow-[0_0_40px_rgba(34,211,238,0.08)]"
    >
      <div className="mb-5 inline-flex rounded-xl bg-cyan-500/15 p-3 text-cyan-300 transition group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-white/55 leading-relaxed">{desc}</p>
    </motion.article>
  );
}
