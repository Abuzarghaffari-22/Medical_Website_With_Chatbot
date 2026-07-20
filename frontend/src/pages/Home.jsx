import { Link } from 'react-router-dom'

const features = [
  { icon: '🤖', title: 'AI Health Assistant',       desc: 'Chat with our intelligent medical AI for symptom assessment, FAQs, and health guidance — 24/7.' },
  { icon: '📅', title: 'Easy Appointment Booking',  desc: 'Book, reschedule, or cancel appointments in seconds. Real-time doctor availability at your fingertips.' },
  { icon: '🔒', title: 'Secure Patient Portal',     desc: 'Military-grade encryption protects your medical records and personal health information at all times.' },
  { icon: '⚡', title: 'Instant Triage',            desc: 'Our AI evaluates symptom urgency and directs you to the right level of care — no more guessing.' },
  { icon: '📊', title: 'Health Dashboard',          desc: 'View your appointment history, chat sessions, and health activity in one elegant dashboard.' },
  { icon: '🏥', title: 'Specialist Access',         desc: 'Connect with specialists across 12+ departments from General Practice to Neurology and beyond.' },
]

const services = [
  { name: 'General Practice', emoji: '🩺' },
  { name: 'Cardiology',       emoji: '❤️' },
  { name: 'Pediatrics',       emoji: '👶' },
  { name: 'Dermatology',      emoji: '🌿' },
  { name: 'Neurology',        emoji: '🧠' },
  { name: 'Orthopedics',      emoji: '🦴' },
  { name: 'Psychiatry',       emoji: '🌊' },
  { name: 'Oncology',         emoji: '🔬' },
]

const stats = [
  { value: '10K+', label: 'Patients Served' },
  { value: '98%',  label: 'Satisfaction Rate' },
  { value: '50+',  label: 'Specialists' },
  { value: '24/7', label: 'AI Support' },
]

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-mesh min-h-[88vh] flex items-center">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />

        <div className="page-container w-full py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 badge badge-teal mb-5 text-sm py-1.5 px-3">
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                AI-Powered Healthcare Platform
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-slate-900 leading-tight text-balance mb-6">
                Your Health,{' '}
                <span className="gradient-text">Intelligently</span>{' '}
                Managed
              </h1>
              <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-lg">
                Experience healthcare reimagined. Our AI assistant provides 24/7 symptom guidance, while seamless appointment booking connects you to world-class specialists.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className="btn-xl btn-primary shadow-glow">
                  Get Started Free
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link to="/login" className="btn-xl btn-secondary">Patient Portal</Link>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                🔒 HIPAA-compliant &nbsp;·&nbsp; No credit card required &nbsp;·&nbsp; Free forever for basic use
              </p>
            </div>

            {/* Right — live chat preview card */}
            <div className="hidden lg:flex justify-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="card p-0 w-full max-w-sm overflow-hidden shadow-card-hover">
                <div className="bg-gradient-to-r from-primary-600 to-teal-500 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xl">🤖</div>
                  <div>
                    <p className="text-white font-semibold text-sm">MediBot AI</p>
                    <p className="text-white/70 text-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Online
                    </p>
                  </div>
                </div>
                <div className="p-4 space-y-3 bg-slate-50 min-h-[200px]">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                    <div className="chat-bubble-ai text-xs">
                      Hello! I'm MediBot, your AI health assistant. How can I help you today?
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="chat-bubble-user text-xs">I have a headache and mild fever for 2 days.</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                    <div className="chat-bubble-ai text-xs">
                      📅 Based on your symptoms, I recommend seeing a doctor within 2–3 days. Possible causes include viral flu or sinusitis.
                      <div className="mt-2 pt-2 border-t border-slate-100 text-amber-600 font-medium text-[11px]">
                        ⚠️ Triage Score: 5/10 — Semi-Urgent
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 flex flex-wrap gap-1.5 border-t border-slate-100">
                  {['Book Appointment', 'More Info', 'Clinic Hours'].map(r => (
                    <span key={r} className="badge badge-blue text-xs cursor-pointer hover:bg-primary-100 transition-colors">{r}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats ────────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white py-10">
        <div className="page-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-slate-100">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center px-4">
                <p className="text-3xl font-display font-bold gradient-text">{value}</p>
                <p className="text-sm text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────────── */}
      <section id="services" className="py-20 bg-slate-50">
        <div className="page-container">
          <div className="text-center mb-12">
            <span className="badge badge-blue mb-3">Platform Features</span>
            <h2 className="section-title">Everything you need for modern healthcare</h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">
              A complete digital health platform built for patients who demand excellence.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="card-hover p-6 group" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Services ─────────────────────────────────────────────────────────── */}
      <section id="about" className="py-20 bg-white">
        <div className="page-container">
          <div className="text-center mb-12">
            <span className="badge badge-teal mb-3">Our Departments</span>
            <h2 className="section-title">Specialists across every field</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {services.map((s) => (
              <div key={s.name} className="card-hover p-4 text-center group cursor-pointer">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">{s.emoji}</div>
                <p className="text-sm font-medium text-slate-700">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-primary-600 to-teal-600">
        <div className="page-container text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            Ready to take control of your health?
          </h2>
          <p className="text-white/80 mb-8 max-w-md mx-auto">
            Join thousands of patients who trust MediCare for smarter, faster, more personal healthcare.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="btn-xl bg-white text-primary-700 hover:bg-slate-50 shadow-lg">
              Create Free Account
            </Link>
            <Link to="/login" className="btn-xl border border-white/40 text-white hover:bg-white/10">
              Sign In
            </Link>
          </div>
          <p className="text-white/50 text-xs mt-4">🚨 Medical emergency? Call 911 immediately.</p>
        </div>
      </section>
    </div>
  )
}