import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const COLORS = {
  void: "#050510",
  deep: "#0a0a1a",
  card: "#0d0d20",
  cardBorder: "#1a1a35",
  accent: "#7c3aed",
  accentGlow: "#9d5cff",
  teal: "#0ea5e9",
  tealGlow: "#38bdf8",
  rose: "#f43f5e",
  amber: "#f59e0b",
  green: "#10b981",
  textPrimary: "#e8e3ff",
  textSecondary: "#9491b4",
  textMuted: "#5c5980",
};

const SCENES = {
  calm: { name: "Ocean Sanctuary", emoji: "🌊", bg: "radial-gradient(ellipse at 50% 100%, #0c2340 0%, #050510 60%)", particles: "💧" },
  anxious: { name: "Mountain Clarity", emoji: "🏔️", bg: "radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #050510 70%)", particles: "❄️" },
  confident: { name: "Golden Aurora", emoji: "🌅", bg: "radial-gradient(ellipse at 30% 50%, #2a1a00 0%, #050510 70%)", particles: "✨" },
  neutral: { name: "Cosmic Void", emoji: "🌌", bg: "radial-gradient(ellipse at center, #0a0520 0%, #050510 80%)", particles: "⭐" },
  sad: { name: "Misty Forest", emoji: "🌿", bg: "radial-gradient(ellipse at 50% 30%, #051a10 0%, #050510 70%)", particles: "🍃" },
};

const FEAR_NODES = [
  { id: 1, label: "Public Speaking", intensity: 78, x: 200, y: 120, color: COLORS.rose },
  { id: 2, label: "Social Anxiety", intensity: 62, x: 380, y: 80, color: COLORS.accent },
  { id: 3, label: "Failure", intensity: 85, x: 520, y: 160, color: COLORS.rose },
  { id: 4, label: "Rejection", intensity: 55, x: 150, y: 240, color: COLORS.amber },
  { id: 5, label: "Change", intensity: 40, x: 330, y: 220, color: COLORS.teal },
  { id: 6, label: "Uncertainty", intensity: 70, x: 470, y: 260, color: COLORS.accent },
  { id: 7, label: "Judgment", intensity: 60, x: 240, y: 310, color: COLORS.amber },
  { id: 8, label: "Loss", intensity: 45, x: 420, y: 330, color: COLORS.teal },
];

const ROLEPLAY_SCENARIOS = [
  { id: "lincoln", name: "Lincoln's Resolve", icon: "🎩", description: "Channel Abraham Lincoln before his Gettysburg Address. Face your fear of public scrutiny.", theme: "courage" },
  { id: "curie", name: "Curie's Curiosity", icon: "⚗️", description: "Become Marie Curie in her lab — embracing uncertainty and the unknown.", theme: "discovery" },
  { id: "mandela", name: "Mandela's Vision", icon: "🕊️", description: "Walk in Mandela's shoes — transforming fear of opposition into peaceful strength.", theme: "resilience" },
  { id: "tesla", name: "Tesla's Obsession", icon: "⚡", description: "Embody Tesla — turning social anxiety into focused creative genius.", theme: "focus" },
];

const AFFIRMATIONS = [
  "Your emotions are valid signals, not permanent states.",
  "Every breath you take is a step toward understanding yourself.",
  "Courage is not the absence of fear — it is choosing to grow through it.",
  "You are the author of your own story.",
  "Healing is not linear. Every moment of awareness matters.",
];

