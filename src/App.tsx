/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { 
  Home, BookOpen, Brain, BarChart2, MessageSquare, Palette, 
  User, Star, Check, X, Send, Zap, Trophy, Flame, RefreshCw, 
  Eraser, Moon, Sun, LogOut, ChevronRight, ChevronLeft, Search,
  Award, Target, Quote, Settings, Info, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, PieChart, Pie, Cell 
} from "recharts";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getChatResponse, generateQuiz, generateLearningContent } from "./services/geminiService";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── AUTH CONTEXT
// ══════════════════════════════════════════════════════════════════════════════
interface UserProfile {
  email: string;
  name: string;
  createdAt: number;
  educationLevel?: string;
  interests?: string[];
  knowledgeLevel?: string;
  xp: number;
  level: number;
  streak: number;
}

interface AuthContextType {
  authUser: UserProfile | null;
  signup: (email: string, pass: string, name: string) => { ok: boolean; error?: string };
  login: (email: string, pass: string, remember: boolean) => { ok: boolean; error?: string };
  updateProfile: (data: Partial<UserProfile>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
function useAuth() { return useContext(AuthContext)!; }

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<UserProfile | null>(() => {
    try { return JSON.parse(localStorage.getItem("genexis_session") || "null"); } catch { return null; }
  });

  const signup = (email: string, password: string, name: string) => {
    const users = JSON.parse(localStorage.getItem("genexis_users") || "{}");
    if (users[email]) return { ok: false, error: "An account with this email already exists." };
    const user: UserProfile = { email, name, createdAt: Date.now(), xp: 0, level: 1, streak: 1 };
    users[email] = { ...user, password };
    localStorage.setItem("genexis_users", JSON.stringify(users));
    localStorage.setItem("genexis_session", JSON.stringify(user));
    setAuthUser(user);
    return { ok: true };
  };

  const login = (email: string, password: string, remember: boolean) => {
    const users = JSON.parse(localStorage.getItem("genexis_users") || "{}");
    const record = users[email];
    if (!record) return { ok: false, error: "No account found with that email." };
    if (record.password !== password) return { ok: false, error: "Incorrect password." };
    const user: UserProfile = { ...record };
    delete (user as any).password;
    if (remember) localStorage.setItem("genexis_session", JSON.stringify(user));
    else sessionStorage.setItem("genexis_session", JSON.stringify(user));
    setAuthUser(user);
    return { ok: true };
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!authUser) return;
    const updated = { ...authUser, ...data };
    setAuthUser(updated);
    localStorage.setItem("genexis_session", JSON.stringify(updated));
    const users = JSON.parse(localStorage.getItem("genexis_users") || "{}");
    if (users[authUser.email]) {
      users[authUser.email] = { ...users[authUser.email], ...data };
      localStorage.setItem("genexis_users", JSON.stringify(users));
    }
  };

  const logout = () => {
    localStorage.removeItem("genexis_session");
    sessionStorage.removeItem("genexis_session");
    setAuthUser(null);
  };

  return <AuthContext.Provider value={{ authUser, signup, login, updateProfile, logout }}>{children}</AuthContext.Provider>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── THEME CONTEXT
// ══════════════════════════════════════════════════════════════════════════════
const ThemeContext = createContext<{ isDark: boolean; toggleTheme: () => void } | null>(null);
function useTheme() { return useContext(ThemeContext)!; }

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("genexis_theme");
    return saved ? saved === "dark" : true;
  });

  const toggleTheme = () => {
    setIsDark(d => {
      localStorage.setItem("genexis_theme", d ? "light" : "dark");
      return !d;
    });
  };

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

