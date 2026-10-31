import { useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarDays, Check, ChevronLeft, ChevronRight,
  Droplets, Footprints, Heart, HeartPulse, History, Home,
  Moon, Plus, Smile, Sparkles, Trash2, UserRound, X, Pencil,
  Save, Camera, ListChecks
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./App.css";

const STORAGE_KEY = "habify-wellness-v3";
const PROFILE_KEY = "habify-profile-v1";

const defaultHabits = [
  "10 min meditation",
  "Drink enough water",
  "Walk 8,000 steps",
  "Eat 3 healthy meals",
  "Sleep 7–8 hours",
  "Limit sugar intake",
  "No screen 1h before bed",
];

const moods = [
  { emoji: "😄", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😔", label: "Low" },
  { emoji: "😫", label: "Stressed" },
];

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(key, amount) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + amount));
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function makeDay(key) {
  return {
    habits: defaultHabits.map((name, i) => ({
      id: `${key}-${i}`,
      name,
      done: false,
    })),
    water: 0,       // millilitres
    steps: 0,
    sleep: 0,       // hours
    mood: "",
    heartRate: 72,  // manually entered estimate, not a sensor reading
  };
}

function getDay(store, key) {
  const saved = store[key];
  if (!saved) return makeDay(key);
  return {
    ...makeDay(key),
    ...saved,
    habits: Array.isArray(saved.habits) ? saved.habits : makeDay(key).habits,
    heartRate: saved.heartRate ?? 72,
  };
}

function calculateScore(day) {
  const sleep = Math.min((Number(day.sleep) || 0) / 8, 1);
  const water = Math.min((Number(day.water) || 0) / 2500, 1);
  const steps = Math.min((Number(day.steps) || 0) / 8000, 1);
  const habits = day.habits.length
    ? day.habits.filter(h => h.done).length / day.habits.length
    : 0;
  return Math.round((sleep + water + steps + habits) * 25);
}

function App() {
  const today = dateKey(new Date());
  const [store, setStore] = useState(() => readJson(STORAGE_KEY, {}));
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState("Dashboard");
  const [newHabit, setNewHabit] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(() => readJson(PROFILE_KEY, {
    name: "", email: "", goal: "Build consistent healthy habits", avatar: "",
  }));
  const [profileDraft, setProfileDraft] = useState(profile);

  const day = getDay(store, selectedDate);
  const isToday = selectedDate === today;
  const completed = day.habits.filter(h => h.done).length;
  const allDone = day.habits.length > 0 && completed === day.habits.length;
  const score = calculateScore(day);
  const mood = moods.find(item => item.label === day.mood);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    if (!store[today]) {
      setStore(current => current[today] ? current : { ...current, [today]: makeDay(today) });
    }
  }, [today]); // New date gets a fresh record; previous dates stay in history.

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  function updateDay(updater) {
    setStore(current => {
      const updated = updater(getDay(current, selectedDate));
      return { ...current, [selectedDate]: updated };
    });
  }

  function toggleHabit(id) {
    updateDay(d => ({
      ...d,
      habits: d.habits.map(h => h.id === id ? { ...h, done: !h.done } : h),
    }));
  }

  function addHabit(event) {
    event.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    updateDay(d => ({
      ...d,
      habits: [...d.habits, { id: `${Date.now()}-${Math.random()}`, name, done: false }],
    }));
    setNewHabit("");
  }

  function deleteHabit(id) {
    updateDay(d => ({ ...d, habits: d.habits.filter(h => h.id !== id) }));
    if (editingId === id) setEditingId(null);
  }

  function saveEdit(id) {
    const name = editText.trim();
    if (name) {
      updateDay(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, name } : h) }));
    }
    setEditingId(null);
  }

  function changeMetric(field, amount, minimum = 0, maximum = Infinity) {
    updateDay(d => ({
      ...d,
      [field]: Math.max(minimum, Math.min(maximum,
        Math.round(((Number(d[field]) || 0) + amount) * 100) / 100)),
    }));
  }

  function saveProfile(event) {
    event.preventDefault();
    setProfile(profileDraft);
    setProfileOpen(false);
  }

  const weekData = useMemo(() => {
    const monday = shiftDate(selectedDate, -((new Date(`${selectedDate}T12:00:00`).getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDate(monday, i);
      const record = store[key];
      return {
        day: new Date(`${key}T12:00:00`).toLocaleDateString("en", { weekday: "short" }),
        score: record ? calculateScore(getDay(store, key)) : null,
        date: key,
        recorded: Boolean(record),
      };
    });
  }, [selectedDate, store]);

  const calendarDays = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(year, monthIndex, i + 1);
        return { number: i + 1, key: dateKey(date) };
      }),
    ];
  }, [month]);

  const history = Object.keys(store).filter(key => key <= today).sort((a, b) => b.localeCompare(a));
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });



// BMI Calculator
const [weight, setWeight] = useState("");
const [height, setHeight] = useState("");

const bmi =
  Number(weight) > 0 && Number(height) > 0
    ? Number(weight) / ((Number(height) / 100) ** 2)
    : null;

const bmiCategory = !bmi
  ? ""
  : bmi < 18.5
  ? "Underweight"
  : bmi < 25
  ? "Normal weight"
  : bmi < 30
  ? "Overweight"
  : "Obesity";

// AI Health Assistant
const [chatInput, setChatInput] = useState("");
const [chatMessages, setChatMessages] = useState([
  {
    role: "assistant",
    content: "Hello! I'm your Habify Health Assistant. How can I help you today?"
  }
]);
const [chatLoading, setChatLoading] = useState(false);

const sendHealthMessage = async (e) => {
  e.preventDefault();

  const message = chatInput.trim();
  if (!message || chatLoading) return;

  const updatedMessages = [
    ...chatMessages,
    { role: "user", content: message }
  ];

  setChatMessages(updatedMessages);
  setChatInput("");
  setChatLoading(true);

  try {
    const response = await fetch("/api/health-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: updatedMessages
      })
    });

    if (!response.ok) {
      throw new Error("Unable to connect to the health assistant.");
    }

    const data = await response.json();

    setChatMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: data.answer || "I couldn't generate a response. Please try again."
      }
    ]);
  } catch (error) {
    setChatMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: "I'm unable to connect right now. Please try again later."
      }
    ]);
  } finally {
    setChatLoading(false);
  }
};



  return (
    <div className="habify">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setView("Dashboard")}>
          <span className="brand-mark"><Heart size={21} /></span>
          <span>Habify</span>
        </a>
        <p className="side-caption">YOUR WELLNESS</p>
        {[
          { name: "Dashboard", icon: Home },
          { name: "Progress", icon: Activity },
          { name: "Calendar", icon: CalendarDays },
          { name: "History", icon: History },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button key={item.name}
              className={`nav-item ${view === item.name ? "active" : ""}`}
              onClick={() => setView(item.name)}>
              <Icon size={18} /> {item.name}
            </button>
          );
        })}
        <div className="side-tip">
          <Sparkles size={20} />
          <strong>Little steps, big change.</strong>
          <p>Build a life that feels good, one day at a time.</p>
        </div>
      </aside>

      <main className="workspace" id="dashboard">
        <header className="page-header">
          <div>
            <p className="eyebrow">YOUR PERSONAL WELLNESS SPACE</p>
            <h1>Good day{profile.name ? `, ${profile.name}` : ", you"}! <span>✦</span></h1>
            <p className="muted">{isToday ? "Make space for yourself today." : `Viewing ${dateLabel}`}</p>
          </div>
          <div className="header-actions">
            <span className="header-date">
              <CalendarDays size={16} />
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
            <button className="profile-button" onClick={() => {
              setProfileDraft(profile);
              setProfileOpen(true);
            }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="" />
                : <UserRound size={18} />}
              <span>{profile.name || "My profile"}</span>
              <Pencil size={14} />
            </button>
          </div>
        </header>

        {view === "History" ? (
          <section className="panel history-panel">
            <div className="section-heading">
              <div><h2>Your wellness history</h2><p>Every little step you've saved, all in one place.</p></div>
            </div>
            {history.length === 0 ? (
              <p className="empty-state">Your history will appear here as you track your days.</p>
            ) : history.map(key => {
              const record = getDay(store, key);
              const done = record.habits.filter(h => h.done).length;
              return (
                <button className="history-row" key={key} onClick={() => {
                  setSelectedDate(key);
                  setMonth(new Date(`${key}T12:00:00`));
                  setView("Dashboard");
                }}>
                  <span className="history-date">
                    <strong>{new Date(`${key}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong>
                    <small>{new Date(`${key}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", year: "numeric" })}</small>
                  </span>
                  <span className="history-detail">{done}/{record.habits.length} habits · {(record.water / 1000).toFixed(1)} L water</span>
                  <strong className="history-score">{calculateScore(record)}/100</strong>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </section>
        ) : (
          <>
            {view === "Calendar" ? (
              <section className="panel calendar-page">
                <div className="section-heading">
                  <div><h2>Calendar</h2><p>Select a date to review or update that day's wellness.</p></div>
                </div>
                <Calendar month={month} setMonth={setMonth} days={calendarDays}
                  today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} store={store} />
              </section>
            ) : null}

            {(view === "Dashboard" || view === "Progress") && (
              <>
                <section className="top-grid">
                  <article className="panel balance-panel">
                    <div className="section-heading">
                      <div><h2>Daily balance</h2><p>Your little picture of wellness.</p></div>
                      <span className="soft-pill">{isToday ? "Today" : "History"}</span>
                    </div>
                    <div className="balance-content">
                      <div className="balance-ring" aria-label={`Daily balance ${score} out of 100`}>
                        <div className="ring-score">
                          <Sparkles size={22} />
                          <strong>{score}</strong>
                          <span>out of 100</span>
                        </div>
                        <span className="ring-label body-label">Body · 25%</span>
                        <span className="ring-label mind-label">Mind · 25%</span>
                        <span className="ring-label energy-label">Energy · 50%</span>
                      </div>
                    </div>
                    <div className="balance-mood">
                      <div className="balance-mood-copy">
                        <span className="mini-label">TODAY'S MOOD</span>
                        <strong>{mood ? `${mood.emoji} ${mood.label}` : "How are you feeling?"}</strong>
                      </div>
                      <div className="mood-options compact-moods">
                        {moods.map(item => (
                          <button key={item.label} title={item.label} aria-label={item.label}
                            aria-pressed={day.mood === item.label}
                            className={day.mood === item.label ? "mood-selected" : ""}
                            onClick={() => updateDay(d => ({ ...d, mood: item.label }))}>
                            {item.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="balance-note">
                      {score >= 80 ? "You're finding your rhythm ✨" :
                       score >= 50 ? "You're making progress. Keep going." :
                       "Every fresh start counts. Begin with one small step."}
                    </p>
                  </article>

                  <article className="panel habits-panel">
                    <div className="section-heading">
                      <div><h2>Daily habits</h2><p>{completed} of {day.habits.length} completed</p></div>
                      <span className="count-pill">{completed}/{day.habits.length}</span>
                    </div>
                    <div className="habit-progress">
                      <div style={{ width: `${day.habits.length ? completed / day.habits.length * 100 : 0}%` }} />
                    </div>
                    <div className="habits-list">
                      {day.habits.map(habit => (
                        <div className="habit-row" key={habit.id}>
                          <button className={`check-button ${habit.done ? "checked" : ""}`}
                            onClick={() => toggleHabit(habit.id)}
                            aria-label={`Mark ${habit.name} ${habit.done ? "incomplete" : "complete"}`}>
                            {habit.done && <Check size={14} />}
                          </button>
                          {editingId === habit.id ? (
                            <form className="edit-form" onSubmit={e => {
                              e.preventDefault(); saveEdit(habit.id);
                            }}>
                              <input autoFocus value={editText} onChange={e => setEditText(e.target.value)} />
                              <button aria-label="Save edit"><Check size={15} /></button>
                              <button type="button" aria-label="Cancel edit" onClick={() => setEditingId(null)}><X size={15} /></button>
                            </form>
                          ) : (
                            <button className={`habit-name ${habit.done ? "done" : ""}`}
                              onClick={() => { setEditingId(habit.id); setEditText(habit.name); }}
                              title="Click to edit">{habit.name}</button>
                          )}
                          <button className="delete-habit" onClick={() => deleteHabit(habit.id)}
                            aria-label={`Delete ${habit.name}`}><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                    {allDone && <div className="completion-message" role="status">
                      <Sparkles size={19} /><div><strong>You did it! ✨</strong><p>Every habit complete. Take a moment to celebrate yourself.</p></div>
                    </div>}
                    {day.habits.length === 0 && <p className="empty-state">No habits yet. Add one below to get started.</p>}
                    <form className="add-habit-form" onSubmit={addHabit}>
                      <input value={newHabit} onChange={e => setNewHabit(e.target.value)}
                        placeholder="Add a daily habit..." maxLength={100} />
                      <button type="submit" disabled={!newHabit.trim()}><Plus size={17} /> Add</button>
                    </form>
                  </article>

                  <article className="panel calendar-panel">
                    <div className="section-heading">
                      <div><h2>Calendar</h2><p>Revisit any day you choose.</p></div>
                      <CalendarDays size={19} className="heading-icon" />
                    </div>
                    <Calendar month={month} setMonth={setMonth} days={calendarDays}
                      today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} store={store} />
                  </article>
                </section>

                <section className="tracking-grid">
                  <article className="panel metric-panel heart-rate-panel">
                    <div className="metric-heading">
                      <span className="metric-icon heart"><HeartPulse size={20} /></span>
                      <span className="metric-title">Heart rate</span>
                    </div>
                    <h3>{day.heartRate ?? 72} <small>BPM</small></h3>
                    <div className="heart-rate-visual"><HeartPulse size={42} /></div>
                    <p className="metric-caption">
                      {day.heartRate >= 60 && day.heartRate <= 100
                        ? "Typical adult resting range; your actual reading may vary."
                        : "Consider your activity and how you feel."}
                    </p>
                    <div className="metric-actions">
                      <button onClick={() => updateDay(d => ({ ...d, heartRate: Math.max(1, (d.heartRate ?? 72) - 1) }))}>− 1 BPM</button>
                      <button onClick={() => updateDay(d => ({ ...d, heartRate: Math.min(250, (d.heartRate ?? 72) + 1) }))}>+ 1 BPM</button>
                    </div>
                  </article>

                  <article className="panel metric-panel">
                    <div className="metric-heading"><span className="metric-icon steps"><Footprints size={20} /></span><span className="metric-title">Activity</span></div>
                    <h3>{day.steps.toLocaleString("en-IN")} <small>steps</small></h3>
                    <div className="metric-track"><div className="steps-fill" style={{ width: `${Math.min(day.steps / 8000 * 100, 100)}%` }} /></div>
                    <p className="metric-caption">{Math.round(day.steps / 8000 * 100)}% of 8,000 steps</p>
                    <div className="metric-actions">
                      <button onClick={() => changeMetric("steps", -500)}>− 500</button>
                      <button onClick={() => changeMetric("steps", 500)}>+ 500</button>
                    </div>
                  </article>

                  <article className="panel metric-panel">
                    <div className="metric-heading"><span className="metric-icon water"><Droplets size={20} /></span><span className="metric-title">Water intake</span></div>
                    <h3>{(day.water / 1000).toFixed(2)} <small>/ 2.5 L</small></h3>
                    <div className="water-visual"><div className="water-fill" style={{ height: `${Math.min(day.water / 2500 * 100, 100)}%` }} /><Droplets size={26} /></div>
                    <p className="metric-caption">{Math.round(day.water / 2500 * 100)}% of daily goal</p>
                    <div className="metric-actions">
                      <button onClick={() => changeMetric("water", -250)}>− 250 ml</button>
                      <button onClick={() => changeMetric("water", 250)}>+ 250 ml</button>
                    </div>
                  </article>

                  <article className="panel metric-panel">
                    <div className="metric-heading"><span className="metric-icon sleep"><Moon size={20} /></span><span className="metric-title">Sleep quality</span></div>
                    <h3>{day.sleep} <small>hours / 8h</small></h3>
                    <div className="metric-track"><div className="sleep-fill" style={{ width: `${Math.min(day.sleep / 8 * 100, 100)}%` }} /></div>
                    <p className="metric-caption">Record your total sleep duration.</p>
                    <div className="metric-actions">
                      <button onClick={() => changeMetric("sleep", -0.5, 0, 24)}>− 30 min</button>
                      <button onClick={() => changeMetric("sleep", 0.5, 0, 24)}>+ 30 min</button>
                    </div>
                  </article>
                </section>
              </>
            )}


            {/* BMI CALCULATOR */}
<section className="wellness-tools-grid">

  <div className="panel bmi-panel">
    <div className="section-heading">
      <div>
        <p className="eyebrow">BODY HEALTH</p>
        <h2>BMI Calculator</h2>
        <p>Understand your body mass index.</p>
      </div>
      <span className="soft-pill">BMI</span>
    </div>

    <div className="bmi-inputs">
      <label>
        Weight (kg)
        <input
          type="number"
          min="1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Enter weight"
        />
      </label>

      <label>
        Height (cm)
        <input
          type="number"
          min="1"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="Enter height"
        />
      </label>
    </div>

    <div className="bmi-result">
      {bmi ? (
        <>
          <span className="bmi-number">{bmi.toFixed(1)}</span>
          <h3>{bmiCategory}</h3>
          <p>
            {bmi < 18.5
              ? "Your BMI is below the usual adult healthy range."
              : bmi < 25
              ? "Your BMI is within the usual adult healthy range."
              : bmi < 30
              ? "Your BMI is above the usual adult healthy range."
              : "Your BMI is in the adult obesity range."}
          </p>
        </>
      ) : (
        <p>Enter your height and weight to calculate your BMI.</p>
      )}
    </div>

    <p className="metric-caption">
      Adult BMI categories are screening guidelines, not a diagnosis.
    </p>
  </div>

  {/* AI HEALTH ASSISTANT */}
  <div className="panel ai-health-panel">
    <div className="section-heading">
      <div>
        <p className="eyebrow">PERSONAL WELLNESS</p>
        <h2>AI Health Assistant</h2>
        <p>Ask questions about general health and wellness.</p>
      </div>
      <span className="soft-pill">AI</span>
    </div>

    <div className="chat-messages">
      {chatMessages.map((message, index) => (
        <div
          key={index}
          className={`chat-message ${message.role}`}
        >
          <strong>
            {message.role === "assistant" ? "Habify AI" : "You"}
          </strong>
          <p>{message.content}</p>
        </div>
      ))}

      {chatLoading && (
        <div className="chat-message assistant">
          <p>Thinking...</p>
        </div>
      )}
    </div>

    <form className="health-chat-form" onSubmit={sendHealthMessage}>
      <input
        type="text"
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        placeholder="Ask your health question..."
        disabled={chatLoading}
      />

      <button
        type="submit"
        className="button-primary"
        disabled={!chatInput.trim() || chatLoading}
      >
        Send
      </button>
    </form>

    <p className="metric-caption">
      AI provides general wellness information, not medical diagnosis
      or emergency care.
    </p>
  </div>

</section>




            {(view === "Dashboard" || view === "Progress") &&  <section className="panel progress-panel" id="progress">
              <div className="section-heading">
                <div><h2>Weekly progress</h2><p>Scores from Monday through Sunday for the selected week.</p></div>
                <span className="soft-pill">This week</span>
              </div>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="habifyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#24102F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#24102F" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e6e6" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value, name, props) => [
                      props.payload.recorded ? `${value}/100` : "No saved data",
                      "Wellness score",
                    ]} />
                    <Area dataKey="score" type="monotone" stroke="#24102F" strokeWidth={3}
                      fill="url(#habifyGradient)" connectNulls={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-footnote">Only dates with saved entries contribute a score.</p>
            </section>}
          </>
        )}

        <footer className="page-footer">
          <span>Habify · A softer way to care for yourself ♡</span>
          <span>Your wellness data stays in this browser.</span>
        </footer>
      </main>

      {profileOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={e => {
          if (e.target === e.currentTarget) setProfileOpen(false);
        }}>
          <section className="profile-modal panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <div className="section-heading">
              <div><h2 id="profile-title">Your profile</h2><p>Make this wellness space yours.</p></div>
              <button className="icon-button" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={19} /></button>
            </div>
            <form onSubmit={saveProfile} className="profile-form">
              <label>
                Display name
                <input value={profileDraft.name} maxLength={50}
                  onChange={e => setProfileDraft(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
              </label>
              <label>
                Email (optional)
                <input type="email" value={profileDraft.email}
                  onChange={e => setProfileDraft(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
              </label>
              <label>
                Wellness goal
                <input value={profileDraft.goal} maxLength={120}
                  onChange={e => setProfileDraft(p => ({ ...p, goal: e.target.value }))} placeholder="What would you like to focus on?" />
              </label>
              <label>
                Avatar image URL (optional)
                <input type="url" value={profileDraft.avatar}
                  onChange={e => setProfileDraft(p => ({ ...p, avatar: e.target.value }))} placeholder="https://example.com/photo.jpg" />
              </label>
              <div className="profile-actions">
                <button type="button" className="button-secondary" onClick={() => setProfileOpen(false)}>Cancel</button>
                <button type="submit" className="button-primary"><Save size={16} /> Save profile</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Calendar({ month, setMonth, days, today, selectedDate, setSelectedDate, store }) {
  return (
    <>
      <div className="month-switch">
        <button aria-label="Previous month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={19} /></button>
        <strong>{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</strong>
        <button aria-label="Next month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={19} /></button>
      </div>
      <div className="calendar-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span className="weekday" key={`${d}-${i}`}>{d}</span>)}
        {days.map((date, i) => date ? (
          <button key={date.key}
            className={["calendar-day", selectedDate === date.key ? "selected" : "",
              today === date.key ? "today" : "", store[date.key] ? "has-record" : ""].filter(Boolean).join(" ")}
            onClick={() => setSelectedDate(date.key)}>{date.number}</button>
        ) : <span key={`blank-${i}`} />)}
      </div>
      <button className="today-button" onClick={() => { setSelectedDate(today); setMonth(new Date()); }}>Return to today</button>
    </>
  );
}

export default App;