export default function MindScapeVR() {
  const [activeTab, setActiveTab] = useState("home");
  const [mood, setMood] = useState("neutral");
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [affirmationIndex, setAffirmationIndex] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [emotionScore, setEmotionScore] = useState({ calm: 0, energy: 0, clarity: 0 });
  const [voiceActive, setVoiceActive] = useState(false);
  const [particles, setParticles] = useState([]);
  const [fearNodes, setFearNodes] = useState(FEAR_NODES);
  const [breathPhase, setBreathPhase] = useState("inhale");
  const [breathCount, setBreathCount] = useState(0);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [patternAlert, setPatternAlert] = useState(null);
  const chatEndRef = useRef(null);
  const breathRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setAffirmationIndex(i => (i + 1) % AFFIRMATIONS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ps = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 20 + 10,
      opacity: Math.random() * 0.5 + 0.2,
    }));
    setParticles(ps);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const detectMoodFromText = (text) => {
    const lower = text.toLowerCase();
    if (/anxious|scared|worry|nervous|panic|fear|stress/.test(lower)) return "anxious";
    if (/sad|depress|hopeless|alone|lonely|cry/.test(lower)) return "sad";
    if (/confident|strong|ready|excit|great|amazing/.test(lower)) return "confident";
    if (/calm|peace|relax|breath|okay|better/.test(lower)) return "calm";
    return "neutral";
  };

  const buildSystemPrompt = (tab, scenario) => {
    const basePersonality = `You are MindScape — an empathetic AI therapy companion with deep emotional intelligence. You speak with warmth, wisdom, and precision. You never give generic advice. You tune into the user's exact words and feelings.

Current user mood: ${mood}
Session history summary: ${sessionHistory.slice(-3).join("; ")}

Key principles:
- Mirror their emotional tone gently
- Ask one powerful question at a time
- Offer specific, actionable micro-techniques
- Celebrate small progress
- Never dismiss or minimize their feelings
- Keep responses to 2-3 short paragraphs max`;

    if (tab === "therapy") {
      return basePersonality + `\n\nYou are conducting a personalized therapy session. Help the user explore their emotions, identify patterns, and build coping strategies. Reference their fear genome data when relevant.`;
    }
    if (tab === "roleplay" && scenario) {
      const s = ROLEPLAY_SCENARIOS.find(r => r.id === scenario);
      return basePersonality + `\n\nYou are facilitating an immersive historical roleplay. The user is embodying ${s?.name}. Channel the essence of this historical figure to help them embody the theme of "${s?.theme}". Speak as if you are a wise guide helping them step into this character's mindset. Reference historical context naturally.`;
    }
    if (tab === "breathwork") {
      return basePersonality + `\n\nYou are guiding a breathwork session. Give gentle, timed instructions for breathing exercises. Use poetic, calming language.`;
    }
    return basePersonality;
  };

  const sendMessage = async (text = inputText) => {
    if (!text.trim() || isLoading) return;
    const detectedMood = detectMoodFromText(text);
    setMood(detectedMood);

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    setSessionHistory(h => [...h, `User said: ${text.slice(0, 60)}`]);

    if (sessionHistory.length > 0 && /avoid|can't|impossible|never/.test(text.toLowerCase())) {
      setPatternAlert("Avoidance pattern detected. Let's gently explore this together.");
      setTimeout(() => setPatternAlert(null), 6000);
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: buildSystemPrompt(activeTab, selectedScenario),
          messages: newMessages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.map(c => c.text || "").join("") || "I'm here with you. Tell me more.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
      setSessionHistory(h => [...h, `AI responded about: ${reply.slice(0, 60)}`]);

      const calm = reply.match(/breath|calm|peace|gentle|safe/gi)?.length || 0;
      const energy = reply.match(/strength|power|courage|bold|rise/gi)?.length || 0;
      const clarity = reply.match(/clear|understand|realize|see|insight/gi)?.length || 0;
      setEmotionScore(s => ({
        calm: Math.min(100, s.calm + calm * 10),
        energy: Math.min(100, s.energy + energy * 10),
        clarity: Math.min(100, s.clarity + clarity * 10),
      }));

      setFearNodes(nodes => nodes.map(n => ({
        ...n,
        intensity: Math.max(10, n.intensity - (Math.random() > 0.7 ? 3 : 0)),
      })));
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "I'm still here. Take a breath — let's continue when you're ready." }]);
    }
    setIsLoading(false);
  };

  const startBreathwork = () => {
    setBreathPhase("inhale");
    setBreathCount(0);
    let count = 0;
    const cycle = () => {
      setBreathPhase("inhale");
      breathRef.current = setTimeout(() => {
        setBreathPhase("hold");
        breathRef.current = setTimeout(() => {
          setBreathPhase("exhale");
          breathRef.current = setTimeout(() => {
            count++;
            setBreathCount(count);
            if (count < 5) cycle();
            else setBreathPhase("complete");
          }, 4000);
        }, 4000);
      }, 4000);
    };
    cycle();
  };

  const toggleVoice = () => {
    if (!voiceActive) {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("Voice recognition not supported in this browser."); return; }
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.onresult = (e) => {
          const transcript = e.results[0][0].transcript;
          setInputText(transcript);
          setVoiceActive(false);
        };
        recognitionRef.current.onerror = () => setVoiceActive(false);
        recognitionRef.current.onend = () => setVoiceActive(false);
        recognitionRef.current.start();
        setVoiceActive(true);
      } catch { setVoiceActive(false); }
    } else {
      recognitionRef.current?.stop();
      setVoiceActive(false);
    }
  };

  const scene = SCENES[mood] || SCENES.neutral;

  const styles = {
    root: {
      minHeight: "100vh",
      background: COLORS.void,
      color: COLORS.textPrimary,
      fontFamily: "'Georgia', serif",
      position: "relative",
      overflow: "hidden",
    },
    sceneOverlay: {
      position: "fixed", inset: 0, zIndex: 0,
      background: scene.bg,
      transition: "background 2s ease",
      pointerEvents: "none",
    },
    particle: (p) => ({
      position: "fixed",
      left: `${p.x}%`,
      fontSize: `${p.size * 6}px`,
      opacity: p.opacity,
      animation: `float ${p.speed}s ease-in-out infinite`,
      animationDelay: `${p.id * 0.5}s`,
      pointerEvents: "none",
      zIndex: 1,
      top: `${p.y}%`,
    }),
    nav: {
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(5,5,16,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: `1px solid ${COLORS.cardBorder}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem", height: "64px",
    },
    logo: {
      display: "flex", alignItems: "center", gap: "10px",
      fontSize: "1.25rem", fontWeight: "700", color: COLORS.textPrimary,
      letterSpacing: "-0.02em",
    },
    logoAccent: { color: COLORS.accentGlow },
    navLinks: { display: "flex", gap: "0.25rem" },
    navLink: (active) => ({
      padding: "0.4rem 0.9rem", borderRadius: "999px", cursor: "pointer",
      fontSize: "0.85rem", fontFamily: "'Georgia', serif",
      background: active ? `rgba(124,58,237,0.2)` : "transparent",
      border: active ? `1px solid rgba(124,58,237,0.4)` : "1px solid transparent",
      color: active ? COLORS.accentGlow : COLORS.textSecondary,
      transition: "all 0.2s",
    }),
    main: { paddingTop: "64px", position: "relative", zIndex: 10, minHeight: "100vh" },
    hero: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "calc(100vh - 64px)", textAlign: "center", padding: "2rem",
    },
    heroEyebrow: {
      fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase",
      color: COLORS.accentGlow, marginBottom: "1rem",
    },
    heroTitle: {
      fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: "700",
      lineHeight: "1.1", marginBottom: "1.5rem",
      background: `linear-gradient(135deg, ${COLORS.textPrimary} 0%, ${COLORS.accentGlow} 60%, ${COLORS.tealGlow} 100%)`,
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    heroSub: {
      fontSize: "1.1rem", color: COLORS.textSecondary, maxWidth: "560px",
      lineHeight: "1.7", marginBottom: "2.5rem",
    },
    affirmation: {
      fontSize: "0.95rem", color: COLORS.textMuted, fontStyle: "italic",
      maxWidth: "440px", lineHeight: "1.6",
      padding: "1rem 1.5rem",
      border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: "12px",
      background: "rgba(13,13,32,0.6)",
      transition: "opacity 0.8s",
    },
    ctaRow: { display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "2rem" },
    btnPrimary: {
      padding: "0.75rem 2rem", borderRadius: "999px", border: "none", cursor: "pointer",
      background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.teal})`,
      color: "#fff", fontSize: "0.95rem", fontWeight: "600",
      boxShadow: `0 0 30px rgba(124,58,237,0.4)`,
      transition: "transform 0.2s, box-shadow 0.2s",
    },
    btnSecondary: {
      padding: "0.75rem 2rem", borderRadius: "999px", cursor: "pointer",
      background: "transparent",
      border: `1px solid ${COLORS.cardBorder}`,
      color: COLORS.textSecondary, fontSize: "0.95rem",
      transition: "all 0.2s",
    },
    section: { padding: "4rem 2rem", maxWidth: "1100px", margin: "0 auto" },
    sectionTitle: { fontSize: "2rem", fontWeight: "700", marginBottom: "0.5rem" },
    sectionSub: { color: COLORS.textSecondary, marginBottom: "2.5rem", fontSize: "1rem" },
    grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" },
    card: {
      background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: "16px", padding: "1.5rem",
      transition: "border-color 0.3s, transform 0.2s",
    },
    cardIcon: { fontSize: "2rem", marginBottom: "0.75rem" },
    cardTitle: { fontSize: "1.05rem", fontWeight: "600", marginBottom: "0.4rem" },
    cardDesc: { fontSize: "0.875rem", color: COLORS.textSecondary, lineHeight: "1.6" },
    moodBar: {
      display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem",
    },
    moodBtn: (m) => ({
      padding: "0.35rem 0.85rem", borderRadius: "999px", cursor: "pointer", fontSize: "0.8rem",
      background: mood === m ? "rgba(124,58,237,0.2)" : "transparent",
      border: mood === m ? `1px solid ${COLORS.accentGlow}` : `1px solid ${COLORS.cardBorder}`,
      color: mood === m ? COLORS.accentGlow : COLORS.textSecondary,
      transition: "all 0.2s",
    }),
    chatArea: {
      flex: 1, overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1rem",
      maxHeight: "420px",
    },
    chatBubble: (role) => ({
      maxWidth: "80%", padding: "0.85rem 1.1rem",
      borderRadius: role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background: role === "user"
        ? `linear-gradient(135deg, rgba(124,58,237,0.3), rgba(14,165,233,0.2))`
        : "rgba(20,20,40,0.9)",
      border: `1px solid ${role === "user" ? "rgba(124,58,237,0.3)" : COLORS.cardBorder}`,
      fontSize: "0.9rem", lineHeight: "1.6",
      color: COLORS.textPrimary,
    }),
    inputRow: {
      display: "flex", gap: "0.5rem", padding: "1rem 1.5rem",
      borderTop: `1px solid ${COLORS.cardBorder}`,
      background: "rgba(5,5,16,0.8)",
    },
    input: {
      flex: 1, background: "rgba(13,13,32,0.9)",
      border: `1px solid ${COLORS.cardBorder}`, borderRadius: "999px",
      padding: "0.6rem 1.2rem", color: COLORS.textPrimary,
      fontSize: "0.9rem", outline: "none",
    },
    sendBtn: {
      padding: "0.6rem 1.2rem", borderRadius: "999px", border: "none", cursor: "pointer",
      background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.teal})`,
      color: "#fff", fontSize: "0.85rem",
    },
    voiceBtn: (active) => ({
      padding: "0.6rem 0.8rem", borderRadius: "999px", cursor: "pointer",
      background: active ? `rgba(244,63,94,0.2)` : "transparent",
      border: `1px solid ${active ? COLORS.rose : COLORS.cardBorder}`,
      color: active ? COLORS.rose : COLORS.textSecondary, fontSize: "1rem",
    }),
    breathCircle: (phase) => ({
      width: "160px", height: "160px", borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", margin: "2rem auto",
      transform: phase === "inhale" ? "scale(1.3)" : phase === "exhale" ? "scale(0.85)" : "scale(1.1)",
      transition: "transform 4s ease-in-out",
      background: `radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(14,165,233,0.1) 100%)`,
      border: `2px solid rgba(124,58,237,0.4)`,
      boxShadow: `0 0 40px rgba(124,58,237,0.3)`,
    }),
    fearCanvas: {
      position: "relative", height: "380px",
      background: "rgba(5,5,16,0.6)", borderRadius: "16px",
      border: `1px solid ${COLORS.cardBorder}`, overflow: "hidden",
    },
    fearNode: (node) => ({
      position: "absolute",
      left: `${node.x}px`, top: `${node.y}px`,
      width: `${node.intensity * 0.7 + 30}px`, height: `${node.intensity * 0.7 + 30}px`,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${node.color}40 0%, ${node.color}10 100%)`,
      border: `1px solid ${node.color}60`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column",
      cursor: "pointer", transition: "all 0.5s",
      transform: `translate(-50%, -50%)`,
    }),
    progressBar: (val, color) => ({
      height: "6px", borderRadius: "3px",
      background: `linear-gradient(90deg, ${color} ${val}%, rgba(255,255,255,0.05) ${val}%)`,
      marginBottom: "0.75rem",
    }),
    badge: {
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.3rem 0.8rem", borderRadius: "999px",
      background: "rgba(124,58,237,0.15)", border: `1px solid rgba(124,58,237,0.3)`,
      fontSize: "0.75rem", color: COLORS.accentGlow,
    },
    alert: {
      position: "fixed", bottom: "2rem", right: "2rem", zIndex: 200,
      background: "rgba(244,63,94,0.15)", border: `1px solid rgba(244,63,94,0.4)`,
      borderRadius: "12px", padding: "1rem 1.25rem",
      maxWidth: "300px", fontSize: "0.875rem",
      color: COLORS.textPrimary, backdropFilter: "blur(10px)",
    },
  };

  const tabs = [
    { id: "home", label: "Home" },
    { id: "therapy", label: "Therapy" },
    { id: "genome", label: "Fear Map" },
    { id: "roleplay", label: "Roleplay" },
    { id: "breathwork", label: "Breathwork" },
    { id: "insights", label: "Insights" },
  ];

  const FEATURES = [
    { icon: "🧬", title: "Fear Genome Mapping", desc: "Unsupervised ML clusters your fear patterns into a living visualization — updated after every session." },
    { icon: "🎭", title: "Historical Roleplay", desc: "Embody Lincoln, Curie, or Mandela — AI-coached scenarios that rewire confidence through narrative." },
    { icon: "🌊", title: "Emotion-Responsive Scenes", desc: "The environment shifts in real-time based on your detected emotional state — from ocean calm to mountain clarity." },
    { icon: "🎙️", title: "Voice Emotion Analysis", desc: "Speak freely. The AI reads your tone, pitch, and pace to personalize every response." },
    { icon: "🔮", title: "Pattern Intelligence", desc: "Recognizes avoidance loops and anxiety spirals before they escalate — gentle nudges keep you progressing." },
    { icon: "📖", title: "Storyflow Generator", desc: "Your emotional journey becomes a personalized narrative quest — unique to your fear genome." },
  ];

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${COLORS.void}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.cardBorder}; border-radius: 2px; }
      `}</style>

      <div style={styles.sceneOverlay} />
      {particles.map(p => (
        <div key={p.id} style={styles.particle(p)}>{scene.particles}</div>
      ))}

      {patternAlert && (
        <div style={styles.alert}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>🔮 Pattern Detected</div>
          <div style={{ color: COLORS.textSecondary, fontSize: "0.8rem" }}>{patternAlert}</div>
        </div>
      )}

      <nav style={styles.nav}>
        <div style={styles.logo}>
          <span>🧠</span>
          <span>Mind<span style={styles.logoAccent}>Scape</span> VR</span>
        </div>
        <div style={styles.navLinks}>
          {tabs.map(t => (
            <button key={t.id} style={styles.navLink(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={styles.badge}>
          <span style={{ fontSize: "0.65rem" }}>●</span>
          Scene: {scene.name} {scene.emoji}
        </div>
      </nav>

      <main style={styles.main}>
        {/* HOME */}
        {activeTab === "home" && (
          <div style={styles.hero}>
            <div style={{ animation: "fadeIn 0.8s ease" }}>
              <div style={styles.heroEyebrow}>Emotional Intelligence · AI Therapy · Immersive Healing</div>
              <h1 style={styles.heroTitle}>Heal Through<br />Understanding</h1>
              <p style={styles.heroSub}>
                An AI emotional companion that listens to your tone, reads your patterns, and guides you through fear, doubt, and growth — one session at a time.
              </p>
              <div style={styles.ctaRow}>
                <button style={styles.btnPrimary} onClick={() => setActiveTab("therapy")}>
                  Begin Your Journey →
                </button>
                <button style={styles.btnSecondary} onClick={() => setActiveTab("genome")}>
                  View Fear Map
                </button>
              </div>
              <div style={styles.affirmation}>"{AFFIRMATIONS[affirmationIndex]}"</div>
            </div>
          </div>
        )}

        {/* FEATURES on home */}
        {activeTab === "home" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>How It Works</h2>
            <p style={styles.sectionSub}>Six interconnected systems working in harmony to understand and heal you.</p>
            <div style={styles.grid3}>
              {FEATURES.map((f, i) => (
                <div key={i} style={styles.card}>
                  <div style={styles.cardIcon}>{f.icon}</div>
                  <div style={styles.cardTitle}>{f.title}</div>
                  <div style={styles.cardDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* THERAPY */}
        {activeTab === "therapy" && (
          <div style={{ ...styles.section, maxWidth: "760px" }}>
            <h2 style={styles.sectionTitle}>Therapy Session</h2>
            <p style={styles.sectionSub}>Your AI companion is listening — with full emotional intelligence.</p>

            <div style={styles.moodBar}>
              {Object.keys(SCENES).map(m => (
                <button key={m} style={styles.moodBtn(m)} onClick={() => setMood(m)}>
                  {SCENES[m].emoji} {m}
                </button>
              ))}
            </div>

            <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${COLORS.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.9rem", color: COLORS.textSecondary }}>
                  {scene.emoji} {scene.name} · Mood: <span style={{ color: COLORS.accentGlow }}>{mood}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>
                  {messages.length > 0 ? `${Math.ceil(messages.length / 2)} exchanges` : "New session"}
                </div>
              </div>

              <div style={styles.chatArea}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🌿</div>
                    <div>Share what's on your mind. I'm here, without judgment.</div>
                    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                      {["I'm feeling anxious today", "I have a fear of failure", "I struggle with confidence"].map(s => (
                        <button key={s} style={{ ...styles.btnSecondary, padding: "0.35rem 0.85rem", fontSize: "0.8rem" }}
                          onClick={() => sendMessage(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={styles.chatBubble(m.role)}>{m.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div style={{ alignSelf: "flex-start" }}>
                    <div style={{ ...styles.chatBubble("assistant"), animation: "pulse 1.5s infinite" }}>
                      <span style={{ color: COLORS.textMuted }}>Listening and thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={styles.inputRow}>
                <button style={styles.voiceBtn(voiceActive)} onClick={toggleVoice} title="Voice input">
                  {voiceActive ? "🔴" : "🎙️"}
                </button>
                <input
                  style={styles.input}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Speak your truth..."
                />
                <button style={styles.sendBtn} onClick={() => sendMessage()} disabled={isLoading}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FEAR GENOME */}
        {activeTab === "genome" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Fear Genome Map</h2>
            <p style={styles.sectionSub}>Your unique fear patterns — visualized, tracked, and diminishing with each session.</p>

            <div style={styles.fearCanvas}>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                {fearNodes.map((n, i) =>
                  fearNodes.slice(i + 1).map((n2, j) => (
                    <line key={`${n.id}-${n2.id}`}
                      x1={n.x} y1={n.y} x2={n2.x} y2={n2.y}
                      stroke="rgba(124,58,237,0.08)" strokeWidth="1"
                    />
                  ))
                )}
              </svg>
              {fearNodes.map(node => (
                <div key={node.id} style={styles.fearNode(node)}
                  onClick={() => { setActiveTab("therapy"); sendMessage(`Let's talk about my fear of ${node.label}`); }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: "600", color: node.color, textAlign: "center", padding: "0.2rem" }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: `${node.color}99` }}>{node.intensity}%</div>
                </div>
              ))}
              <div style={{ position: "absolute", bottom: "1rem", right: "1rem", fontSize: "0.75rem", color: COLORS.textMuted }}>
                Click a node to begin therapy →
              </div>
            </div>

            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Fear Intensity Tracker</h3>
              {fearNodes.map(node => (
                <div key={node.id} style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                    <span>{node.label}</span>
                    <span style={{ color: node.color }}>{node.intensity}%</span>
                  </div>
                  <div style={styles.progressBar(node.intensity, node.color)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROLEPLAY */}
        {activeTab === "roleplay" && (
          <div style={{ ...styles.section, maxWidth: "900px" }}>
            <h2 style={styles.sectionTitle}>Historical Roleplay</h2>
            <p style={styles.sectionSub}>Step into the mindset of history's most resilient figures. Let their story become your strength.</p>

            {!selectedScenario ? (
              <div style={styles.grid3}>
                {ROLEPLAY_SCENARIOS.map(s => (
                  <div key={s.id} style={{ ...styles.card, cursor: "pointer" }}
                    onClick={() => { setSelectedScenario(s.id); setMessages([]); }}>
                    <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>{s.icon}</div>
                    <div style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>{s.name}</div>
                    <div style={{ fontSize: "0.85rem", color: COLORS.textSecondary, lineHeight: "1.6", marginBottom: "1rem" }}>{s.description}</div>
                    <div style={{ ...styles.badge, fontSize: "0.7rem" }}>Theme: {s.theme}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ maxWidth: "660px", margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {ROLEPLAY_SCENARIOS.find(s => s.id === selectedScenario)?.icon}{" "}
                      {ROLEPLAY_SCENARIOS.find(s => s.id === selectedScenario)?.name}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>Immersive roleplay session</div>
                  </div>
                  <button style={styles.btnSecondary} onClick={() => { setSelectedScenario(null); setMessages([]); }}>
                    ← Back
                  </button>
                </div>

                <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
                  <div style={styles.chatArea}>
                    {messages.length === 0 && (
                      <div style={{ textAlign: "center", padding: "2rem", color: COLORS.textMuted }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
                          {ROLEPLAY_SCENARIOS.find(s => s.id === selectedScenario)?.icon}
                        </div>
                        <div>Begin your journey. What moment are you facing?</div>
                        <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                          {["I'm about to face a crowd", "I'm doubting myself", "I feel like giving up"].map(s => (
                            <button key={s} style={{ ...styles.btnSecondary, padding: "0.35rem 0.85rem", fontSize: "0.8rem" }}
                              onClick={() => sendMessage(s)}>{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={styles.chatBubble(m.role)}>{m.content}</div>
                      </div>
                    ))}
                    {isLoading && (
                      <div style={{ alignSelf: "flex-start" }}>
                        <div style={{ ...styles.chatBubble("assistant"), animation: "pulse 1.5s infinite" }}>
                          <span style={{ color: COLORS.textMuted }}>Channeling the spirit...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div style={styles.inputRow}>
                    <button style={styles.voiceBtn(voiceActive)} onClick={toggleVoice}>
                      {voiceActive ? "🔴" : "🎙️"}
                    </button>
                    <input style={styles.input} value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendMessage()}
                      placeholder="What are you feeling in this moment..." />
                    <button style={styles.sendBtn} onClick={() => sendMessage()} disabled={isLoading}>Send</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BREATHWORK */}
        {activeTab === "breathwork" && (
          <div style={{ ...styles.section, maxWidth: "700px", textAlign: "center" }}>
            <h2 style={styles.sectionTitle}>Breathwork Sessions</h2>
            <p style={styles.sectionSub}>Box breathing — 4 counts inhale, 4 hold, 4 exhale. Five cycles.</p>

            <div style={styles.breathCircle(breathPhase)}>
              <div style={{ fontSize: "2rem" }}>
                {breathPhase === "inhale" ? "↑" : breathPhase === "hold" ? "◉" : breathPhase === "exhale" ? "↓" : "✓"}
              </div>
              <div style={{ fontSize: "0.85rem", color: COLORS.textSecondary, marginTop: "0.3rem" }}>
                {breathPhase === "complete" ? "Session complete" : breathPhase}
              </div>
              {breathCount > 0 && (
                <div style={{ fontSize: "0.7rem", color: COLORS.textMuted, marginTop: "0.2rem" }}>
                  {breathCount}/5 cycles
                </div>
              )}
            </div>

            <button style={{ ...styles.btnPrimary, marginTop: "1rem" }} onClick={startBreathwork}>
              {breathPhase === "complete" ? "Restart Session" : "Begin Box Breathing"}
            </button>

            <div style={{ marginTop: "3rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { name: "Box Breathing", desc: "4-4-4-4 pattern for anxiety", emoji: "📦" },
                { name: "4-7-8 Method", desc: "Inhale 4, hold 7, exhale 8", emoji: "🌙" },
                { name: "Coherent Breath", desc: "5 seconds in, 5 out", emoji: "💙" },
              ].map(b => (
                <div key={b.name} style={{ ...styles.card, maxWidth: "180px", cursor: "pointer" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{b.emoji}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>{b.name}</div>
                  <div style={{ fontSize: "0.75rem", color: COLORS.textSecondary, marginTop: "0.25rem" }}>{b.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ ...styles.card, marginTop: "2rem", textAlign: "left" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>AI Breathwork Coach</h3>
              <div style={styles.inputRow}>
                <input style={{ ...styles.input, flex: 1 }} value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Ask for a guided breathing session..." />
                <button style={styles.sendBtn} onClick={() => sendMessage()} disabled={isLoading}>Ask</button>
              </div>
              {messages.slice(-2).map((m, i) => (
                <div key={i} style={{ ...styles.chatBubble(m.role), margin: "0.5rem 0", maxWidth: "100%" }}>
                  {m.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INSIGHTS */}
        {activeTab === "insights" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Session Insights</h2>
            <p style={styles.sectionSub}>Your emotional intelligence dashboard — patterns, growth, and breakthroughs.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { label: "Calm Score", value: emotionScore.calm, color: COLORS.teal, icon: "🌊" },
                { label: "Energy Score", value: emotionScore.energy, color: COLORS.amber, icon: "⚡" },
                { label: "Clarity Score", value: emotionScore.clarity, color: COLORS.accentGlow, icon: "🔮" },
                { label: "Sessions", value: Math.ceil(messages.length / 2), color: COLORS.green, icon: "📊", raw: true },
              ].map(m => (
                <div key={m.label} style={{ ...styles.card, textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{m.icon}</div>
                  <div style={{ fontSize: "2rem", fontWeight: "700", color: m.color }}>
                    {m.raw ? m.value : `${m.value}%`}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: COLORS.textSecondary }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...styles.card, marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Emotional Progress</h3>
              {[
                { label: "Calm", val: emotionScore.calm, color: COLORS.teal },
                { label: "Energy", val: emotionScore.energy, color: COLORS.amber },
                { label: "Clarity", val: emotionScore.clarity, color: COLORS.accentGlow },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                    <span>{m.label}</span>
                    <span style={{ color: m.color }}>{m.val}%</span>
                  </div>
                  <div style={styles.progressBar(m.val, m.color)} />
                </div>
              ))}
            </div>

            <div style={styles.card}>
              <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Session History</h3>
              {sessionHistory.length === 0 ? (
                <div style={{ color: COLORS.textMuted, fontSize: "0.875rem" }}>Begin a therapy session to see insights here.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sessionHistory.slice(-6).map((h, i) => (
                    <div key={i} style={{ fontSize: "0.8rem", color: COLORS.textSecondary, padding: "0.5rem 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                      {h}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "2rem" }}>
              <div style={{ ...styles.card, background: "rgba(124,58,237,0.08)", border: `1px solid rgba(124,58,237,0.2)` }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>🎖️ Achievement System</h3>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                  {[
                    { badge: "🌱", name: "First Step", earned: messages.length > 0 },
                    { badge: "💬", name: "Open Heart", earned: messages.length >= 4 },
                    { badge: "🌊", name: "Ocean Mind", earned: emotionScore.calm > 20 },
                    { badge: "⚡", name: "Inner Power", earned: emotionScore.energy > 20 },
                    { badge: "🔮", name: "Clarity Seeker", earned: emotionScore.clarity > 20 },
                    { badge: "🎭", name: "Time Traveler", earned: !!selectedScenario },
                  ].map(a => (
                    <div key={a.name} style={{ padding: "0.5rem 0.85rem", borderRadius: "999px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem", background: a.earned ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${a.earned ? "rgba(16,185,129,0.3)" : COLORS.cardBorder}`, color: a.earned ? COLORS.green : COLORS.textMuted }}>
                      {a.badge} {a.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