function useT() {
  const { isDark } = useTheme();
  return {
    isDark,
    bg:          isDark ? "#080c1a"                    : "#f0f4ff",
    bgCard:      isDark ? "rgba(255,255,255,0.04)"     : "rgba(255,255,255,0.85)",
    bgCardHover: isDark ? "rgba(255,255,255,0.07)"     : "rgba(255,255,255,0.95)",
    border:      isDark ? "rgba(255,255,255,0.08)"     : "rgba(0,0,0,0.08)",
    text:        isDark ? "rgba(255,255,255,0.9)"      : "rgba(15,23,42,0.9)",
    textMuted:   isDark ? "rgba(255,255,255,0.45)"     : "rgba(15,23,42,0.45)",
    textDim:     isDark ? "rgba(255,255,255,0.25)"     : "rgba(15,23,42,0.25)",
    inputBg:     isDark ? "rgba(255,255,255,0.05)"     : "rgba(15,23,42,0.05)",
    inputBorder: isDark ? "rgba(255,255,255,0.1)"      : "rgba(15,23,42,0.12)",
    accent:      "#6ee7b7",
    accentSecondary: "#3b82f6",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

const BIOTECH_QUOTES = [
  "The future of medicine is in the code of our DNA.",
  "Biotechnology is the ultimate toolkit for building a better world.",
  "Every cell is a universe of complexity waiting to be understood.",
  "Gene editing isn't just science; it's the art of rewriting life.",
  "The best way to predict the future is to engineer it."
];

function QuoteOverlay() {
  const [quote, setQuote] = useState("");
  const [show, setShow] = useState(false);
  const t = useT();

  useEffect(() => {
    const interval = setInterval(() => {
      setQuote(BIOTECH_QUOTES[Math.floor(Math.random() * BIOTECH_QUOTES.length)]);
      setShow(true);
      setTimeout(() => setShow(false), 5000);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 right-8 z-50 max-w-xs p-6 rounded-2xl border backdrop-blur-xl shadow-2xl"
          style={{ background: t.bgCard, borderColor: t.border }}
        >
          <Quote className="text-emerald-400 mb-2" size={20} />
          <p className="text-sm italic font-medium" style={{ color: t.text }}>{quote}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ educationLevel: "", interests: [] as string[], knowledgeLevel: "" });
  const t = useT();

  const INTERESTS = ["Genetics", "Microbiology", "Biochemistry", "Cell Biology", "Bioinformatics", "CRISPR"];

  const next = () => {
    if (step < 3) setStep(step + 1);
    else {
      updateProfile(data);
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bg }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg p-8 rounded-3xl border backdrop-blur-xl shadow-2xl"
        style={{ background: t.bgCard, borderColor: t.border }}
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold font-mono text-emerald-400">Profile Setup</h2>
          <span className="text-xs font-mono opacity-50">STEP {step} OF 3</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">What is your education level?</h3>
            {["High School", "Undergraduate", "Graduate", "Professional"].map(lvl => (
              <button key={lvl} onClick={() => setData({ ...data, educationLevel: lvl })}
                className={cn("w-full p-4 rounded-xl border text-left transition-all", data.educationLevel === lvl ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5")}
                style={{ borderColor: data.educationLevel === lvl ? undefined : t.border }}>
                {lvl}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Select topics of interest</h3>
            <div className="grid grid-cols-2 gap-3">
              {INTERESTS.map(topic => (
                <button key={topic} 
                  onClick={() => {
                    const next = data.interests.includes(topic) ? data.interests.filter(t => t !== topic) : [...data.interests, topic];
                    setData({ ...data, interests: next });
                  }}
                  className={cn("p-3 rounded-xl border text-sm font-medium transition-all", data.interests.includes(topic) ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5")}
                  style={{ borderColor: data.interests.includes(topic) ? undefined : t.border }}>
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Your current knowledge level?</h3>
            {["Beginner", "Intermediate", "Advanced"].map(lvl => (
              <button key={lvl} onClick={() => setData({ ...data, knowledgeLevel: lvl })}
                className={cn("w-full p-4 rounded-xl border text-left transition-all", data.knowledgeLevel === lvl ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5")}
                style={{ borderColor: data.knowledgeLevel === lvl ? undefined : t.border }}>
                {lvl}
              </button>
            ))}
          </div>
        )}

        <button onClick={next} disabled={step === 1 ? !data.educationLevel : step === 2 ? data.interests.length === 0 : !data.knowledgeLevel}
          className="w-full mt-8 py-4 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-black font-bold font-mono shadow-lg shadow-emerald-500/20 disabled:opacity-50">
          {step === 3 ? "COMPLETE" : "CONTINUE"}
        </button>
      </motion.div>
    </div>
  );
}

function LearningPath() {
  const t = useT();
  const stages = [
    { id: 1, title: "Biological Foundations", status: "completed", topics: ["Cell Structure", "Biomolecules"] },
    { id: 2, title: "Genetic Blueprints", status: "current", topics: ["DNA/RNA", "Gene Expression"] },
    { id: 3, title: "Advanced Biotech", status: "locked", topics: ["CRISPR", "Synthetic Biology"] },
    { id: 4, title: "Future Horizons", status: "locked", topics: ["Bioinformatics", "Nano-medicine"] },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold font-mono mb-8">Personalized Roadmap</h1>
      <div className="relative space-y-12">
        <div className="absolute left-8 top-0 bottom-0 w-1 bg-white/5" />
        {stages.map((stage, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            key={stage.id} className="relative flex items-start gap-12 group"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center z-10 shadow-xl transition-all group-hover:scale-110",
              stage.status === "completed" ? "bg-emerald-500 text-black" : 
              stage.status === "current" ? "bg-blue-500 text-white animate-pulse" : "bg-white/10 text-white/20"
            )}>
              {stage.status === "completed" ? <Check /> : <span className="font-mono font-bold">{stage.id}</span>}
            </div>
            <div className="flex-1 p-6 rounded-2xl border backdrop-blur-sm" style={{ background: t.bgCard, borderColor: t.border }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{stage.title}</h3>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest", 
                  stage.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : 
                  stage.status === "current" ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/20"
                )}>
                  {stage.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stage.topics.map(topic => (
                  <span key={topic} className="px-3 py-1 rounded-lg bg-white/5 text-xs font-medium border border-white/5">{topic}</span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function QuizPage({ topic }: { topic: string }) {
  const [quiz, setQuiz] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const t = useT();

  useEffect(() => {
    generateQuiz(topic).then(data => {
      setQuiz(data);
      setLoading(false);
    });
  }, [topic]);

  const handleAnswer = (idx: number) => {
    setSelected(idx);
    if (idx === quiz[current].correctAnswer) setScore(s => s + 1);
    setTimeout(() => {
      if (current < quiz.length - 1) {
        setCurrent(current + 1);
        setSelected(null);
      } else {
        setFinished(true);
      }
    }, 1000);
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-400" size={48} />
      <p className="font-mono text-sm animate-pulse">GENERATING NEURAL ASSESSMENT...</p>
    </div>
  );

  if (finished) return (
    <div className="h-full flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full p-8 rounded-3xl border text-center shadow-2xl" style={{ background: t.bgCard, borderColor: t.border }}>
        <Trophy className="mx-auto text-yellow-400 mb-4" size={64} />
        <h2 className="text-3xl font-bold mb-2">Assessment Complete</h2>
        <p className="text-emerald-400 font-mono text-xl mb-6">{score} / {quiz.length} CORRECT</p>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-emerald-500" style={{ width: `${(score/quiz.length)*100}%` }} />
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-4 rounded-xl bg-emerald-500 text-black font-bold font-mono">RETRY ASSESSMENT</button>
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-mono opacity-50">QUESTION {current + 1} OF {quiz.length}</span>
          <span className="text-xs font-mono text-emerald-400">{score} POINTS</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${((current+1)/quiz.length)*100}%` }} />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-8">{quiz[current]?.question}</h2>
      <div className="space-y-4">
        {quiz[current]?.options?.map((opt: string, i: number) => (
          <button key={i} onClick={() => handleAnswer(i)} disabled={selected !== null}
            className={cn(
              "w-full p-5 rounded-2xl border text-left transition-all font-medium",
              selected === i ? (i === quiz[current].correctAnswer ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-red-500/20 border-red-500 text-red-400") :
              selected !== null && i === quiz[current].correctAnswer ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "hover:bg-white/5"
            )}
            style={{ borderColor: selected === null ? t.border : undefined }}>
            <div className="flex items-center gap-4">
              <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-mono text-xs">{String.fromCharCode(65 + i)}</span>
              {opt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Analytics() {
  const t = useT();
  const data = [
    { name: 'Mon', xp: 400, accuracy: 85 },
    { name: 'Tue', xp: 300, accuracy: 70 },
    { name: 'Wed', xp: 600, accuracy: 90 },
    { name: 'Thu', xp: 800, accuracy: 95 },
    { name: 'Fri', xp: 500, accuracy: 80 },
    { name: 'Sat', xp: 900, accuracy: 100 },
    { name: 'Sun', xp: 700, accuracy: 88 },
  ];

  const radarData = [
    { subject: 'Genetics', A: 120, fullMark: 150 },
    { subject: 'Microbio', A: 98, fullMark: 150 },
    { subject: 'Biochem', A: 86, fullMark: 150 },
    { subject: 'Cell Bio', A: 99, fullMark: 150 },
    { subject: 'Ethics', A: 85, fullMark: 150 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold font-mono">Neural Analytics</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 rounded-3xl border" style={{ background: t.bgCard, borderColor: t.border }}>
          <h3 className="text-sm font-bold font-mono opacity-50 mb-8 uppercase tracking-widest">XP Progression</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                <XAxis dataKey="name" stroke={t.textDim} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={t.textDim} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px' }}
                  itemStyle={{ color: t.accent }}
                />
                <Line type="monotone" dataKey="xp" stroke={t.accent} strokeWidth={3} dot={{ r: 4, fill: t.accent }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 rounded-3xl border" style={{ background: t.bgCard, borderColor: t.border }}>
          <h3 className="text-sm font-bold font-mono opacity-50 mb-8 uppercase tracking-widest">Skill Matrix</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke={t.border} />
                <PolarAngleAxis dataKey="subject" stroke={t.textMuted} fontSize={10} />
                <Radar name="Student" dataKey="A" stroke={t.accentSecondary} fill={t.accentSecondary} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN SCREENS
// ══════════════════════════════════════════════════════════════════════════════

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", confirm: "", name: "", remember: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const { isDark } = useTheme();
  const t = useT();

  const set = (key: string, val: any) => { setForm(f => ({ ...f, [key]: val })); setError(""); };

  const submit = () => {
    if (!form.email.includes("@")) return setError("Invalid email address.");
    if (form.password.length < 6) return setError("Password must be 6+ chars.");
    if (mode === "signup" && form.password !== form.confirm) return setError("Passwords do not match.");
    
    setLoading(true);
    setTimeout(() => {
      const result = mode === "login" 
        ? login(form.email, form.password, form.remember)
        : signup(form.email, form.password, form.name);
      setLoading(false);
      if (!result.ok) setError(result.error || "Error");
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans transition-colors duration-500"
         style={{ background: t.bg }}>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 ${isDark ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 ${isDark ? 'bg-blue-600' : 'bg-blue-400'}`} />
      </div>

      <div className="w-full max-w-md p-6 relative z-10">
        <div className="text-center mb-8">
          <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-blue-500 mb-6 shadow-lg shadow-emerald-500/20">
            <Brain className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500 font-mono mb-2">
            GeneXis AI
          </h1>
          <p style={{ color: t.textMuted }}>Next-Gen Biotech Learning Platform</p>
        </div>

        <div className="backdrop-blur-xl rounded-3xl p-8 border shadow-2xl transition-all duration-300"
             style={{ background: t.bgCard, borderColor: t.border }}>
          
          <div className="flex p-1 rounded-xl mb-6" style={{ background: t.inputBg }}>
            {(["login", "signup"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-bold tracking-wider rounded-lg transition-all duration-300 font-mono",
                  mode === m ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                )}
                style={{ 
                  background: mode === m ? (isDark ? 'rgba(110,231,183,0.15)' : '#fff') : 'transparent',
                  color: mode === m ? t.accent : t.textMuted 
                }}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-bold tracking-widest mb-2 font-mono" style={{ color: t.accent }}>FULL NAME</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Alex Chen"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                  style={{ background: t.inputBg, borderColor: t.inputBorder, color: t.text }} />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold tracking-widest mb-2 font-mono" style={{ color: t.accent }}>EMAIL</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                style={{ background: t.inputBg, borderColor: t.inputBorder, color: t.text }} />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest mb-2 font-mono" style={{ color: t.accent }}>PASSWORD</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                style={{ background: t.inputBg, borderColor: t.inputBorder, color: t.text }} />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-bold tracking-widest mb-2 font-mono" style={{ color: t.accent }}>CONFIRM PASSWORD</label>
                <input type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)} placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
                  style={{ background: t.inputBg, borderColor: t.inputBorder, color: t.text }} />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <X size={14} /> {error}
              </div>
            )}

            <button onClick={submit} disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-sm tracking-wider font-mono transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20 mt-2"
              style={{ background: "linear-gradient(135deg, #34d399, #3b82f6)", color: "#0f172a" }}>
              {loading ? "PROCESSING..." : mode === "login" ? "ENTER SYSTEM" : "INITIALIZE ACCOUNT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, setView }: { user: UserProfile, setView: (v: string) => void }) {
  const t = useT();
  const TOPICS = [
    { id: "genetics", label: "Genetics", icon: <Brain size={18} />, color: "#34d399", progress: 65 },
    { id: "microbiology", label: "Microbiology", icon: <Zap size={18} />, color: "#60a5fa", progress: 0 },
    { id: "biochem", label: "Biochemistry", icon: <Flame size={18} />, color: "#f472b6", progress: 0 },
    { id: "cellbio", label: "Cell Biology", icon: <RefreshCw size={18} />, color: "#a78bfa", progress: 0 },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 font-mono">Welcome back, {user.name.split(' ')[0]}</h1>
          <p style={{ color: t.textMuted }}>Your neural pathways are ready for expansion.</p>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl border" style={{ background: t.bgCard, borderColor: t.border }}>
          <div className="text-right">
            <div className="text-xs font-bold opacity-50 uppercase tracking-widest">LEVEL {user.level}</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{user.xp} XP</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Award size={24} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Topics Mastered", value: "3/12", icon: <Trophy className="text-yellow-400" />, color: "rgba(250, 204, 21, 0.1)" },
          { label: "Current Streak", value: `${user.streak} Days`, icon: <Flame className="text-orange-400" />, color: "rgba(251, 146, 60, 0.1)" },
          { label: "XP Gained", value: user.xp.toLocaleString(), icon: <Zap className="text-emerald-400" />, color: "rgba(52, 211, 153, 0.1)" },
          { label: "Global Rank", value: "#42", icon: <Star className="text-purple-400" />, color: "rgba(167, 139, 250, 0.1)" },
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-2xl border transition-all hover:-translate-y-1"
               style={{ background: t.bgCard, borderColor: t.border }}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl" style={{ background: stat.color }}>{stat.icon}</div>
            </div>
            <div className="text-2xl font-bold font-mono mb-1">{stat.value}</div>
            <div className="text-xs font-bold tracking-wider opacity-60 uppercase">{stat.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-bold tracking-widest opacity-50 mb-6 font-mono">CONTINUE LEARNING</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TOPICS.map((topic, i) => (
          <button key={topic.id} onClick={() => setView("learn")}
            className="group p-6 rounded-2xl border text-left transition-all hover:scale-[1.01]"
            style={{ background: t.bgCard, borderColor: t.border }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                   style={{ background: topic.color }}>
                {topic.icon}
              </div>
              <div>
                <h3 className="font-bold text-lg">{topic.label}</h3>
                <p className="text-xs opacity-60">{topic.progress > 0 ? "In Progress" : "Locked"}</p>
              </div>
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight />
              </div>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: t.inputBg }}>
              <div className="h-full rounded-full transition-all duration-1000"
                   style={{ width: `${topic.progress}%`, background: topic.color }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LearningModule({ setView }: { setView: (v: string) => void }) {
  const t = useT();
  const [activeTab, setActiveTab] = useState(0);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateLearningContent("Genetics").then(data => {
      setContent(data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-emerald-400" size={48} />
      <p className="font-mono text-sm animate-pulse">SYNTHESIZING KNOWLEDGE BASE...</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto p-6 animate-in slide-in-from-right-10 duration-500">
      <button onClick={() => setView("dashboard")} className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 mb-6 transition-opacity">
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex-1 rounded-3xl border overflow-hidden flex flex-col md:flex-row"
           style={{ background: t.bgCard, borderColor: t.border }}>
        
        {/* Sidebar */}
        <div className="w-full md:w-72 border-r p-6 flex flex-col gap-2" style={{ borderColor: t.border }}>
          <h2 className="font-bold text-xl mb-4">{content?.title}</h2>
          {content?.sections?.map((s: any, i: number) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={cn(
                "text-left px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === i ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 opacity-70'
              )}>
              {i + 1}. {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto">
          <div className="max-w-3xl">
            {content?.sections?.[activeTab] && (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold mb-6 font-mono text-emerald-400">{content.sections[activeTab].title}</h1>
                <div className="prose prose-invert max-w-none">
                  <Markdown>{content.sections[activeTab].content}</Markdown>
                </div>
                
                <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 my-8">
                  <h4 className="text-blue-400 font-bold text-xs tracking-widest mb-3 font-mono">AI INSIGHT</h4>
                  <p className="text-sm opacity-80">
                    This concept is fundamental to modern biotechnology. Understanding it allows us to manipulate biological systems at the molecular level.
                  </p>
                </div>

                <div className="flex gap-4 mt-12">
                   <button onClick={() => setActiveTab(Math.max(0, activeTab - 1))} className="px-6 py-3 rounded-xl border font-bold text-sm transition-all hover:bg-white/5" style={{ borderColor: t.border }}>
                     Previous
                   </button>
                   <button onClick={() => setView("quiz")} className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 ml-auto">
                     Take Quiz
                   </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatAssistant() {
  const t = useT();
  const [msgs, setMsgs] = useState([{ role: "ai", text: "Hello! I'm your GeneXis tutor. Ask me anything about genetics or biology." }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const send = async () => {
    if (!input.trim()) return;
    const txt = input;
    setInput("");
    setMsgs(p => [...p, { role: "user", text: txt }]);
    setTyping(true);
    
    try {
      const history = msgs.map(m => ({ role: m.role === 'user' ? 'user' as const : 'model' as const, parts: [{ text: m.text }] }));
      const response = await getChatResponse(txt, history);
      setMsgs(p => [...p, { role: "ai", text: response || "I'm sorry, I couldn't process that." }]);
    } catch (e) {
      setMsgs(p => [...p, { role: "ai", text: "Error connecting to neural network." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex-1 rounded-3xl border overflow-hidden flex flex-col shadow-2xl"
           style={{ background: t.bgCard, borderColor: t.border }}>
        
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: t.border, background: t.bgCardHover }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
              <Brain size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">GeneXis Tutor</h3>
              <div className="flex items-center gap-1.5 opacity-60 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
              </div>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/5 opacity-50"><Info size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                m.role === "user" 
                  ? "bg-indigo-600 text-white rounded-tr-sm" 
                  : "bg-white/10 border border-white/5 rounded-tl-sm"
              )}>
                <Markdown>{m.text}</Markdown>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-white/10 p-4 rounded-2xl rounded-tl-sm flex gap-1">
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t" style={{ borderColor: t.border, background: t.bgCardHover }}>
          <div className="flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask about biology..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={send} className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#346899");
  const [brushSize, setBrushSize] = useState(4);
  const t = useT();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = t.isDark ? "#0f172a" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [t.isDark]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = t.isDark ? "#0f172a" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="h-full p-6 flex flex-col max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono">Creative Lab</h1>
          <p className="text-sm opacity-60">Draw diagrams, take notes, or just relax.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-3 rounded-2xl border bg-white/5" style={{ borderColor: t.border }}>
          <div className="flex gap-2">
            {["#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fbbf24"].map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={cn("w-8 h-8 rounded-full border-2 transition-transform", color === c ? 'scale-125 border-white' : 'border-transparent')}
                style={{ background: c }} />
            ))}
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <input type="range" min="1" max="20" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24 accent-emerald-500" />
          <div className="h-8 w-px bg-white/10 mx-2" />
          <button onClick={clear} className="p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-bold font-mono">
            <Eraser size={16} /> CLEAR
          </button>
        </div>
      </div>
      
      <canvas 
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={() => setIsDrawing(false)}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={() => setIsDrawing(false)}
        onTouchMove={draw}
        className="flex-1 w-full rounded-3xl border shadow-inner cursor-crosshair touch-none"
        style={{ borderColor: t.border, background: t.isDark ? "#0f172a" : "#ffffff" }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN LAYOUT
// ══════════════════════════════════════════════════════════════════════════════

function AppLayout() {
  const { authUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const t = useT();

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "learn", label: "Learning Path", icon: BookOpen },
    { id: "roadmap", label: "Roadmap", icon: Target },
    { id: "chat", label: "AI Tutor", icon: MessageSquare },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "canvas", label: "Creative Lab", icon: Palette },
  ];

  if (!authUser?.educationLevel) return <ProfileSetup onComplete={() => setView("dashboard")} />;

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-500 font-sans" style={{ background: t.bg, color: t.text }}>
      
      {/* Sidebar */}
      <aside className={cn(
        "flex-shrink-0 border-r transition-all duration-300 flex flex-col z-20",
        sidebarOpen ? 'w-64' : 'w-20'
      )}
      style={{ borderColor: t.border, background: t.bgCard }}>
        
        <div className="h-20 flex items-center justify-center border-b" style={{ borderColor: t.border }}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Brain size={24} />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold font-mono text-lg tracking-tight">GeneXis</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={cn(
                "w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative",
                view === item.id ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 opacity-60 hover:opacity-100'
              )}>
              <item.icon size={20} className={view === item.id ? "animate-pulse" : ""} />
              {sidebarOpen && <span className="ml-3 font-medium text-sm">{item.label}</span>}
              {!sidebarOpen && view === item.id && <div className="absolute left-0 w-1 h-8 bg-emerald-400 rounded-r-full" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2" style={{ borderColor: t.border }}>
          <button onClick={toggleTheme} className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors opacity-60 hover:opacity-100">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b flex items-center justify-between px-8" style={{ borderColor: t.border, background: t.bgCard }}>
          <div className="flex items-center gap-4 opacity-50">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hover:text-emerald-400 transition-colors">
              {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
            </button>
            <span className="text-sm font-mono uppercase tracking-widest">{view}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono" style={{ borderColor: t.border }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM ONLINE
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {authUser.name[0]}
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {view === "dashboard" && <Dashboard user={authUser} setView={setView} />}
              {view === "learn" && <LearningModule setView={setView} />}
              {view === "roadmap" && <LearningPath />}
              {view === "chat" && <ChatAssistant />}
              {view === "analytics" && <Analytics />}
              {view === "canvas" && <Canvas />}
              {view === "quiz" && <QuizPage topic="Genetics" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <QuoteOverlay />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthWrapper />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthWrapper() {
  const { authUser } = useAuth();
  return authUser ? <AppLayout /> : <AuthScreen />;
}
