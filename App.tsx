
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Sky from './components/Sky';
import { TimeOfDay, CloudData, ActivityLog, Task, User, RamadanEntry, Category, PastPaperEntry } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import Cloud from './components/Cloud';
import { getSkyProverb, getTaskAnalysis } from './services/geminiService';
import { db } from './dbService';
import { getBSTDate, formatDateISO, getAppPhase, hashPassword } from './utils';
import confetti from 'canvas-confetti';
import { 
  X, ArrowLeft, Plus, CheckCircle2, Circle, Trash2, 
  BarChart3, Cloud as CloudIcon, Sparkles, Zap, 
  LayoutDashboard, Book, Moon, User as UserIcon, LogOut,
  ChevronRight, Calendar as CalendarIcon, TrendingUp, Award, Clock,
  ChevronLeft, PieChart as PieChartIcon, Box, CheckSquare, Edit3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';

const App: React.FC = () => {
  const [view, setView] = useState<'sky' | 'tracker' | 'past-papers'>('sky');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('Day');
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [proverb, setProverb] = useState<string>("Hover over clouds to find wisdom.");
  
  // Past Paper State
  const [pastPapers, setPastPapers] = useState<PastPaperEntry[]>([]);
  const [pastPaperNav, setPastPaperNav] = useState<{ subject?: 'Math' | 'Physics'; subtopic?: string }>({});

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('zyphra_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const isDark = theme === 'dark';

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Data State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [ramadanData, setRamadanData] = useState<RamadanEntry | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState('Your sky pulse is gathering data...');
  const [selectedDate, setSelectedDate] = useState(formatDateISO(getBSTDate()));
  const [calendarViewDate, setCalendarViewDate] = useState(getBSTDate());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  // Activity Logger Local UI State
  const [loggerCategory, setLoggerCategory] = useState<Category>('Studying');

  const phaseInfo = useMemo(() => getAppPhase(), []);

  // Celebration Logic
  const triggerCelebration = () => {
    const duration = 5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#ffffff', '#fbbf24'],
        zIndex: 5000 
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#ffffff', '#fbbf24'],
        zIndex: 5000
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Persist theme and update document attribute
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('zyphra_theme', theme);
  }, [theme]);

  // Sync time of day with theme for consistent cloud aesthetic
  useEffect(() => {
    const isActuallyDark = (timeOfDay === 'Night' || timeOfDay === 'Evening');
    if (theme === 'dark' && !isActuallyDark) {
      setTimeOfDay('Night');
    } else if (theme === 'light' && isActuallyDark) {
      setTimeOfDay('Day');
    }
  }, [theme]);

  // Persistence Initializers
  useEffect(() => {
    const initApp = async () => {
      await db.init();
      const savedUid = localStorage.getItem('zyphra_uid');
      if (savedUid) {
        const users = await (db as any).getAll('users');
        const user = users.find((u: User) => u.uid === savedUid);
        if (user) {
          setCurrentUser(user);
          loadUserData(user.uid);
        }
      }
    };
    initApp();

    if (!localStorage.getItem('zyphra_theme')) {
      const hour = new Date().getHours();
      let detectedTime: TimeOfDay = 'Day';
      if (hour >= 5 && hour < 9) detectedTime = 'Morning';
      else if (hour >= 9 && hour < 17) detectedTime = 'Day';
      else if (hour >= 17 && hour < 20) detectedTime = 'Evening';
      else detectedTime = 'Night';
      
      setTimeOfDay(detectedTime);
      setTheme((detectedTime === 'Night' || detectedTime === 'Evening') ? 'dark' : 'light');
    }
  }, []);

  const loadUserData = async (uid: string) => {
    const [userLogs, userTasks, userPapers] = await Promise.all([
      db.getLogs(uid),
      db.getTasks(uid, selectedDate),
      db.getPastPapers(uid)
    ]);
    setLogs(userLogs);
    setDailyTasks(userTasks);
    setPastPapers(userPapers);
    
    if (phaseInfo.phase === 'Ramadan') {
      const ramEntry = await db.getRamadan(uid, selectedDate);
      setRamadanData(ramEntry);
    }
  };

  useEffect(() => {
    if (currentUser) loadUserData(currentUser.uid);
  }, [selectedDate, currentUser]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    const hp = await hashPassword(password);

    if (authMode === 'signup') {
      const existing = await db.getUser(email);
      if (existing) {
        setAuthError('Email already exists.');
        return;
      }
      const newUser: User = {
        uid: Math.random().toString(36).substring(2, 15),
        email,
        passwordHash: hp,
        displayName: displayName || email.split('@')[0],
        createdAt: Date.now()
      };
      await db.saveUser(newUser);
      setCurrentUser(newUser);
      localStorage.setItem('zyphra_uid', newUser.uid);
    } else {
      const user = await db.getUser(email);
      if (!user || user.passwordHash !== hp) {
        setAuthError('Invalid credentials.');
        return;
      }
      setCurrentUser(user);
      localStorage.setItem('zyphra_uid', user.uid);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('zyphra_uid');
  };

  const logActivity = async (category: Category, duration: number, journal: string) => {
    if (!currentUser) return;
    
    // Use functional update to ensure we check the most fresh state
    setLogs(prevLogs => {
      const currentStudyHours = prevLogs
        .filter(l => l.date === selectedDate && l.category === 'Studying')
        .reduce((acc, l) => acc + l.duration, 0);

      const newLog: ActivityLog = {
        id: Math.random().toString(36).substring(7),
        uid: currentUser.uid,
        date: selectedDate,
        category,
        duration: category === 'Prayers' ? 0 : duration,
        journal,
        timestamp: Date.now()
      };

      const newStudyHours = currentStudyHours + (category === 'Studying' ? duration : 0);
      
      // Trigger celebration if crossing the 6-hour milestone
      if (category === 'Studying' && currentStudyHours < 6 && newStudyHours >= 6) {
        triggerCelebration();
      }

      db.addLog(newLog);
      return [newLog, ...prevLogs];
    });
  };

  const addTask = async (text: string) => {
    if (!currentUser) return;
    const newTask: Task = {
      id: Math.random().toString(36).substring(7),
      uid: currentUser.uid,
      date: selectedDate,
      text,
      completed: false
    };
    await db.saveTask(newTask);
    setDailyTasks([...dailyTasks, newTask]);
  };

  const analyzeSky = async () => {
    setIsAnalyzing(true);
    const result = await getTaskAnalysis(logs);
    setAiInsight(result);
    setIsAnalyzing(false);
  };

  // Stacked Bar Chart Data Processor
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, any>();
    
    // Initialize last 10 days to ensure continuous timeline
    for (let i = 9; i >= 0; i--) {
      const d = getBSTDate();
      d.setDate(d.getDate() - i);
      const iso = formatDateISO(d);
      dailyMap.set(iso, { 
        date: iso.split('-').slice(1).join('/'),
        Studying: 0,
        Classes: 0,
        'Paper Checking': 0,
        Sleep: 0,
        Workout: 0,
        Prayers: 0,
        Other: 0
      });
    }

    logs.forEach(l => {
      if (dailyMap.has(l.date)) {
        const entry = dailyMap.get(l.date);
        entry[l.category] = (entry[l.category] || 0) + l.duration;
      }
    });

    return Array.from(dailyMap.values());
  }, [logs]);

  // Pie Chart Data Processor: Focuses exclusively on Studying relative to others
  const distributionData = useMemo(() => {
    const dayLogs = logs.filter(l => l.date === selectedDate);
    const studyTotal = dayLogs.filter(l => l.category === 'Studying').reduce((acc, l) => acc + l.duration, 0);
    const otherTotal = dayLogs.filter(l => l.category !== 'Studying').reduce((acc, l) => acc + l.duration, 0);

    const data = [
      { name: 'Studying', value: studyTotal },
      { name: 'Other Time', value: otherTotal }
    ].filter(d => d.value > 0);

    return data;
  }, [logs, selectedDate]);

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    return getDaysInMonth(year, month);
  }, [calendarViewDate]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(calendarViewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCalendarViewDate(newDate);
  };

  const clouds: CloudData[] = [
    { id: '1', type: 'tracker', initialX: 15, initialY: 25, scale: 1.25 },
    { id: '2', type: 'project', initialX: 65, initialY: 35, scale: 1.15 },
    { id: '3', type: 'decorative', initialX: 10, initialY: 65, scale: 0.8 },
    { id: '4', type: 'decorative', initialX: 85, initialY: 15, scale: 0.9 },
    { id: '5', type: 'easteregg', initialX: 45, initialY: 75, scale: 1.05 },
    { id: '6', type: 'decorative', initialX: 80, initialY: 80, scale: 0.7 },
  ];

  const handleSetTimeOfDay = (newTime: TimeOfDay) => {
    setTimeOfDay(newTime);
    setTheme((newTime === 'Night' || newTime === 'Evening') ? 'dark' : 'light');
  };

  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const sessions = ['Feb–March', 'May–June', 'Oct–Nov'];

  const getPapersForSubject = (subject: string, session: string) => {
    if (subject === 'Math') {
      if (session === 'Feb–March') return ['Paper 12', 'Paper 42'];
      return ['QP 11', 'QP 12', 'QP 13', 'QP 41', 'QP 42', 'QP 43', 'S1 51', 'S1 52', 'S1 53'];
    } else {
      if (session === 'Feb–March') return ['Paper 12', 'Paper 22'];
      return ['QP 11', 'QP 12', 'QP 13', 'QP 21', 'QP 22', 'QP 23'];
    }
  };

  const filterPapersForSubtopic = (papers: string[], subtopic: string) => {
    if (subtopic === 'Pure Mathematics 1') return papers.filter(p => p.includes('11') || p.includes('12') || p.includes('13'));
    if (subtopic === 'Mechanics') return papers.filter(p => p.includes('41') || p.includes('42') || p.includes('43'));
    if (subtopic === 'Probability & Statistics 1') return papers.filter(p => p.includes('51') || p.includes('52') || p.includes('53'));
    return papers; // Physics
  };

  const savePaperEntry = async (id: string, completed: boolean, marks: string) => {
    if (!currentUser || !pastPaperNav.subject || !pastPaperNav.subtopic) return;
    const parts = id.split('-');
    const newEntry: PastPaperEntry = {
      id,
      uid: currentUser.uid,
      subject: pastPaperNav.subject,
      subtopic: pastPaperNav.subtopic,
      year: parseInt(parts[2]),
      session: parts[3],
      paper: parts[4],
      completed,
      marks
    };
    await db.savePastPaper(newEntry);
    setPastPapers(prev => {
      const existing = prev.findIndex(p => p.id === id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = newEntry;
        return next;
      }
      return [...prev, newEntry];
    });
    // Auto-return to subtopic menu
    setPastPaperNav({ subject: pastPaperNav.subject });
  };

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden select-none">
      <Sky timeOfDay={timeOfDay} setTimeOfDay={handleSetTimeOfDay} />
      
      <Header 
        timeOfDay={timeOfDay} 
        proverb={proverb} 
        isSoundOn={isSoundOn} 
        toggleSound={() => setIsSoundOn(!isSoundOn)}
        theme={theme}
        onThemeToggle={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
      />

      <main className="flex-grow relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'sky' ? (
            <motion.div key="sky" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              {clouds.map(c => (
                <Cloud key={c.id} data={c} timeOfDay={timeOfDay} onClick={() => {
                  if (c.type === 'tracker') setView('tracker');
                  else if (c.type === 'project') setView('past-papers');
                  else if (c.type === 'easteregg') getSkyProverb().then(setProverb);
                }} />
              ))}
            </motion.div>
          ) : view === 'tracker' ? (
            <motion.div key="tracker" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0 z-[60] bg-slate-950/20 backdrop-blur-md pt-20 pb-10 px-4 overflow-y-auto custom-scrollbar">
              <div className="max-w-7xl mx-auto flex flex-col gap-6">
                
                <div className={`flex items-center justify-between backdrop-blur-xl border p-4 rounded-3xl transition-colors duration-500 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white/80 border-blue-100'}`}>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setView('sky')} className={`p-3 rounded-2xl transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'}`}>
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-blue-950'}`}>Cloud Tracker</h2>
                      <p className={`text-[10px] uppercase tracking-[0.2em] font-bold mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>A Zyphra Product</p>
                    </div>
                  </div>
                  
                  {currentUser && (
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex flex-col items-end">
                        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-blue-900'}`}>{currentUser.displayName}</span>
                        <span className={`text-[10px] ${isDark ? 'text-white/50' : 'text-blue-900/40'}`}>{phaseInfo.phase} Phase</span>
                      </div>
                      <button onClick={handleLogout} className={`p-2 transition-colors ${isDark ? 'text-white/50 hover:text-red-400' : 'text-blue-900/30 hover:text-red-600'}`}>
                        <LogOut size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {!currentUser ? (
                  <div className="flex-grow flex items-center justify-center p-4">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`w-full max-w-md backdrop-blur-2xl border rounded-[2rem] p-8 shadow-2xl transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/90 border-blue-100'}`}>
                      <div className="text-center mb-8">
                        <h3 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-blue-950'}`}>{authMode === 'login' ? 'Welcome Back' : 'Join the Sky'}</h3>
                        <p className={`text-sm ${isDark ? 'text-white/40' : 'text-blue-900/40'}`}>Access your Cloud Tracker dashboard</p>
                      </div>
                      <form onSubmit={handleAuth} className="space-y-4">
                        {authMode === 'signup' && (
                          <input type="text" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className={`w-full border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-blue-100 text-blue-950 placeholder:text-blue-300'}`} required />
                        )}
                        <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className={`w-full border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-blue-100 text-blue-950 placeholder:text-blue-300'}`} required />
                        <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} className={`w-full border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-blue-100 text-blue-950 placeholder:text-blue-300'}`} required />
                        {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold transition-all transform active:scale-95 shadow-xl shadow-blue-500/20">
                          {authMode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                      </form>
                      <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className={`w-full mt-6 text-sm transition-colors ${isDark ? 'text-white/40 hover:text-white' : 'text-blue-900/40 hover:text-blue-950'}`}>
                        {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                      </button>
                    </motion.div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 flex flex-col gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] shadow-xl text-white flex flex-col justify-between min-h-[160px]">
                           <div className="flex justify-between items-start">
                             <TrendingUp size={24} className="opacity-50" />
                             <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-1 rounded-lg">Active</span>
                           </div>
                           <div>
                             <h4 className="text-4xl font-black">{phaseInfo.daysRemaining || 0}</h4>
                             <p className="text-xs font-bold uppercase tracking-widest opacity-70">Days Until {phaseInfo.phase.replace('-', ' ')}</p>
                           </div>
                        </div>
                        <div className={`backdrop-blur-xl border p-6 rounded-[2rem] flex flex-col justify-between transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-blue-100 text-blue-900 shadow-lg shadow-blue-100'}`}>
                           <Clock size={24} className="text-blue-500" />
                           <div>
                             <h4 className="text-3xl font-bold">{logs.filter(l => l.date === selectedDate).reduce((acc, l) => acc + l.duration, 0).toFixed(1)}h</h4>
                             <p className={`text-xs uppercase font-bold tracking-widest ${isDark ? 'text-white/40' : 'text-blue-900/40'}`}>Today's Activity</p>
                           </div>
                        </div>
                        <div className={`backdrop-blur-xl border p-6 rounded-[2rem] flex flex-col justify-between transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-blue-100 text-blue-900 shadow-lg shadow-blue-100'}`}>
                           <Award size={24} className="text-yellow-400" />
                           <div>
                             <h4 className="text-3xl font-bold">{logs.filter(l => l.duration >= 8).length}</h4>
                             <p className={`text-xs uppercase font-bold tracking-widest ${isDark ? 'text-white/40' : 'text-blue-900/40'}`}>High Flow Days</p>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`backdrop-blur-xl border p-6 rounded-[2rem] transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-blue-100 shadow-lg shadow-blue-100'}`}>
                          <h5 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white' : 'text-blue-900'}`}>Study vs Others</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie 
                                  data={distributionData.length > 0 ? distributionData : [{name: 'Empty', value: 1}]} 
                                  cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value"
                                >
                                  {distributionData.map((d, i) => <Cell key={i} fill={d.name === 'Studying' ? '#3b82f6' : (isDark ? '#ffffff10' : '#e2e8f0')} />)}
                                  {distributionData.length === 0 && <Cell fill={isDark ? '#ffffff10' : '#e2e8f0'} />}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', background: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a'}} />
                                <Legend verticalAlign="bottom" height={36}/>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className={`backdrop-blur-xl border p-6 rounded-[2rem] transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-blue-100 shadow-lg shadow-blue-100'}`}>
                          <h5 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white' : 'text-blue-900'}`}>Daily Trend (Stacked Categories)</h5>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                <XAxis dataKey="date" stroke={isDark ? "#ffffff40" : "#1e3a8a40"} fontSize={10} />
                                <Bar dataKey="Studying" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Paper Checking" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Classes" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Sleep" stackId="a" fill="#64748b" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Other" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Tooltip contentStyle={{backgroundColor: isDark ? '#1e293b' : '#ffffff', border: 'none', borderRadius: '12px', color: isDark ? '#ffffff' : '#0f172a'}} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className={`backdrop-blur-xl border p-8 rounded-[2rem] transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-blue-100 shadow-lg shadow-blue-100'}`}>
                        <div className="flex items-center justify-between mb-6">
                           <h5 className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-blue-950'}`}>
                             <Book size={18} className="text-blue-500" /> Activity Logger
                           </h5>
                           <button onClick={() => setIsCalendarOpen(true)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-blue-500 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                             <CalendarIcon size={16} /> Open Calendar
                           </button>
                        </div>
                        <form className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" onSubmit={(e) => {
                          e.preventDefault();
                          const target = e.target as any;
                          const durValue = loggerCategory === 'Prayers' ? 0 : parseFloat(target.dur?.value || '0');
                          logActivity(loggerCategory, durValue, target.jr.value);
                          target.reset();
                          setLoggerCategory('Studying');
                        }}>
                          <select 
                            name="cat" 
                            value={loggerCategory}
                            onChange={(e) => setLoggerCategory(e.target.value as Category)}
                            className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-blue-50 text-blue-950'}`}
                          >
                            <option value="Studying">Studying</option>
                            <option value="Classes">Classes</option>
                            <option value="Sleep">Sleep</option>
                            <option value="Prayers">Prayers</option>
                            <option value="Workout">Workout</option>
                            <option value="Paper Checking">Paper Checking</option>
                            <option value="Other">Other</option>
                          </select>
                          {loggerCategory !== 'Prayers' ? (
                            <input name="dur" type="number" step="0.1" placeholder="Duration (h)" className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-blue-100 text-blue-950 placeholder:text-blue-300'}`} required />
                          ) : (
                            <div className={`flex items-center justify-center border p-3 rounded-xl text-xs font-bold uppercase tracking-tighter opacity-50 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-blue-50 text-blue-950'}`}>
                              No Duration Needed
                            </div>
                          )}
                          <input name="jr" type="text" placeholder="Journal entry..." className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 border-blue-50 text-blue-950 placeholder:text-blue-300'}`} required />
                          <button type="submit" className="md:col-span-3 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-white font-bold transition-all transform active:scale-95 shadow-lg shadow-blue-500/30">Log Activity</button>
                        </form>
                        
                        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                          {logs.slice(0, 10).map(l => (
                            <div key={l.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-blue-50 hover:bg-white shadow-sm'}`}>
                              <div className="flex gap-4 items-center">
                                <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}><Clock size={16} /></div>
                                <div>
                                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-blue-950'}`}>{l.category}</p>
                                  <p className={`text-[10px] ${isDark ? 'text-white/40' : 'text-blue-950/40'}`}>{l.journal}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${isDark ? 'text-white' : 'text-blue-900'}`}>{l.category === 'Prayers' ? 'Done' : `${l.duration}h`}</p>
                                <p className={`text-[10px] ${isDark ? 'text-white/40' : 'text-blue-900/40'}`}>{l.date}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col gap-6">
                      <div className={`p-4 rounded-3xl flex items-center justify-between shadow-xl transition-colors duration-500 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                         <div className="flex items-center gap-3">
                           <CalendarIcon className="text-blue-500" />
                           <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={`font-bold outline-none bg-transparent ${isDark ? 'text-white' : 'text-blue-950'}`} />
                         </div>
                      </div>

                      <div className={`p-6 rounded-[2rem] border relative overflow-hidden group transition-colors duration-500 ${isDark ? 'bg-indigo-950/40 border-indigo-500/20 text-white' : 'bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-500/20'}`}>
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Sparkles size={120} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-4">
                             <h5 className="font-bold flex items-center gap-2"><Sparkles size={18} /> AI Insight</h5>
                             <button onClick={analyzeSky} disabled={isAnalyzing} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                               <TrendingUp size={16} />
                             </button>
                          </div>
                          <p className={`text-sm leading-relaxed font-light italic ${isDark ? 'text-indigo-100' : 'text-blue-50'}`}>
                            {isAnalyzing ? "Consulting your digital stars..." : aiInsight}
                          </p>
                        </div>
                      </div>

                      <div className={`p-8 rounded-[2rem] shadow-xl flex-grow flex flex-col min-h-[400px] transition-colors duration-500 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white'}`}>
                        <h5 className={`font-black text-xl mb-6 ${isDark ? 'text-white' : 'text-blue-950'}`}>Daily Objective</h5>
                        <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = e.target as any; addTask(t.task.value); t.reset(); }}>
                          <input name="task" type="text" placeholder="I plan to..." className={`flex-grow p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors ${isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-slate-50 text-blue-950 placeholder:text-blue-300'}`} />
                          <button type="submit" className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/30"><Plus size={20} /></button>
                        </form>
                        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-grow">
                          {dailyTasks.map(t => (
                            <div key={t.id} className={`flex items-center gap-3 p-4 rounded-2xl group transition-all ${t.completed ? (isDark ? 'bg-green-500/10' : 'bg-green-50') : (isDark ? 'bg-white/5' : 'bg-slate-50')}`}>
                              <button onClick={() => {
                                const updated = { ...t, completed: !t.completed };
                                db.saveTask(updated);
                                setDailyTasks(dailyTasks.map(item => item.id === t.id ? updated : item));
                              }}>
                                {t.completed ? <CheckCircle2 className="text-green-500" /> : <Circle className={isDark ? 'text-white/20' : 'text-slate-300'} />}
                              </button>
                              <span className={`flex-grow text-sm font-bold ${t.completed ? (isDark ? 'text-green-200/40 line-through' : 'text-green-900/40 line-through') : (isDark ? 'text-white' : 'text-slate-900')}`}>{t.text}</span>
                              <button onClick={() => { db.deleteTask(t.id); setDailyTasks(dailyTasks.filter(item => item.id !== t.id)); }} className="opacity-0 group-hover:opacity-100 p-2 text-red-300 hover:text-red-500 transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {phaseInfo.phase === 'Ramadan' && (
                        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`backdrop-blur-3xl border p-6 rounded-[2rem] transition-colors duration-500 ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-blue-900 border-blue-950 text-white shadow-xl shadow-blue-900/40'}`}>
                          <h5 className="font-bold flex items-center gap-2 mb-4"><Moon size={18} className="text-yellow-400" /> Ramadan Day {phaseInfo.ramadanDay}</h5>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-widest">
                            {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Taraweeh'].map(prayer => (
                              <button key={prayer} className="p-3 bg-white/5 rounded-xl text-center hover:bg-white/10 transition-all">{prayer}</button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-8 text-center pb-12">
                   <p className={`text-[10px] uppercase tracking-[0.5em] font-black ${isDark ? 'text-white/30' : 'text-blue-950/20'}`}>Cloud Tracker — A Zyphra Product</p>
                   <p className={`text-[8px] uppercase tracking-[0.2em] font-bold mt-2 ${isDark ? 'text-white/20' : 'text-blue-950/10'}`}>Under Zyphra Corporation</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="past-papers" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0 z-[60] bg-slate-950/20 backdrop-blur-md pt-20 pb-10 px-4 overflow-y-auto custom-scrollbar">
               <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  <div className={`flex items-center justify-between backdrop-blur-xl border p-4 rounded-3xl transition-colors duration-500 ${isDark ? 'bg-white/10 border-white/10' : 'bg-white/80 border-blue-100'}`}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => {
                        if (pastPaperNav.subtopic) setPastPaperNav({ subject: pastPaperNav.subject });
                        else if (pastPaperNav.subject) setPastPaperNav({});
                        else setView('sky');
                      }} className={`p-3 rounded-2xl transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30'}`}>
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h2 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-purple-950'}`}>Past Paper To-Do</h2>
                        <p className={`text-[10px] uppercase tracking-[0.2em] font-bold mt-1 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{pastPaperNav.subject ? `${pastPaperNav.subject} - ${pastPaperNav.subtopic || 'Subtopics'}` : 'Subject Selection'}</p>
                      </div>
                    </div>
                  </div>

                  {!pastPaperNav.subject ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-12">
                       <button onClick={() => setPastPaperNav({ subject: 'Math' })} className={`p-12 rounded-[3rem] border backdrop-blur-xl transition-all flex flex-col items-center gap-6 group ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-blue-100 shadow-xl hover:-translate-y-2'}`}>
                          <div className="p-6 bg-blue-500/20 rounded-3xl text-blue-500 group-hover:scale-110 transition-transform"><Book size={48} /></div>
                          <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-blue-900'}`}>Math</span>
                       </button>
                       <button onClick={() => setPastPaperNav({ subject: 'Physics' })} className={`p-12 rounded-[3rem] border backdrop-blur-xl transition-all flex flex-col items-center gap-6 group ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-purple-100 shadow-xl hover:-translate-y-2'}`}>
                          <div className="p-6 bg-purple-500/20 rounded-3xl text-purple-500 group-hover:scale-110 transition-transform"><Zap size={48} /></div>
                          <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-purple-900'}`}>Physics</span>
                       </button>
                    </div>
                  ) : !pastPaperNav.subtopic ? (
                    <div className="flex flex-col gap-4 py-8">
                       {(pastPaperNav.subject === 'Math' ? ['Pure Mathematics 1', 'Mechanics', 'Probability & Statistics 1'] : ['Full Syllabus Breakdown']).map(sub => (
                         <button key={sub} onClick={() => setPastPaperNav({ ...pastPaperNav, subtopic: sub })} className={`p-8 rounded-[2rem] border backdrop-blur-xl transition-all flex items-center justify-between group ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white border-blue-100 shadow-lg hover:bg-slate-50 text-blue-900'}`}>
                            <span className="text-xl font-bold">{sub}</span>
                            <ChevronRight className="group-hover:translate-x-2 transition-transform" />
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-12 py-8">
                       {years.map(year => (
                         <div key={year} className="space-y-6">
                            <h3 className={`text-4xl font-black opacity-20 ${isDark ? 'text-white' : 'text-blue-900'}`}>{year}</h3>
                            <div className="flex flex-col gap-6">
                               {sessions.map(session => (
                                 <div key={session} className="space-y-4">
                                    <h4 className={`text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{session}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       {filterPapersForSubtopic(getPapersForSubject(pastPaperNav.subject!, session), pastPaperNav.subtopic!).map(paper => {
                                         const paperId = `${pastPaperNav.subject}-${pastPaperNav.subtopic}-${year}-${session}-${paper}`;
                                         const existing = pastPapers.find(p => p.id === paperId);
                                         return (
                                           <div key={paperId} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-blue-100 shadow-sm'}`}>
                                              <button onClick={() => savePaperEntry(paperId, !existing?.completed, existing?.marks || '')} className={`p-1 rounded-lg transition-all ${existing?.completed ? 'text-green-500' : 'text-slate-300'}`}>
                                                 {existing?.completed ? <CheckSquare size={24} /> : <Circle size={24} />}
                                              </button>
                                              <div className="flex-grow">
                                                 <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-blue-950'}`}>{paper}</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                 <Edit3 size={14} className="opacity-30" />
                                                 <input 
                                                   type="text" 
                                                   placeholder="Marks" 
                                                   defaultValue={existing?.marks || ''}
                                                   onBlur={(e) => savePaperEntry(paperId, !!existing?.completed, e.target.value)}
                                                   className={`w-16 p-2 rounded-xl text-xs font-bold text-center outline-none transition-all ${isDark ? 'bg-white/10 text-white placeholder:text-white/20' : 'bg-slate-50 text-blue-900'}`}
                                                 />
                                              </div>
                                           </div>
                                         );
                                       })}
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer onAboutClick={() => setIsAboutOpen(true)} />

      {/* Calendar Overlay */}
      <AnimatePresence>
        {isCalendarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className={`w-full max-w-4xl p-8 rounded-[3rem] shadow-2xl transition-colors duration-500 ${isDark ? 'bg-slate-900 border border-white/10 text-white' : 'bg-white text-blue-900'}`}>
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black">Calendar</h3>
                  <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-current/10 rounded-2xl transition-all"><ChevronLeft /></button>
                    <span className="text-xl font-bold uppercase tracking-widest">{calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => changeMonth(1)} className="p-3 hover:bg-current/10 rounded-2xl transition-all"><ChevronRight /></button>
                  </div>
                  <button onClick={() => setIsCalendarOpen(false)} className="p-3 hover:bg-red-500/20 text-red-500 rounded-full transition-all"><X size={24} /></button>
               </div>
               
               <div className="grid grid-cols-7 gap-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest opacity-40">{d}</div>
                  ))}
                  {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                  {calendarDays.map((day, i) => {
                    const isToday = formatDateISO(day) === formatDateISO(getBSTDate());
                    const isSelected = formatDateISO(day) === selectedDate;
                    const dayLogs = logs.filter(l => l.date === formatDateISO(day));
                    const totalStudy = dayLogs.filter(l => l.category === 'Studying').reduce((acc, l) => acc + l.duration, 0);
                    const isMilestone = totalStudy >= 6;
                    const intensity = Math.min(dayLogs.reduce((acc, l) => acc + l.duration, 0) / 10, 1);
                    
                    return (
                      <button 
                        key={i} 
                        onClick={() => {
                          setSelectedDate(formatDateISO(day));
                          setIsDayModalOpen(true);
                        }}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all group border ${isSelected ? 'border-blue-500' : 'border-transparent'} ${isToday ? 'bg-blue-500 text-white' : (isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-blue-50')} ${isMilestone ? 'milestone-day' : ''}`}
                      >
                        <span className="text-lg font-bold">{day.getDate()}</span>
                        {dayLogs.length > 0 && (
                          <div 
                            className="absolute bottom-2 h-1 w-1/2 bg-blue-500 rounded-full" 
                            style={{ opacity: intensity + 0.2 }}
                          />
                        )}
                        {isMilestone && (
                          <div className="absolute top-1 right-1">
                            <Sparkles size={12} className="text-yellow-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {isDayModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className={`w-full max-w-5xl h-[85vh] p-8 rounded-[3rem] shadow-2xl transition-colors duration-500 flex flex-col ${isDark ? 'bg-slate-900 border border-white/10 text-white' : 'bg-white text-blue-900'}`}>
              <div className="flex items-center justify-between mb-8 shrink-0">
                 <div>
                    <h3 className="text-2xl font-black flex items-center gap-3">
                      Day Insight
                      {logs.filter(l => l.date === selectedDate && l.category === 'Studying').reduce((acc, l) => acc + l.duration, 0) >= 6 && (
                        <span className="text-xs bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded-full uppercase tracking-widest font-bold">Milestone Reached!</span>
                      )}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.2em] font-bold opacity-40">{new Date(selectedDate).toLocaleDateString('default', { dateStyle: 'full' })}</p>
                 </div>
                 <button onClick={() => setIsDayModalOpen(false)} className="p-3 hover:bg-red-500/20 text-red-500 rounded-full transition-all"><X size={24} /></button>
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col lg:flex-row gap-8">
                 {/* Detail Left: Summary & Chart */}
                 <div className="lg:w-1/2 flex flex-col gap-6">
                    <div className={`p-8 rounded-[2rem] flex flex-col items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                       <h4 className="text-xs font-black uppercase tracking-widest mb-6 opacity-50 flex items-center gap-2"><PieChartIcon size={14} /> Time Distribution</h4>
                       <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie 
                                data={distributionData.length > 0 ? distributionData : [{name: 'No data', value: 1}]} 
                                cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value"
                              >
                                {distributionData.map((d, i) => <Cell key={i} fill={d.name === 'Studying' ? '#3b82f6' : (isDark ? '#ffffff10' : '#e2e8f0')} />)}
                                {distributionData.length === 0 && <Cell fill={isDark ? '#ffffff10' : '#e2e8f0'} />}
                              </Pie>
                              <Tooltip contentStyle={{borderRadius: '12px', border: 'none', background: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a'}} />
                            </PieChart>
                          </ResponsiveContainer>
                       </div>
                       <div className="grid grid-cols-2 gap-4 mt-6 w-full">
                          <div className={`p-4 rounded-2xl text-center ${isDark ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                             <p className="text-2xl font-black text-blue-500">{logs.filter(l => l.date === selectedDate && l.category === 'Studying').reduce((acc, l) => acc + l.duration, 0).toFixed(1)}h</p>
                             <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Studying Time</p>
                          </div>
                          <div className={`p-4 rounded-2xl text-center ${isDark ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                             <p className="text-2xl font-black text-green-500">{dailyTasks.filter(t => t.completed).length}</p>
                             <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Tasks Done</p>
                          </div>
                       </div>
                    </div>

                    <div className={`p-6 rounded-[2rem] ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                       <h4 className="text-xs font-black uppercase tracking-widest mb-4 opacity-50">Quick Log</h4>
                       <form className="grid grid-cols-1 gap-3" onSubmit={(e) => {
                          e.preventDefault();
                          const target = e.target as any;
                          const durValue = loggerCategory === 'Prayers' ? 0 : parseFloat(target.dur?.value || '0');
                          logActivity(loggerCategory, durValue, target.jr.value);
                          target.reset();
                          setLoggerCategory('Studying');
                        }}>
                          <select 
                            name="cat" 
                            value={loggerCategory}
                            onChange={(e) => setLoggerCategory(e.target.value as Category)}
                            className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-blue-50 text-blue-950 shadow-sm'}`}
                          >
                            <option value="Studying">Studying</option>
                            <option value="Classes">Classes</option>
                            <option value="Sleep">Sleep</option>
                            <option value="Prayers">Prayers</option>
                            <option value="Workout">Workout</option>
                            <option value="Paper Checking">Paper Checking</option>
                            <option value="Other">Other</option>
                          </select>
                          {loggerCategory !== 'Prayers' && (
                            <input name="dur" type="number" step="0.1" placeholder="Duration (h)" className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-blue-50 text-blue-950 shadow-sm'}`} required />
                          )}
                          <input name="jr" type="text" placeholder="Journal entry..." className={`border p-3 rounded-xl text-sm outline-none transition-colors ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-blue-50 text-blue-950 shadow-sm'}`} required />
                          <button type="submit" className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-white font-bold transition-all shadow-lg shadow-blue-500/20">Update Day</button>
                       </form>
                    </div>
                 </div>

                 {/* Detail Right: List View */}
                 <div className="lg:w-1/2 flex flex-col gap-6">
                    <div className="flex-grow flex flex-col gap-4">
                       <h4 className="text-xs font-black uppercase tracking-widest opacity-50">Activities & Journal</h4>
                       <div className="space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                          {logs.filter(l => l.date === selectedDate).map(l => (
                            <div key={l.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-blue-50 hover:bg-white'}`}>
                               <div className="flex gap-4 items-center">
                                 <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}><Clock size={16} /></div>
                                 <div>
                                   <p className="font-bold text-sm">{l.category}</p>
                                   <p className="text-[10px] opacity-50">{l.journal}</p>
                                 </div>
                               </div>
                               <div className="text-right">
                                  <p className="font-bold">{l.category === 'Prayers' ? 'Done' : `${l.duration}h`}</p>
                                  <button onClick={() => { db.deleteLog(l.id); setLogs(logs.filter(item => item.id !== l.id)); }} className="text-red-400 text-[10px] font-bold hover:underline">Remove</button>
                               </div>
                            </div>
                          ))}
                          {logs.filter(l => l.date === selectedDate).length === 0 && <p className="text-center py-8 text-xs font-bold opacity-30 italic">No logs for this date.</p>}
                       </div>

                       <h4 className="text-xs font-black uppercase tracking-widest opacity-50 mt-4">Day Objectives</h4>
                       <div className="space-y-2">
                          {dailyTasks.map(t => (
                            <div key={t.id} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${t.completed ? (isDark ? 'bg-green-500/10' : 'bg-green-50') : (isDark ? 'bg-white/5' : 'bg-slate-50')}`}>
                              <button onClick={() => {
                                const updated = { ...t, completed: !t.completed };
                                db.saveTask(updated);
                                setDailyTasks(dailyTasks.map(item => item.id === t.id ? updated : item));
                              }}>
                                {t.completed ? <CheckCircle2 className="text-green-500" /> : <Circle className={isDark ? 'text-white/20' : 'text-slate-300'} />}
                              </button>
                              <span className={`flex-grow text-sm font-bold ${t.completed ? 'opacity-40 line-through' : ''}`}>{t.text}</span>
                              <button onClick={() => { db.deleteTask(t.id); setDailyTasks(dailyTasks.filter(item => item.id !== t.id)); }} className="text-red-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAboutOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-slate-900 text-white overflow-y-auto">
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-full transition-all group">
              <X size={32} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
            <div className="max-w-2xl text-center space-y-8">
              <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-6xl font-extrabold tracking-tighter">Zyphra</motion.h2>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="h-1 w-24 bg-blue-500 mx-auto rounded-full" />
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-xl md:text-2xl text-slate-300 leading-relaxed font-light">
                Zyphra is your interactive cloud workspace where you track tasks, explore projects, and learn efficiently. 
                Designed as a serene digital sky, it blends productivity with a calming atmosphere to help you find your flow.
              </motion.p>
              <div className="pt-12 grid grid-cols-3 gap-8 text-sm uppercase tracking-[0.2em] font-bold text-blue-400">
                <div>Intuitive</div><div>Serene</div><div>Productive</div>
              </div>
              <motion.button onClick={() => setIsAboutOpen(false)} className="mt-12 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white font-bold transition-all hover:scale-105">Back to the Sky</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stars: React.FC = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none opacity-40">
    {Array.from({ length: 60 }).map((_, i) => (
      <motion.div key={i} className="absolute bg-white rounded-full shadow-[0_0_5px_white]" style={{ width: Math.random() * 2 + 1, height: Math.random() * 2 + 1, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }} animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.4, 1] }} transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }} />
    ))}
  </motion.div>
);

const Rain: React.FC = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none overflow-hidden">
    {Array.from({ length: 100 }).map((_, i) => (
      <div key={i} className="rain-drop" style={{ left: `${Math.random() * 100}%`, top: `-${Math.random() * 20}%`, animationDuration: `${0.5 + Math.random() * 0.5}s`, animationDelay: `${Math.random() * 2}s` }} />
    ))}
  </motion.div>
);

export default App;
