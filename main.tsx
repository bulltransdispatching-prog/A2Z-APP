// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { COMPANY } from './firebase';
import { InventoryPage } from './InventoryPage';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const todayStr = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);
const COLORS = ['#004080', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];

const BUILTIN_FORMS = {
  attendance:  { name: 'Attendance',       icon: 'clipboard-user' },
  insecticide: { name: 'Insecticide Log',  icon: 'spray-can'      },
  gluebox:     { name: 'Glue Box',         icon: 'box-open'       },
  efk:         { name: 'EFK Monitoring',   icon: 'lightbulb'      },
  lizard:      { name: 'Lizard Trapping',  icon: 'dragon'         },
  cat:         { name: 'Cat Trapping',     icon: 'cat'            },
  snake:       { name: 'Snake Box',        icon: 'worm'           },
  checklist:   { name: 'IPM Checklist',    icon: 'tasks'          },
  baitstation: { name: 'Bait Station',     icon: 'box'            },
};

const formName = (t) => BUILTIN_FORMS[t]?.name || t;
const formIcon = (t) => BUILTIN_FORMS[t]?.icon || 'file-alt';

function calcDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── TOAST ─────────────────────────────────────────────────────────────────
let toastId = 0;
function ToastBox({ toasts, remove }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 w-72">
      {toasts.map(t => (
        <div key={t.id} onClick={() => remove(t.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl cursor-pointer bg-white border-l-4 animate-bounce-in
            ${t.type === 'success' ? 'border-green-500' : t.type === 'error' ? 'border-red-500' : 'border-blue-500'}`}>
          <i className={`fas fa-${t.type === 'success' ? 'check-circle text-green-500' : t.type === 'error' ? 'times-circle text-red-500' : 'info-circle text-blue-500'}`} />
          <span className="text-sm text-gray-700 flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MODAL ─────────────────────────────────────────────────────────────────
function Modal({ show, onClose, title, hdr = 'bg-blue-900', children, footer, size = 'lg' }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl', full: 'max-w-7xl' };
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 bg-black/60" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[92vh] flex flex-col`}>
        <div className={`${hdr} text-white px-5 py-4 rounded-t-2xl flex justify-between items-center shrink-0`}>
          <h5 className="font-bold text-lg">{title}</h5>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl flex gap-2 justify-end shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── SIGNATURE PAD ─────────────────────────────────────────────────────────
function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };
  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = (e) => {
    e.preventDefault();
    drawing.current = false;
    onChange(canvasRef.current.toDataURL());
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <button type="button" onClick={clear} className="text-xs text-red-500 hover:underline">Clear</button>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
        <canvas ref={canvasRef} width={400} height={120}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Sign above with mouse or touch</p>
    </div>
  );
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, users }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    setTimeout(() => {
      const user = users.find(u => u.username?.toLowerCase() === username.toLowerCase() && u.password === password && u.active);
      if (user) onLogin(user);
      else setError('Invalid username or password');
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <i className="fas fa-bug text-white text-2xl" />
          </div>
          <h2 className="text-2xl font-black text-blue-900">A2Z IPM</h2>
          <p className="text-gray-400 text-sm mt-1">Integrated Pest Management System</p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm mb-4 flex items-center gap-2"><i className="fas fa-exclamation-circle" />{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Username</label>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" placeholder="Enter username" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter password" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">
                <i className={`fas fa-${showPass ? 'eye-slash' : 'eye'}`} />
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-800 to-blue-600 text-white py-3 rounded-xl font-bold hover:from-blue-900 hover:to-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md mt-2">
            {loading ? <><i className="fas fa-spinner fa-spin" />Logging in...</> : <><i className="fas fa-sign-in-alt" />Login</>}
          </button>
        </form>
        <p className="text-center text-xs text-gray-300 mt-6">{COMPANY.name}</p>
      </div>
    </div>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────────────────
const NAV = [
  { page: 'dashboard',   icon: 'home',         label: 'Dashboard'        },
  { page: 'dataentry',   icon: 'edit',          label: 'Data Entry',    noClient: true },
  { page: 'records',     icon: 'file-alt',      label: 'Records'          },
  { page: 'reports',     icon: 'chart-bar',     label: 'Monthly Reports'  },
  { page: 'inventory',   icon: 'warehouse',     label: 'Inventory',     noClient: true },
  { page: 'formbuilder', icon: 'tools',         label: 'Form Builder',  adminOnly: true },
  { page: 'staff',       icon: 'users',         label: 'Staff',         adminOnly: true },
  { page: 'clients',     icon: 'user-tie',      label: 'Clients',       adminOnly: true },
  { page: 'projects',    icon: 'building',      label: 'Projects',      adminOnly: true },
  { page: 'remarks',     icon: 'comments',      label: 'Client Remarks',adminOnly: true },
  { page: 'settings',    icon: 'cog',           label: 'Settings'         },
];

function Sidebar({ page, role, onNav, open }) {
  return (
    <aside className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white z-40 flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><i className="fas fa-bug text-white" /></div>
          <div><h4 className="font-black text-lg leading-none">A2Z IPM</h4><p className="text-white/40 text-xs mt-0.5">Management System</p></div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(item => {
          if (item.adminOnly && role !== 'admin') return null;
          if (item.noClient && role === 'client') return null;
          return (
            <button key={item.page} onClick={() => onNav(item.page)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all border-l-4 text-sm
                ${page === item.page ? 'bg-white/15 text-white border-yellow-400 font-semibold' : 'text-white/60 border-transparent hover:bg-white/10 hover:text-white'}`}>
              <i className={`fas fa-${item.icon} w-5 text-center`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <p className="text-white/30 text-xs text-center">{COMPANY.phone}</p>
      </div>
    </aside>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ cu, users, projects, records, remarks, onComplaint, onNav }) {
  const td = todayStr();
  let myRec = records, myProj = projects;
  if (cu.role === 'staff') { myProj = projects.filter(p => (cu.projects || []).includes(p.key)); myRec = records.filter(r => r.userKey === cu.key); }
  if (cu.role === 'client') { myProj = projects.filter(p => p.key === cu.projectKey); myRec = records.filter(r => r.projectKey === cu.projectKey); }

  const stats = cu.role === 'admin'
    ? [{ l: 'Active Projects', v: projects.filter(p => p.active).length, i: 'building', c: 'from-blue-600 to-blue-800' },
       { l: 'Active Staff', v: users.filter(u => u.role === 'staff' && u.active).length, i: 'users', c: 'from-green-500 to-green-700' },
       { l: "Today's Entries", v: records.filter(r => r.date === td).length, i: 'clipboard-check', c: 'from-orange-500 to-red-600' },
       { l: 'Total Records', v: records.length, i: 'file-alt', c: 'from-purple-500 to-purple-700' },
       { l: 'Pending Remarks', v: remarks.length, i: 'comments', c: 'from-yellow-500 to-yellow-700' }]
    : [{ l: 'My Projects', v: myProj.length, i: 'building', c: 'from-blue-600 to-blue-800' },
       { l: "Today's Entries", v: myRec.filter(r => r.date === td).length, i: 'clipboard-check', c: 'from-orange-500 to-red-600' },
       { l: 'Total Records', v: myRec.length, i: 'file-alt', c: 'from-purple-500 to-purple-700' }];

  const recent = [...myRec].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);

  return (
    <div>
      <h4 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i className="fas fa-home text-blue-800" />Dashboard</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.l} className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3 border border-gray-100">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.c} flex items-center justify-center shrink-0 shadow-sm`}><i className={`fas fa-${s.i} text-white`} /></div>
            <div><p className="text-2xl font-black text-gray-800">{s.v}</p><p className="text-xs text-gray-500 leading-tight mt-0.5">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-blue-800 text-white px-5 py-3 rounded-t-2xl font-bold flex items-center gap-2"><i className="fas fa-clock" />Recent Activity</div>
          <div className="p-4">
            {recent.length > 0 ? recent.map(r => {
              const proj = projects.find(p => p.key === r.projectKey);
              const usr = users.find(u => u.key === r.userKey);
              return (
                <div key={r.key} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <i className={`fas fa-${formIcon(r.formType)} text-blue-700 text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{formName(r.formType)}</p>
                    <p className="text-xs text-gray-400 truncate">{proj?.name || '-'} · {usr?.name || '-'}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{fmtDT(r.createdAt)}</span>
                </div>
              );
            }) : <p className="text-gray-400 text-center py-10 text-sm">No recent activity</p>}
          </div>
        </div>

        <div className="space-y-4">
          {cu.role === 'client' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h6 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><i className="fas fa-headset text-blue-700" />Support</h6>
              <div className="space-y-2">
                <button onClick={onComplaint} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 justify-center"><i className="fas fa-comment-alt" />Add Remark / Complaint</button>
                <a href={`https://wa.me/${COMPANY.whatsapp}`} target="_blank" rel="noreferrer" className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 justify-center"><i className="fab fa-whatsapp" />WhatsApp Support</a>
                <a href={`mailto:${COMPANY.email}`} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 justify-center"><i className="fas fa-envelope" />Email Complaint</a>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-2xl p-5 text-white">
            <h6 className="font-bold mb-3 flex items-center gap-2"><i className="fas fa-info-circle" />Company</h6>
            <div className="space-y-2 text-sm text-blue-200">
              <p className="font-semibold text-white text-base">{COMPANY.name}</p>
              <p className="flex items-center gap-2"><i className="fas fa-map-marker-alt w-4" />{COMPANY.address}</p>
              <p className="flex items-center gap-2"><i className="fas fa-phone w-4" />{COMPANY.phone}</p>
              <p className="flex items-center gap-2"><i className="fas fa-envelope w-4" />{COMPANY.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS PAGE (Admin + All roles) ───────────────────────────────────────
function ReportsPage({ cu, projects, records, users }) {
  const [selProject, setSelProject] = useState('');
  const [selMonth, setSelMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState('overview');

  const myProjects = cu.role === 'client'
    ? projects.filter(p => p.key === cu.projectKey)
    : cu.role === 'staff'
      ? projects.filter(p => (cu.projects || []).includes(p.key))
      : projects.filter(p => p.active);

  useEffect(() => { if (myProjects.length > 0 && !selProject) setSelProject(myProjects[0].key); }, [myProjects.length]);

  const proj = projects.find(p => p.key === selProject);
  const filtered = records.filter(r => r.projectKey === selProject && r.date?.startsWith(selMonth));

  // Days in month
  const [yr, mo] = selMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // Per-day data
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const ds = `${selMonth}-${day}`;
    const dr = filtered.filter(r => r.date === ds);
    return {
      day: `${i + 1}`,
      Attendance: dr.filter(r => r.formType === 'attendance').length,
      Insecticide: dr.filter(r => r.formType === 'insecticide').length,
      'Glue Box': dr.filter(r => r.formType === 'gluebox').length,
      EFK: dr.filter(r => r.formType === 'efk').length,
      Checklist: dr.filter(r => r.formType === 'checklist').length,
      'Bait Station': dr.filter(r => r.formType === 'baitstation').length,
      Lizard: dr.filter(r => r.formType === 'lizard').length,
      Cat: dr.filter(r => r.formType === 'cat').length,
      Snake: dr.filter(r => r.formType === 'snake').length,
    };
  });
  const activeDays = dailyData.filter(d => Object.values(d).slice(1).some(v => v > 0));

  // Form type distribution
  const typeCnt = {};
  filtered.forEach(r => { typeCnt[r.formType] = (typeCnt[r.formType] || 0) + 1; });
  const pieData = Object.entries(typeCnt).map(([k, v]) => ({ name: formName(k), value: v }));

  // Weekly
  const weekData = [1, 2, 3, 4].map(w => {
    const s = (w - 1) * 7 + 1, e = w * 7;
    const wr = filtered.filter(r => { const d = parseInt(r.date?.split('-')[2] || '0'); return d >= s && d <= e; });
    return { week: `Week ${w}`, count: wr.length };
  });

  // Form type summary
  const allTypes = [...new Set(filtered.map(r => r.formType))];
  const summary = allTypes.map(ft => ({ type: formName(ft), count: filtered.filter(r => r.formType === ft).length })).sort((a, b) => b.count - a.count);

  const insRec = filtered.filter(r => r.formType === 'insecticide');
  const baitRec = filtered.filter(r => r.formType === 'baitstation');
  const attRec = filtered.filter(r => r.formType === 'attendance');

  // Bait station entries aggregate
  const baitTrendData = baitRec.map(r => ({
    date: fmtDate(r.date),
    active: r.activeStations || 0,
    total: r.totalStations || 0,
    baitUsed: Number(r.baitUsed) || 0,
  }));

  // Insecticide trend
  const insTrendData = insRec.map(r => ({
    date: fmtDate(r.date),
    qty: Number(r.qty) || 0,
    remaining: Number(r.remainingQty) || 0,
  }));

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: 'tachometer-alt' },
    { id: 'trend',       label: 'Daily Trend', icon: 'chart-line'     },
    { id: 'insecticide', label: 'Insecticide', icon: 'spray-can'      },
    { id: 'baitstation', label: 'Bait Station',icon: 'box'            },
    { id: 'attendance',  label: 'Attendance',  icon: 'clipboard-user' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h4 className="text-xl font-black text-gray-800 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-800" />Monthly Reports & Trend Analysis</h4>
        <button onClick={() => window.print()} className="bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900 print:hidden"><i className="fas fa-print" />Print Report</button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 print:hidden">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Project</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={selProject} onChange={e => setSelProject(e.target.value)}>
              {myProjects.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Month</label>
            <input type="month" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={selMonth} onChange={e => setSelMonth(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Print-only header */}
      {proj && (
        <div className="hidden print:block mb-4">
          <div className="flex justify-between items-start border-b-4 border-blue-800 pb-3 mb-3">
            <div>
              <h1 className="text-2xl font-black text-blue-900">{COMPANY.name}</h1>
              <p className="text-gray-500">Integrated Pest Management Services</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{COMPANY.phone}</p><p>{COMPANY.email}</p>
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl mb-3">
            <h2 className="text-xl font-black text-blue-900">Monthly IPM Progress Report</h2>
            <p className="text-gray-600">{proj.name} · {proj.client} · {selMonth}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5 print:hidden overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-max flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === t.id ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`fas fa-${t.icon} text-xs`} />{t.label}
          </button>
        ))}
      </div>

      {/* Summary Cards - always shown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Total Entries', v: filtered.length, c: 'border-blue-600', tc: 'text-blue-800' },
          { l: 'Attendance', v: attRec.length, c: 'border-green-500', tc: 'text-green-700' },
          { l: 'Insecticide', v: insRec.length, c: 'border-orange-500', tc: 'text-orange-600' },
          { l: 'Bait Station', v: baitRec.length, c: 'border-purple-500', tc: 'text-purple-700' },
        ].map(s => (
          <div key={s.l} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${s.c} text-center border border-gray-100`}>
            <p className={`text-3xl font-black ${s.tc}`}>{s.v}</p>
            <p className="text-xs text-gray-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {(activeTab === 'overview') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-pie text-blue-700" />Activity Distribution</h5>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-700" />Weekly Activity</h5>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#004080" radius={[6, 6, 0, 0]} name="Records" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5">
              {summary.slice(0, 6).map(s => (
                <div key={s.type} className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">{s.type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${filtered.length > 0 ? (s.count / filtered.length) * 100 : 0}%` }} /></div>
                    <span className="text-xs font-bold text-blue-800 w-4">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TREND TAB */}
      {activeTab === 'trend' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-line text-blue-700" />Daily Activity Trend – {selMonth}</h5>
            {activeDays.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={activeDays}>
                  <defs>
                    {['Attendance', 'Insecticide', 'Glue Box', 'EFK', 'Checklist', 'Bait Station'].map((k, i) => (
                      <linearGradient key={k} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {['Attendance', 'Insecticide', 'Glue Box', 'EFK', 'Checklist', 'Bait Station'].map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i]} strokeWidth={2} fill={`url(#grad${i})`} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-72 flex items-center justify-center text-gray-400">No data for this period</div>}
          </div>

          {/* Per-form trend tables */}
          {allTypes.map(ft => {
            const ftRec = filtered.filter(r => r.formType === ft);
            if (ftRec.length === 0) return null;
            return (
              <div key={ft} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <i className={`fas fa-${formIcon(ft)} text-blue-700`} />{formName(ft)} – Detail ({ftRec.length} records)
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50 text-gray-500 uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">By</th>
                      <th className="px-3 py-2 text-left font-semibold">Details</th>
                      <th className="px-3 py-2 text-left font-semibold">Remarks</th>
                    </tr></thead>
                    <tbody>
                      {ftRec.map(r => {
                        const usr = users.find(u => u.key === r.userKey);
                        let detail = '';
                        if (ft === 'attendance') detail = `In: ${r.timeIn || '-'} · Out: ${r.timeOut || '-'} ${r.location?.verified ? '✓ GPS' : ''}`;
                        else if (ft === 'insecticide') detail = `${r.chemical || '-'} · ${r.qty}ml · Batch: ${r.batchNumber || '-'} · Remaining: ${r.remainingQty || '-'}ml`;
                        else if (ft === 'baitstation') detail = `${r.baitBrand || '-'} · Active: ${r.activeStations}/${r.totalStations} · Used: ${r.baitUsed}g`;
                        else if (ft === 'checklist') detail = `Done: ${(r.activities || []).filter(a => a.status === 'done').length}/${(r.activities || []).length}`;
                        else detail = `${(r.entries || []).length} entries`;
                        return (
                          <tr key={r.key} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-3 py-2">{usr?.name || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{detail}</td>
                            <td className="px-3 py-2 text-gray-400">{r.remarks || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INSECTICIDE TAB */}
      {activeTab === 'insecticide' && (
        <div className="space-y-5">
          {insTrendData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-area text-orange-500" />Insecticide Usage & Stock Trend</h5>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={insTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qty" name="Qty Used (ml)" fill="#fd7e14" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="remaining" name="Remaining (ml)" fill="#28a745" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-spray-can text-orange-500" />Insecticide Log Detail</h5>
            {insRec.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    {['Date','By','Chemical','Batch #','Qty Used','Water','Remaining','Areas'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {insRec.map(r => {
                      const usr = users.find(u => u.key === r.userKey);
                      const low = Number(r.remainingQty) < 500;
                      return (
                        <tr key={r.key} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2">{usr?.name || '-'}</td>
                          <td className="px-3 py-2 font-semibold">{r.chemical || '-'}</td>
                          <td className="px-3 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{r.batchNumber || '-'}</code></td>
                          <td className="px-3 py-2">{r.qty || '-'} ml</td>
                          <td className="px-3 py-2">{r.water || '-'} L</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{r.remainingQty || '-'} ml {low ? '⚠' : ''}</span></td>
                          <td className="px-3 py-2 text-xs text-gray-500">{(r.areas || []).join(', ') || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-center py-8 text-sm">No insecticide records this month</p>}
          </div>
        </div>
      )}

      {/* BAIT STATION TAB */}
      {activeTab === 'baitstation' && (
        <div className="space-y-5">
          {baitTrendData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-line text-purple-600" />Bait Station Active Stations Trend</h5>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={baitTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="active" name="Active Stations" stroke="#6f42c1" strokeWidth={2} />
                  <Line type="monotone" dataKey="total" name="Total Stations" stroke="#dee2e6" strokeWidth={2} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="baitUsed" name="Bait Used (g)" stroke="#fd7e14" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-box text-purple-600" />Bait Station Records</h5>
            {baitRec.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    {['Date','By','Brand','Total','Active','Bait Used','Remarks'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {baitRec.map(r => {
                      const usr = users.find(u => u.key === r.userKey);
                      return (
                        <tr key={r.key} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="px-3 py-2">{usr?.name || '-'}</td>
                          <td className="px-3 py-2 font-semibold">{r.baitBrand || '-'}</td>
                          <td className="px-3 py-2">{r.totalStations || '-'}</td>
                          <td className="px-3 py-2"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{r.activeStations || '-'}</span></td>
                          <td className="px-3 py-2">{r.baitUsed || '-'} g</td>
                          <td className="px-3 py-2 text-xs text-gray-400">{r.remarks || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-center py-8 text-sm">No bait station records this month</p>}
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-clipboard-user text-green-600" />Attendance Records</h5>
          {attRec.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-gray-500">
                  {['Date','Staff','Time In','Time Out','GPS','Work Done','Remarks'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {attRec.map(r => {
                    const usr = users.find(u => u.key === r.userKey);
                    return (
                      <tr key={r.key} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2 font-semibold">{usr?.name || '-'}</td>
                        <td className="px-3 py-2">{r.timeIn || '-'}</td>
                        <td className="px-3 py-2">{r.timeOut || '-'}</td>
                        <td className="px-3 py-2">
                          {r.location?.verified ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">✓ {r.location.distance}m</span>
                          : r.location?.skipped ? <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Skipped</span>
                          : <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">Unverified</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-48 truncate">{r.work || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">{r.remarks || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-400 text-center py-8 text-sm">No attendance records this month</p>}
        </div>
      )}
    </div>
  );
}

// ─── DATA ENTRY ──────────────────────────────────────────────────────────────
function DataEntryPage({ cu, projects, customForms, onSave, toast }) {
  const [selProject, setSelProject] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [showAttModal, setShowAttModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  const myProjects = cu.role === 'staff'
    ? projects.filter(p => p.active && (cu.projects || []).includes(p.key))
    : projects.filter(p => p.active);

  const builtinCards = [
    { type: 'attendance', gps: true },
    { type: 'insecticide' }, { type: 'gluebox' }, { type: 'efk' },
    { type: 'lizard' }, { type: 'cat' }, { type: 'snake' },
    { type: 'checklist' }, { type: 'baitstation' },
  ];

  const currProj = projects.find(p => p.key === selProject);
  const openForm = (type) => {
    if (!selProject) { toast('Please select a project first', 'error'); return; }
    setActiveForm(type);
    if (type === 'attendance') setShowAttModal(true);
    else setShowFormModal(true);
  };

  return (
    <div>
      <h4 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i className="fas fa-edit text-blue-800" />Data Entry</h4>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Select Project</label>
        <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" value={selProject} onChange={e => setSelProject(e.target.value)}>
          <option value="">-- Select Project --</option>
          {myProjects.map(p => <option key={p.key} value={p.key}>{p.code} – {p.name}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">Built-in Forms</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
          {builtinCards.map(f => (
            <button key={f.type} onClick={() => openForm(f.type)}
              className="bg-white rounded-2xl p-5 shadow-sm border-2 border-transparent hover:border-blue-500 hover:shadow-md transition-all text-center group">
              <i className={`fas fa-${formIcon(f.type)} text-3xl text-blue-800 mb-3 block group-hover:scale-110 transition-transform`} />
              <h6 className="font-bold text-gray-800 text-sm">{formName(f.type)}</h6>
              <small className={`text-xs ${f.gps ? 'text-green-500' : 'text-gray-400'}`}>{f.gps ? '📍 GPS Enabled' : 'Manual Entry'}</small>
            </button>
          ))}
        </div>

        {customForms.filter(f => f.active).length > 0 && (
          <>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Custom Forms</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {customForms.filter(f => f.active).map(f => (
                <button key={f.key} onClick={() => openForm(f.key)}
                  className="bg-white rounded-2xl p-5 shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-md transition-all text-center group">
                  <i className={`fas fa-${f.icon || 'file-alt'} text-3xl text-purple-700 mb-3 block group-hover:scale-110 transition-transform`} />
                  <h6 className="font-bold text-gray-800 text-sm">{f.name}</h6>
                  <small className="text-xs text-purple-400">Custom Form</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {currProj && (
        <>
          <AttendanceModal show={showAttModal} onClose={() => setShowAttModal(false)} project={currProj} cu={cu} onSave={onSave} toast={toast} />
          <FormModal show={showFormModal} onClose={() => setShowFormModal(false)} formType={activeForm} project={currProj} cu={cu} onSave={onSave} toast={toast} customForms={customForms} />
        </>
      )}
    </div>
  );
}

// ─── ATTENDANCE MODAL ────────────────────────────────────────────────────────
function AttendanceModal({ show, onClose, project, cu, onSave, toast }) {
  const [locStatus, setLocStatus] = useState('checking');
  const [distance, setDistance] = useState(0);
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [date, setDate] = useState(todayStr());
  const [timeIn, setTimeIn] = useState(nowTime());
  const [timeOut, setTimeOut] = useState('');
  const [work, setWork] = useState('');
  const [remarks, setRemarks] = useState('');
  const [techSig, setTechSig] = useState('');
  const [clientSig, setClientSig] = useState('');

  const check = useCallback(() => {
    setLocStatus('checking');
    if (!project.gpsEnabled || !project.lat || !project.lng) { setLocStatus('skip'); return; }
    if (!navigator.geolocation) { setLocStatus('fail'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const d = calcDist(pos.coords.latitude, pos.coords.longitude, project.lat, project.lng);
      setDistance(Math.round(d)); setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude);
      setLocStatus(d <= (project.radius || 50) ? 'ok' : 'fail');
    }, () => setLocStatus('fail'), { enableHighAccuracy: true, timeout: 15000 });
  }, [project]);

  useEffect(() => { if (show) { setDate(todayStr()); setTimeIn(nowTime()); check(); } }, [show]);
  const canSave = locStatus === 'ok' || locStatus === 'skip';

  const handleSave = () => {
    onSave({ formType: 'attendance', projectKey: project.key, userKey: cu.key, date, timeIn, timeOut, work, remarks, techSignature: techSig, clientSignature: clientSig, location: { lat: userLat, lng: userLng, distance, verified: locStatus === 'ok', skipped: locStatus === 'skip' } });
    onClose(); toast('Attendance saved!');
  };

  return (
    <Modal show={show} onClose={onClose} title="Attendance Record" hdr="bg-green-700" size="lg"
      footer={<>
        {locStatus === 'fail' && <button onClick={check} className="border border-blue-600 text-blue-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50"><i className="fas fa-redo mr-1" />Retry</button>}
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <button onClick={handleSave} disabled={!canSave} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"><i className="fas fa-save mr-1" />Save</button>
      </>}>
      {project.gpsEnabled && (
        <div className={`rounded-xl p-4 flex items-center gap-3 mb-4 ${locStatus === 'ok' ? 'bg-green-50 border-2 border-green-400' : locStatus === 'fail' ? 'bg-red-50 border-2 border-red-400' : 'bg-blue-50 border-2 border-blue-300'}`}>
          <i className={`fas fa-${locStatus === 'checking' ? 'spinner fa-spin text-blue-500' : locStatus === 'ok' ? 'check-circle text-green-500' : 'times-circle text-red-500'} text-2xl`} />
          <div className="text-sm">
            {locStatus === 'checking' && <><strong>Checking location...</strong><br /><span className="text-gray-500">Please allow location access</span></>}
            {locStatus === 'ok' && <><strong className="text-green-700">✓ Location Verified</strong><br /><span className="text-gray-500">You are {distance}m from the site</span></>}
            {locStatus === 'fail' && <><strong className="text-red-700">✗ Too Far Away</strong><br /><span className="text-gray-500">You are {distance}m from site (max: {project.radius || 50}m)</span></>}
          </div>
        </div>
      )}
      {locStatus === 'skip' && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-3 py-2 text-sm mb-4"><i className="fas fa-info-circle mr-1" />GPS authentication disabled for this project</div>}
      {canSave && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[['Date', date, setDate, 'date'], ['Time In', timeIn, setTimeIn, 'time'], ['Time Out', timeOut, setTimeOut, 'time']].map(([l, v, s, t]) => (
              <div key={l}><label className="text-xs font-bold text-gray-600 uppercase block mb-1">{l}</label><input type={t} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={v} onChange={e => s(e.target.value)} /></div>
            ))}
          </div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Work Done</label><textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={work} onChange={e => setWork(e.target.value)} /></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Remarks</label><textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <SignaturePad label="Technician Signature" value={techSig} onChange={setTechSig} />
            <SignaturePad label="Client / Supervisor Signature" value={clientSig} onChange={setClientSig} />
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── GENERIC FORM MODAL ──────────────────────────────────────────────────────
function FormModal({ show, onClose, formType, project, cu, onSave, toast, customForms }) {
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTime());
  const [remarks, setRemarks] = useState('');
  const [techSig, setTechSig] = useState('');
  const [clientSig, setClientSig] = useState('');
  // Insecticide
  const [chemical, setChemical] = useState('Deltamethrin');
  const [qty, setQty] = useState('50');
  const [water, setWater] = useState('10');
  const [batchNumber, setBatchNumber] = useState('');
  const [remainingQty, setRemainingQty] = useState('');
  const [areas, setAreas] = useState(['Outside', 'Drain', 'Washroom', 'Office', 'Storage']);
  const [newArea, setNewArea] = useState('');
  // Checklist
  const CHECK_ITEMS = ['Spray Treatment', 'EFK Inspection', 'Glue Box Check', 'Bait Station Check', 'Chemical Inventory', 'Snake Box Check', 'Documentation'];
  const [checkSt, setCheckSt] = useState(CHECK_ITEMS.map(() => 'done'));
  const [timeIn, setTimeIn] = useState(nowTime());
  const [timeOut, setTimeOut] = useState('');
  // Generic
  const [entries, setEntries] = useState([{ location: '', count: 0, status: 'ok' }]);
  // Bait Station
  const [baitBrand, setBaitBrand] = useState('');
  const [totalStations, setTotalStations] = useState('');
  const [activeStations, setActiveStations] = useState('');
  const [baitUsed, setBaitUsed] = useState('');
  const [baitEntries, setBaitEntries] = useState([{ location: '', stationType: 'Indoor', baitConsumed: '0', baitReplaced: '0', condition: 'good', pestActivity: 'none' }]);
  // Custom form values
  const [customVals, setCustomVals] = useState({});
  const [customTableRows, setCustomTableRows] = useState({});

  useEffect(() => { if (show) { setDate(todayStr()); setTime(nowTime()); setRemarks(''); setTechSig(''); setClientSig(''); setCustomVals({}); setCustomTableRows({}); } }, [show, formType]);

  const isBuiltin = !!BUILTIN_FORMS[formType];
  const customForm = !isBuiltin ? customForms?.find(f => f.key === formType) : null;

  const handleSave = () => {
    const base = { formType, projectKey: project.key, userKey: cu.key, date, time, remarks, techSignature: techSig, clientSignature: clientSig };
    if (formType === 'insecticide') Object.assign(base, { chemical, qty, water, batchNumber, remainingQty, areas });
    else if (formType === 'checklist') Object.assign(base, { timeIn, timeOut, activities: CHECK_ITEMS.map((item, i) => ({ item, status: checkSt[i] })) });
    else if (formType === 'baitstation') Object.assign(base, { baitBrand, totalStations: Number(totalStations), activeStations: Number(activeStations), baitUsed, entries: baitEntries.map((e, i) => ({ sr: i + 1, ...e })) });
    else if (customForm) Object.assign(base, { customData: { ...customVals, tableRows: customTableRows } });
    else Object.assign(base, { entries: entries.map((e, i) => ({ sr: i + 1, ...e })) });
    onSave(base); onClose(); toast('Record saved!');
  };

  const addEntry = () => setEntries([...entries, { location: '', count: 0, status: 'ok' }]);
  const addBaitEntry = () => setBaitEntries([...baitEntries, { location: '', stationType: 'Indoor', baitConsumed: '0', baitReplaced: '0', condition: 'good', pestActivity: 'none' }]);
  const addTableRow = (fieldId, cols) => setCustomTableRows(prev => ({ ...prev, [fieldId]: [...(prev[fieldId] || [{ ...Object.fromEntries(cols.map(c => [c, ''])) }]), Object.fromEntries(cols.map(c => [c, '']))] }));

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'text-xs font-bold text-gray-600 uppercase block mb-1';

  return (
    <Modal show={show} onClose={onClose} title={customForm?.name || formName(formType)} hdr="bg-blue-900" size="xl"
      footer={<>
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <button onClick={handleSave} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1" />Save Record</button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Date *</label><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className={lbl}>Time</label><input type="time" className={inp} value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>

        {/* INSECTICIDE */}
        {formType === 'insecticide' && (<>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={lbl}>Chemical</label>
              <select className={inp} value={chemical} onChange={e => setChemical(e.target.value)}>
                {['Deltamethrin','Alphacypermethrin','Cypermethrin','Bifenthrin','Fipronil','Imidacloprid','Chlorpyrifos'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Batch Number</label><input type="text" className={inp} placeholder="e.g. BT-2024-001" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} /></div>
            <div><label className={lbl}>Qty Used (ml)</label><input type="number" className={inp} value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><label className={lbl}>Water (L)</label><input type="number" className={inp} value={water} onChange={e => setWater(e.target.value)} /></div>
            <div>
              <label className={lbl}>Remaining Stock (ml)</label>
              <input type="number" className={`${inp} ${Number(remainingQty) < 500 && remainingQty ? 'border-red-400 bg-red-50' : ''}`} placeholder="Current stock" value={remainingQty} onChange={e => setRemainingQty(e.target.value)} />
              {Number(remainingQty) < 500 && remainingQty && <p className="text-xs text-red-500 mt-1">⚠ Low stock warning!</p>}
            </div>
          </div>
          <div>
            <label className={lbl}>Areas Treated</label>
            <div className="flex flex-wrap gap-2 mb-2 min-h-8">
              {areas.map((a, i) => (
                <span key={i} className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full flex items-center gap-1">
                  {a}<button type="button" onClick={() => setAreas(areas.filter((_, j) => j !== i))} className="ml-1 text-blue-400 hover:text-red-500 font-bold">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" className={`${inp} flex-1`} placeholder="Add area..." value={newArea} onChange={e => setNewArea(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newArea.trim()) { setAreas([...areas, newArea.trim()]); setNewArea(''); e.preventDefault(); } }} />
              <button type="button" onClick={() => { if (newArea.trim()) { setAreas([...areas, newArea.trim()]); setNewArea(''); } }} className="bg-blue-700 text-white px-4 rounded-xl text-sm font-semibold">Add</button>
            </div>
          </div>
        </>)}

        {/* CHECKLIST */}
        {formType === 'checklist' && (<>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Time In</label><input type="time" className={inp} value={timeIn} onChange={e => setTimeIn(e.target.value)} /></div>
            <div><label className={lbl}>Time Out</label><input type="time" className={inp} value={timeOut} onChange={e => setTimeOut(e.target.value)} /></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500">#</th><th className="px-3 py-2 text-left text-xs text-gray-500">Activity</th><th className="px-3 py-2 text-left text-xs text-gray-500">Status</th></tr></thead>
              <tbody>
                {CHECK_ITEMS.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">{item}</td>
                    <td className="px-3 py-2">
                      <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={checkSt[i]} onChange={e => { const ns = [...checkSt]; ns[i] = e.target.value; setCheckSt(ns); }}>
                        <option value="done">✓ Done</option><option value="pending">⏳ Pending</option><option value="na">– N/A</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}

        {/* BAIT STATION */}
        {formType === 'baitstation' && (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lbl}>Bait Brand</label><input type="text" className={inp} placeholder="e.g. Contrac" value={baitBrand} onChange={e => setBaitBrand(e.target.value)} /></div>
            <div><label className={lbl}>Total Stations</label><input type="number" className={inp} value={totalStations} onChange={e => setTotalStations(e.target.value)} /></div>
            <div><label className={lbl}>Active Stations</label><input type="number" className={inp} value={activeStations} onChange={e => setActiveStations(e.target.value)} /></div>
            <div><label className={lbl}>Total Bait Used (g)</label><input type="number" className={inp} value={baitUsed} onChange={e => setBaitUsed(e.target.value)} /></div>
          </div>
          <div>
            <label className={lbl}>Station Details</label>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 text-gray-500">{['#','Location','Type','Consumed(g)','Replaced(g)','Condition','Pest Activity',''].map(h => <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {baitEntries.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-1 py-1"><input type="text" className="w-24 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Location" value={e.location} onChange={ev => { const n = [...baitEntries]; n[i].location = ev.target.value; setBaitEntries(n); }} /></td>
                      <td className="px-1 py-1"><select className="border border-gray-200 rounded px-1 py-1 text-xs" value={e.stationType} onChange={ev => { const n = [...baitEntries]; n[i].stationType = ev.target.value; setBaitEntries(n); }}><option>Indoor</option><option>Outdoor</option><option>Drain</option></select></td>
                      <td className="px-1 py-1"><input type="number" className="w-14 border border-gray-200 rounded px-2 py-1 text-xs" value={e.baitConsumed} onChange={ev => { const n = [...baitEntries]; n[i].baitConsumed = ev.target.value; setBaitEntries(n); }} /></td>
                      <td className="px-1 py-1"><input type="number" className="w-14 border border-gray-200 rounded px-2 py-1 text-xs" value={e.baitReplaced} onChange={ev => { const n = [...baitEntries]; n[i].baitReplaced = ev.target.value; setBaitEntries(n); }} /></td>
                      <td className="px-1 py-1"><select className="border border-gray-200 rounded px-1 py-1 text-xs" value={e.condition} onChange={ev => { const n = [...baitEntries]; n[i].condition = ev.target.value; setBaitEntries(n); }}><option value="good">Good</option><option value="damaged">Damaged</option><option value="replaced">Replaced</option></select></td>
                      <td className="px-1 py-1"><select className="border border-gray-200 rounded px-1 py-1 text-xs" value={e.pestActivity} onChange={ev => { const n = [...baitEntries]; n[i].pestActivity = ev.target.value; setBaitEntries(n); }}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></td>
                      <td className="px-1 py-1"><button type="button" onClick={() => setBaitEntries(baitEntries.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><i className="fas fa-trash text-xs" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addBaitEntry} className="mt-2 text-blue-600 text-sm hover:underline flex items-center gap-1"><i className="fas fa-plus" />Add Station</button>
          </div>
        </>)}

        {/* GENERIC ENTRY TABLE */}
        {!['insecticide','checklist','baitstation'].includes(formType) && isBuiltin && (
          <div>
            <label className={lbl}>Entries</label>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-gray-500">{['#','Location','Count','Status',''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-1 py-1"><input type="text" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm" placeholder="Location" value={e.location} onChange={ev => { const n = [...entries]; n[i].location = ev.target.value; setEntries(n); }} /></td>
                      <td className="px-1 py-1"><input type="number" className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm" value={e.count} onChange={ev => { const n = [...entries]; n[i].count = parseInt(ev.target.value) || 0; setEntries(n); }} /></td>
                      <td className="px-1 py-1"><select className="border border-gray-200 rounded-lg px-2 py-1 text-sm" value={e.status} onChange={ev => { const n = [...entries]; n[i].status = ev.target.value; setEntries(n); }}><option value="ok">OK</option><option value="damaged">Damaged</option><option value="replaced">Replaced</option></select></td>
                      <td className="px-1 py-1"><button type="button" onClick={() => setEntries(entries.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><i className="fas fa-trash text-xs" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addEntry} className="mt-2 text-blue-600 text-sm hover:underline flex items-center gap-1"><i className="fas fa-plus" />Add Row</button>
          </div>
        )}

        {/* CUSTOM FORM */}
        {customForm && (
          <div className="space-y-4">
            {customForm.fields.map(field => {
              if (field.type === 'signature') return (
                <SignaturePad key={field.id} label={field.label} value={customVals[field.id] || ''} onChange={v => setCustomVals(p => ({ ...p, [field.id]: v }))} />
              );
              if (field.type === 'checkbox') return (
                <label key={field.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" checked={!!customVals[field.id]} onChange={e => setCustomVals(p => ({ ...p, [field.id]: e.target.checked }))} />
                  <span className="text-sm font-semibold text-gray-700">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</span>
                </label>
              );
              if (field.type === 'select') return (
                <div key={field.id}><label className={lbl}>{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
                  <select className={inp} value={customVals[field.id] || ''} onChange={e => setCustomVals(p => ({ ...p, [field.id]: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {(field.options || []).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              );
              if (field.type === 'textarea') return (
                <div key={field.id}><label className={lbl}>{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
                  <textarea className={inp} rows={3} value={customVals[field.id] || ''} onChange={e => setCustomVals(p => ({ ...p, [field.id]: e.target.value }))} />
                </div>
              );
              if (field.type === 'table') {
                const cols = field.tableColumns || ['Item', 'Value'];
                const rows = customTableRows[field.id] || [Object.fromEntries(cols.map(c => [c, '']))];
                return (
                  <div key={field.id}>
                    <label className={lbl}>{field.label}</label>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50">{cols.map(c => <th key={c} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{c}</th>)}<th className="px-2 py-2"></th></tr></thead>
                        <tbody>{rows.map((row, ri) => (
                          <tr key={ri} className="border-t">{cols.map(c => (
                            <td key={c} className="px-1 py-1"><input type="text" className="w-full border border-gray-200 rounded px-2 py-1 text-xs" value={row[c] || ''} onChange={ev => { const nr = [...rows]; nr[ri][c] = ev.target.value; setCustomTableRows(p => ({ ...p, [field.id]: nr })); }} /></td>
                          ))}<td className="px-1 py-1"><button type="button" onClick={() => setCustomTableRows(p => ({ ...p, [field.id]: rows.filter((_, j) => j !== ri) }))} className="text-red-400 hover:text-red-600"><i className="fas fa-trash text-xs" /></button></td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <button type="button" onClick={() => addTableRow(field.id, cols)} className="mt-2 text-blue-600 text-sm hover:underline flex items-center gap-1"><i className="fas fa-plus" />Add Row</button>
                  </div>
                );
              }
              // Default: text, number, date, time
              return (
                <div key={field.id}><label className={lbl}>{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
                  <input type={field.type} className={inp} placeholder={field.placeholder || ''} value={customVals[field.id] || ''} onChange={e => setCustomVals(p => ({ ...p, [field.id]: e.target.value }))} />
                </div>
              );
            })}
          </div>
        )}

        <div><label className={lbl}>Remarks</label><textarea className={inp} rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
          <SignaturePad label="Technician Signature" value={techSig} onChange={setTechSig} />
          <SignaturePad label="Client / Supervisor Signature" value={clientSig} onChange={setClientSig} />
        </div>
      </div>
    </Modal>
  );
}

// ─── RECORD REPORT (Professional PDF-ready) ──────────────────────────────────
function RecordReport({ record, projects, users }) {
  const proj = projects.find(p => p.key === record.projectKey);
  const usr = users.find(u => u.key === record.userKey);

  return (
    <div className="bg-white font-sans text-sm" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Company Header */}
      <div className="bg-blue-900 text-white p-6 print:p-4">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-bug text-xl" /></div>
              <div><h2 className="font-black text-xl leading-none">{COMPANY.name}</h2><p className="text-blue-200 text-xs">Integrated Pest Management Services</p></div>
            </div>
            <p className="text-blue-200 text-xs mt-2">{COMPANY.address}</p>
          </div>
          <div className="text-right text-xs text-blue-200 space-y-1">
            <p><i className="fas fa-phone mr-1" />{COMPANY.phone}</p>
            <p><i className="fas fa-envelope mr-1" />{COMPANY.email}</p>
            <div className="mt-2 bg-white/10 px-3 py-1 rounded-full text-white text-xs font-bold">
              REF: {record.key?.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Report Title Bar */}
      <div className="border-b-4 border-blue-800 px-6 py-3 bg-blue-50">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-black text-blue-900 text-lg">{formName(record.formType)} Report</h3>
          <span className="text-gray-500 text-sm">{fmtDate(record.date)}</span>
        </div>
      </div>

      {/* Project Info Box */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-4 border-l-4 border-blue-700 mb-5">
          {[['Project', proj?.name], ['Client', proj?.client], ['Date', fmtDate(record.date)], ['Submitted By', usr?.name], ['Address', proj?.address], ['Contact', proj?.contact]].filter(([, v]) => v).map(([l, v]) => (
            <div key={l}><p className="text-xs text-gray-400 uppercase font-bold">{l}</p><p className="font-semibold text-gray-800 text-sm mt-0.5">{v || '-'}</p></div>
          ))}
        </div>

        {/* ATTENDANCE */}
        {record.formType === 'attendance' && (<>
          {record.location?.verified && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5 mb-4 text-sm flex items-center gap-2"><i className="fas fa-check-circle" />GPS Verified – {record.location.distance}m from site · ({record.location.lat?.toFixed(4)}, {record.location.lng?.toFixed(4)})</div>}
          {record.location?.skipped && <div className="bg-gray-50 border border-gray-200 text-gray-500 rounded-xl px-4 py-2.5 mb-4 text-sm flex items-center gap-2"><i className="fas fa-info-circle" />GPS Authentication Not Required</div>}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[['Time In', record.timeIn], ['Time Out', record.timeOut]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-5 text-center border-2 border-gray-100">
                <p className="text-3xl font-black text-blue-900">{v || '—'}</p><p className="text-xs text-gray-400 uppercase mt-1">{l}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Work Done</p>
            <p className="text-gray-700">{record.work || 'N/A'}</p>
          </div>
        </>)}

        {/* INSECTICIDE */}
        {record.formType === 'insecticide' && (<>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {[['Chemical', record.chemical], ['Batch Number', record.batchNumber], ['Qty Used', `${record.qty} ml`], ['Water Used', `${record.water} L`], ['Remaining Stock', `${record.remainingQty || '—'} ml`]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-lg font-black text-blue-900">{v}</p><p className="text-xs text-gray-400 uppercase mt-1">{l}</p>
                {l === 'Remaining Stock' && Number(record.remainingQty) < 500 && record.remainingQty && <p className="text-xs text-red-500 font-bold mt-1">⚠ Low Stock</p>}
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Areas Treated</p>
            <div className="flex flex-wrap gap-2">{(record.areas || []).map((a, i) => <span key={i} className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">{a}</span>)}</div>
          </div>
        </>)}

        {/* CHECKLIST */}
        {record.formType === 'checklist' && (<>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[['Time In', record.timeIn], ['Time Out', record.timeOut]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-4 text-center"><p className="text-2xl font-black text-blue-900">{v || '—'}</p><p className="text-xs text-gray-400 uppercase mt-1">{l}</p></div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-blue-900 text-white"><th className="px-4 py-2.5 text-left text-xs">#</th><th className="px-4 py-2.5 text-left text-xs">Activity</th><th className="px-4 py-2.5 text-left text-xs">Status</th></tr></thead>
              <tbody>
                {(record.activities || []).map((act, i) => (
                  <tr key={i} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{act.item}</td>
                    <td className="px-4 py-2.5"><span className={`text-xs px-3 py-1 rounded-full font-bold ${act.status === 'done' ? 'bg-green-100 text-green-700' : act.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{act.status === 'done' ? '✓ Done' : act.status === 'pending' ? '⏳ Pending' : '— N/A'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}

        {/* BAIT STATION */}
        {record.formType === 'baitstation' && (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[['Brand', record.baitBrand], ['Total Stations', record.totalStations], ['Active Stations', record.activeStations], ['Bait Used', `${record.baitUsed || '-'} g`]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-4 text-center"><p className="text-xl font-black text-blue-900">{String(v || '-')}</p><p className="text-xs text-gray-400 uppercase mt-1">{String(l)}</p></div>
            ))}
          </div>
          {(record.entries || []).length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead><tr className="bg-blue-900 text-white text-xs">{['#','Location','Type','Consumed','Replaced','Condition','Pest Activity'].map(h => <th key={h} className="px-3 py-2.5 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {(record.entries || []).map((e, i) => (
                    <tr key={i} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2">{e.sr}</td><td className="px-3 py-2">{e.location}</td><td className="px-3 py-2">{e.stationType}</td>
                      <td className="px-3 py-2">{e.baitConsumed}g</td><td className="px-3 py-2">{e.baitReplaced}g</td>
                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${e.condition === 'good' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.condition}</span></td>
                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${e.pestActivity === 'none' ? 'bg-gray-100 text-gray-500' : e.pestActivity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.pestActivity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>)}

        {/* GENERIC FORM */}
        {!['attendance','insecticide','checklist','baitstation'].includes(record.formType) && !record.customData && (record.entries || []).length > 0 && (
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-blue-900 text-white text-xs">{['#','Location','Count','Status'].map(h => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {(record.entries || []).map((e, i) => (
                  <tr key={i} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-4 py-2">{e.sr}</td><td className="px-4 py-2">{e.location}</td><td className="px-4 py-2">{e.count}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${e.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CUSTOM FORM DATA */}
        {record.customData && (
          <div className="space-y-2 mb-4">
            {Object.entries(record.customData).map(([k, v]) => {
              if (k === 'tableRows') return null;
              if (typeof v === 'boolean') return <div key={k} className="flex items-center gap-2"><span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${v ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{v ? '✓' : '✗'}</span><span className="text-sm">{k}</span></div>;
              if (typeof v === 'string' && v.startsWith('data:image')) return <div key={k}><p className="text-xs font-bold text-gray-500 uppercase mb-1">{k}</p><img src={v} alt={k} className="border border-gray-200 rounded-xl max-h-24" /></div>;
              return <div key={k} className="bg-gray-50 rounded-lg px-4 py-2"><p className="text-xs text-gray-400 uppercase">{k}</p><p className="font-semibold text-gray-800">{String(v)}</p></div>;
            })}
          </div>
        )}

        {/* Remarks */}
        {record.remarks && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Remarks</p>
            <p className="text-gray-700">{record.remarks}</p>
          </div>
        )}

        {/* Signatures */}
        {(record.techSignature || record.clientSignature) && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            {[['Technician Signature', record.techSignature], ['Client / Supervisor Signature', record.clientSignature]].map(([l, v]) => v ? (
              <div key={l}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{l}</p>
                <div className="border-2 border-gray-200 rounded-xl p-2 bg-gray-50"><img src={v} alt={l} className="max-h-20 mx-auto" /></div>
                <div className="border-t border-gray-300 mt-3 pt-1"><p className="text-xs text-gray-400 text-center">{l}</p></div>
              </div>
            ) : (
              <div key={l}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{l}</p>
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-end justify-center pb-2"><p className="text-xs text-gray-300">Not signed</p></div>
                <div className="border-t border-gray-300 mt-3 pt-1"><p className="text-xs text-gray-400 text-center">{l}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-300">
          <span>{COMPANY.address}</span>
          <span>Generated: {fmtDT(Date.now())}</span>
        </div>
      </div>
    </div>
  );
}

// ─── RECORDS PAGE ────────────────────────────────────────────────────────────
function RecordsPage({ cu, projects, records, users, onDelete, toast }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewRec, setViewRec] = useState(null);

  let filtered = records;
  if (cu.role === 'staff') filtered = filtered.filter(r => r.userKey === cu.key);
  if (cu.role === 'client') filtered = filtered.filter(r => r.projectKey === cu.projectKey);
  if (fromDate) filtered = filtered.filter(r => r.date >= fromDate);
  if (toDate) filtered = filtered.filter(r => r.date <= toDate);
  if (typeFilter) filtered = filtered.filter(r => r.formType === typeFilter);
  filtered = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const types = [...new Set(records.map(r => r.formType))];

  const handlePrint = (rec) => {
    setViewRec(rec);
    setTimeout(() => window.print(), 800);
  };

  return (
    <div>
      <h4 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i className="fas fa-file-alt text-blue-800" />Records</h4>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">From</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">To</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Type</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>{types.map(t => <option key={t} value={t}>{formName(t)}</option>)}
            </select>
          </div>
          <div className="flex items-end"><button onClick={() => { setFromDate(''); setToDate(''); setTypeFilter(''); }} className="w-full border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 font-semibold">Clear Filters</button></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
          <p className="text-sm font-bold text-gray-600">{filtered.length} records found</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-left border-b">
              {['Date','Project','Type','Submitted By','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(r => {
                const proj = projects.find(p => p.key === r.projectKey);
                const usr = users.find(u => u.key === r.userKey);
                return (
                  <tr key={r.key} className="border-t hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-700">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{proj?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold">{formName(r.formType)}</span>
                      {r.location?.verified && <i className="fas fa-map-marker-alt text-green-500 ml-1.5 text-xs" title="GPS Verified" />}
                      {(r.techSignature || r.clientSignature) && <i className="fas fa-signature text-purple-500 ml-1.5 text-xs" title="Signed" />}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{usr?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewRec(r)} className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100"><i className="fas fa-eye" /></button>
                        <button onClick={() => handlePrint(r)} className="bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-100"><i className="fas fa-print" /></button>
                        {cu.role === 'admin' && <button onClick={() => { if (confirm('Delete this record?')) { onDelete(r.key); toast('Record deleted'); } }} className="bg-red-50 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-100"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewRec && (
        <Modal show={!!viewRec} onClose={() => setViewRec(null)} title="Report Preview" hdr="bg-blue-900" size="xl"
          footer={<>
            <button onClick={() => window.print()} className="bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-print" />Print / Save PDF</button>
            <button onClick={() => setViewRec(null)} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Close</button>
          </>}>
          <RecordReport record={viewRec} projects={projects} users={users} />
        </Modal>
      )}

      {/* Print-only: show record report */}
      {viewRec && <div className="hidden print:block"><RecordReport record={viewRec} projects={projects} users={users} /></div>}
    </div>
  );
}

// ─── FORM BUILDER ───────────────────────────────────────────────────────────
function FormBuilderPage({ customForms, onSave, onDelete, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fname, setFname] = useState('');
  const [ficon, setFicon] = useState('file-alt');
  const [fdesc, setFdesc] = useState('');
  const [factive, setFactive] = useState(true);
  const [fields, setFields] = useState([]);
  const [addingType, setAddingType] = useState('text');

  const FIELD_TYPES = [
    { v: 'text', l: 'Text Input' }, { v: 'number', l: 'Number' }, { v: 'textarea', l: 'Text Area' },
    { v: 'select', l: 'Dropdown' }, { v: 'checkbox', l: 'Checkbox (Tick)' }, { v: 'date', l: 'Date' },
    { v: 'time', l: 'Time' }, { v: 'signature', l: 'Signature Pad' }, { v: 'table', l: 'Table (Rows)' },
  ];
  const ICONS = ['file-alt','tasks','spray-can','box','clipboard-check','tools','bug','search','chart-bar','list-alt','clipboard-list','bell','flask','shield-alt','cog'];

  const open = (form = null) => {
    setEditing(form);
    setFname(form?.name || ''); setFicon(form?.icon || 'file-alt'); setFdesc(form?.description || ''); setFactive(form?.active ?? true);
    setFields(form?.fields ? JSON.parse(JSON.stringify(form.fields)) : []);
    setShowModal(true);
  };

  const addField = () => {
    const id = `field_${Date.now()}`;
    const defaults = { id, type: addingType, label: `New ${addingType} field`, required: false };
    if (addingType === 'select') defaults.options = ['Option 1', 'Option 2'];
    if (addingType === 'table') defaults.tableColumns = ['Column 1', 'Column 2'];
    setFields([...fields, defaults]);
  };

  const updateField = (idx, key, val) => {
    const nf = [...fields]; nf[idx] = { ...nf[idx], [key]: val }; setFields(nf);
  };
  const removeField = (idx) => setFields(fields.filter((_, i) => i !== idx));
  const moveField = (idx, dir) => {
    const nf = [...fields];
    const ni = idx + dir;
    if (ni < 0 || ni >= nf.length) return;
    [nf[idx], nf[ni]] = [nf[ni], nf[idx]]; setFields(nf);
  };

  const save = () => {
    if (!fname.trim()) { toast('Form name required', 'error'); return; }
    onSave({ name: fname.trim(), icon: ficon, description: fdesc, fields, active: factive }, editing?.key);
    setShowModal(false); toast(editing ? 'Form updated' : 'Form created');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h4 className="text-xl font-black text-gray-800 flex items-center gap-2"><i className="fas fa-tools text-blue-800" />Form Builder</h4>
          <p className="text-gray-400 text-sm mt-1">Create custom data entry forms with fields, checkboxes & signatures</p>
        </div>
        <button onClick={() => open()} className="bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-plus" />New Form</button>
      </div>

      {customForms.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <i className="fas fa-tools text-5xl text-gray-200 mb-4 block" />
          <p className="text-gray-400 font-semibold">No custom forms yet</p>
          <p className="text-gray-300 text-sm mt-1">Click "New Form" to create your first custom form</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customForms.map(f => (
          <div key={f.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center"><i className={`fas fa-${f.icon} text-purple-700`} /></div>
                <div><h6 className="font-bold text-gray-800">{f.name}</h6><p className="text-xs text-gray-400">{(f.fields || []).length} fields</p></div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${f.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{f.active ? 'Active' : 'Inactive'}</span>
            </div>
            {f.description && <p className="text-xs text-gray-500 mb-3">{f.description}</p>}
            <div className="flex flex-wrap gap-1 mb-3">
              {(f.fields || []).slice(0, 5).map(field => (
                <span key={field.id} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{field.type === 'signature' ? '✍' : field.type === 'checkbox' ? '☑' : field.type === 'table' ? '⊞' : '○'} {field.label}</span>
              ))}
              {(f.fields || []).length > 5 && <span className="bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full">+{f.fields.length - 5} more</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => open(f)} className="flex-1 border border-blue-200 text-blue-700 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50"><i className="fas fa-edit mr-1" />Edit</button>
              <button onClick={() => { if (confirm('Delete this form?')) { onDelete(f.key); toast('Form deleted'); } }} className="border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50"><i className="fas fa-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Form' : 'Create New Form'} hdr="bg-purple-800" size="xl"
        footer={<>
          <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
          <button onClick={save} className="bg-purple-700 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1" />Save Form</button>
        </>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Form Settings */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Form Name *</label>
              <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" value={fname} onChange={e => setFname(e.target.value)} placeholder="e.g. Fumigation Log" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Description</label>
              <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" value={fdesc} onChange={e => setFdesc(e.target.value)} placeholder="Brief description" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setFicon(ic)} className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all ${ficon === ic ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <i className={`fas fa-${ic}`} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded" checked={factive} onChange={e => setFactive(e.target.checked)} />
              <span className="text-sm font-semibold text-gray-700">Active (visible in Data Entry)</span>
            </label>

            {/* Add Field */}
            <div className="border-t pt-4">
              <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Add Field</label>
              <div className="flex gap-2">
                <select className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" value={addingType} onChange={e => setAddingType(e.target.value)}>
                  {FIELD_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <button type="button" onClick={addField} className="bg-purple-700 text-white px-4 rounded-xl text-sm font-bold hover:bg-purple-800"><i className="fas fa-plus" /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {FIELD_TYPES.map(t => (
                  <button key={t.v} type="button" onClick={() => { setAddingType(t.v); }} className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${addingType === t.v ? 'bg-purple-700 text-white border-purple-700' : 'border-gray-200 text-gray-500 hover:border-purple-400'}`}>{t.l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Fields List */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Form Fields ({fields.length})</label>
            {fields.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-300 text-sm">Add fields using the controls on the left</div>
            )}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {fields.map((field, idx) => (
                <div key={field.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{field.type}</span>
                    <div className="flex gap-1 ml-auto">
                      <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">↑</button>
                      <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">↓</button>
                      <button type="button" onClick={() => removeField(idx)} className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 text-xs"><i className="fas fa-trash" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <input type="text" placeholder="Field label" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} />
                    {field.type === 'text' && <input type="text" placeholder="Placeholder text" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" value={field.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)} />}
                    {field.type === 'select' && (
                      <textarea placeholder="Options (one per line)" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" rows={3} value={(field.options || []).join('\n')} onChange={e => updateField(idx, 'options', e.target.value.split('\n').filter(Boolean))} />
                    )}
                    {field.type === 'table' && (
                      <input type="text" placeholder="Columns (comma separated)" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" value={(field.tableColumns || []).join(', ')} onChange={e => updateField(idx, 'tableColumns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                    )}
                    {!['checkbox','signature','table'].includes(field.type) && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="w-3 h-3" checked={field.required || false} onChange={e => updateField(idx, 'required', e.target.checked)} />
                        <span className="text-xs text-gray-500">Required field</span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── STAFF PAGE ──────────────────────────────────────────────────────────────
function StaffPage({ users, projects, onSave, onDelete, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [empId, setEmpId] = useState(''); const [name, setName] = useState(''); const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); const [phone, setPhone] = useState(''); const [active, setActive] = useState(true);
  const [selProj, setSelProj] = useState([]);

  const open = (s = null) => {
    setEditing(s); setEmpId(s?.empId || ''); setName(s?.name || ''); setUsername(s?.username || '');
    setPassword(''); setPhone(s?.phone || ''); setActive(s?.active ?? true); setSelProj(s?.projects || []);
    setShowModal(true);
  };
  const save = () => {
    if (!empId || !name || !username) { toast('Fill required fields', 'error'); return; }
    if (!editing && !password) { toast('Password required', 'error'); return; }
    if (users.find(u => u.username?.toLowerCase() === username.toLowerCase() && u.key !== editing?.key)) { toast('Username exists', 'error'); return; }
    const d = { empId, name, username, phone, role: 'staff', projects: selProj, active };
    if (password) d.password = password;
    onSave(d, editing?.key); setShowModal(false); toast(editing ? 'Staff updated' : 'Staff added');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h4 className="text-xl font-black text-gray-800 flex items-center gap-2"><i className="fas fa-users text-blue-800" />Staff</h4>
        <button onClick={() => open()} className="bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-plus" />Add Staff</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-left border-b">{['Emp ID','Name','Username','Projects','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {users.filter(u => u.role === 'staff').map(s => {
                const pn = (s.projects || []).map(pk => projects.find(p => p.key === pk)?.code).filter(Boolean).join(', ');
                return (
                  <tr key={s.key} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{s.empId || '-'}</td>
                    <td className="px-4 py-3 font-bold">{s.name}</td>
                    <td className="px-4 py-3"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{s.username}</code></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{pn || 'None'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1.5">
                      <button onClick={() => open(s)} className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100"><i className="fas fa-edit" /></button>
                      <button onClick={() => { if (confirm('Delete?')) { onDelete(s.key); toast('Deleted'); } }} className="bg-red-50 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-100"><i className="fas fa-trash" /></button>
                    </div></td>
                  </tr>
                );
              })}
              {users.filter(u => u.role === 'staff').length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No staff members</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Staff' : 'Add Staff'} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button><button onClick={save} className="bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1" />Save</button></>}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[['Employee ID *', empId, setEmpId],['Full Name *', name, setName],['Username *', username, setUsername],['Password', password, setPassword, editing ? 'Leave empty to keep' : ''],['Phone', phone, setPhone]].map(([l, v, s, h]) => (
            <div key={l}><label className="text-xs font-bold text-gray-600 uppercase block mb-1">{l}</label>
              <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={h || ''} value={v} onChange={e => s(e.target.value)} /></div>
          ))}
          <div className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 rounded" id="sa" checked={active} onChange={e => setActive(e.target.checked)} /><label htmlFor="sa" className="text-sm font-semibold text-gray-700 cursor-pointer">Active</label></div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-2">Assigned Projects</label>
          <div className="border border-gray-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1">
            {projects.filter(p => p.active).map(p => (
              <label key={p.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                <input type="checkbox" className="w-4 h-4 rounded" checked={selProj.includes(p.key)} onChange={e => setSelProj(e.target.checked ? [...selProj, p.key] : selProj.filter(k => k !== p.key))} />
                <span className="text-sm">{p.code} – {p.name}</span>
              </label>
            ))}
            {projects.filter(p => p.active).length === 0 && <p className="text-gray-400 text-sm">No active projects</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── CLIENTS PAGE ────────────────────────────────────────────────────────────
function ClientsPage({ users, projects, onSave, onDelete, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState(''); const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); const [projKey, setProjKey] = useState(''); const [active, setActive] = useState(true);

  const open = (c = null) => {
    setEditing(c); setName(c?.name || ''); setUsername(c?.username || ''); setPassword(''); setProjKey(c?.projectKey || ''); setActive(c?.active ?? true);
    setShowModal(true);
  };
  const save = () => {
    if (!name || !username || !projKey) { toast('Fill required fields', 'error'); return; }
    if (!editing && !password) { toast('Password required', 'error'); return; }
    if (users.find(u => u.username?.toLowerCase() === username.toLowerCase() && u.key !== editing?.key)) { toast('Username exists', 'error'); return; }
    const d = { name, username, projectKey: projKey, role: 'client', active };
    if (password) d.password = password;
    onSave(d, editing?.key); setShowModal(false); toast(editing ? 'Client updated' : 'Client added');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h4 className="text-xl font-black text-gray-800 flex items-center gap-2"><i className="fas fa-user-tie text-blue-800" />Clients</h4>
        <button onClick={() => open()} className="bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-plus" />Add Client</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-left border-b">{['Username','Client Name','Project','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {users.filter(u => u.role === 'client').map(c => {
                const proj = projects.find(p => p.key === c.projectKey);
                return (
                  <tr key={c.key} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{c.username}</code></td>
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{proj?.name || <span className="text-gray-300">Not assigned</span>}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1.5">
                      <button onClick={() => open(c)} className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100"><i className="fas fa-edit" /></button>
                      <button onClick={() => { if (confirm('Delete?')) { onDelete(c.key); toast('Deleted'); } }} className="bg-red-50 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-100"><i className="fas fa-trash" /></button>
                    </div></td>
                  </tr>
                );
              })}
              {users.filter(u => u.role === 'client').length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No client accounts</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Client' : 'Add Client'} hdr="bg-green-700" size="md"
        footer={<><button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button><button onClick={save} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1" />Save</button></>}>
        <div className="space-y-3">
          {[['Client / Company Name *', name, setName],['Username *', username, setUsername],['Password', password, setPassword, editing ? 'Leave empty to keep' : '']].map(([l, v, s, h]) => (
            <div key={l}><label className="text-xs font-bold text-gray-600 uppercase block mb-1">{l}</label><input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder={h || ''} value={v} onChange={e => s(e.target.value)} /></div>
          ))}
          <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Assigned Project *</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={projKey} onChange={e => setProjKey(e.target.value)}>
              <option value="">-- Select Project --</option>{projects.filter(p => p.active).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded" checked={active} onChange={e => setActive(e.target.checked)} /><span className="text-sm font-semibold text-gray-700">Active</span></label>
        </div>
      </Modal>
    </div>
  );
}

// ─── PROJECTS PAGE ───────────────────────────────────────────────────────────
function ProjectsPage({ projects, onSave, onDelete, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [client, setClient] = useState('');
  const [contact, setContact] = useState(''); const [address, setAddress] = useState('');
  const [lat, setLat] = useState(''); const [lng, setLng] = useState(''); const [radius, setRadius] = useState('50');
  const [gps, setGps] = useState(false); const [active, setActive] = useState(true);

  const open = (p = null) => {
    setEditing(p); setCode(p?.code || ''); setName(p?.name || ''); setClient(p?.client || '');
    setContact(p?.contact || ''); setAddress(p?.address || ''); setLat(p?.lat?.toString() || '');
    setLng(p?.lng?.toString() || ''); setRadius(p?.radius?.toString() || '50'); setGps(p?.gpsEnabled || false); setActive(p?.active ?? true);
    setShowModal(true);
  };
  const captureLoc = () => {
    if (!navigator.geolocation) { toast('Not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(p => { setLat(p.coords.latitude.toFixed(6)); setLng(p.coords.longitude.toFixed(6)); toast('Location captured!'); }, () => toast('Location error', 'error'), { enableHighAccuracy: true });
  };
  const save = () => {
    if (!code || !name || !client) { toast('Fill required fields', 'error'); return; }
    onSave({ code, name, client, contact, address, lat: parseFloat(lat) || null, lng: parseFloat(lng) || null, radius: parseInt(radius) || 50, gpsEnabled: gps, active }, editing?.key);
    setShowModal(false); toast(editing ? 'Project updated' : 'Project added');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h4 className="text-xl font-black text-gray-800 flex items-center gap-2"><i className="fas fa-building text-blue-800" />Projects</h4>
        <button onClick={() => open()} className="bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-plus" />Add Project</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-left border-b">{['Code','Name','Client','GPS','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.key} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-black text-blue-800">{p.code}</td>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.client}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.gpsEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{p.gpsEnabled ? '📍 Enabled' : 'Disabled'}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{p.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3"><div className="flex gap-1.5">
                    <button onClick={() => open(p)} className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100"><i className="fas fa-edit" /></button>
                    <button onClick={() => { if (confirm('Delete project?')) { onDelete(p.key); toast('Deleted'); } }} className="bg-red-50 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-100"><i className="fas fa-trash" /></button>
                  </div></td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No projects found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'Add Project'} size="lg"
        footer={<><button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button><button onClick={save} className="bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1" />Save</button></>}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[['Project Code *', code, setCode],['Project Name *', name, setName],['Client Name *', client, setClient],['Contact Person', contact, setContact]].map(([l, v, s]) => (
            <div key={l}><label className="text-xs font-bold text-gray-600 uppercase block mb-1">{l}</label><input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={v} onChange={e => s(e.target.value)} /></div>
          ))}
          <div className="col-span-2"><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Address</label><input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={address} onChange={e => setAddress(e.target.value)} /></div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3">
          <label className="flex items-center gap-2 cursor-pointer mb-3"><input type="checkbox" className="w-4 h-4 rounded" checked={gps} onChange={e => setGps(e.target.checked)} /><span className="text-sm font-bold text-gray-700"><i className="fas fa-map-marker-alt text-blue-700 mr-1" />Enable GPS Authentication</span></label>
          <div className="grid grid-cols-3 gap-2">
            {[['Latitude', lat, setLat],['Longitude', lng, setLng],['Radius (m)', radius, setRadius]].map(([l, v, s]) => (
              <div key={l}><label className="text-xs font-bold text-gray-500 block mb-1">{l}</label><input type="number" step="any" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={v} onChange={e => s(e.target.value)} /></div>
            ))}
          </div>
          <button type="button" onClick={captureLoc} className="mt-2 border border-blue-600 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 flex items-center gap-2"><i className="fas fa-crosshairs" />Use My Location</button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded" checked={active} onChange={e => setActive(e.target.checked)} /><span className="text-sm font-semibold text-gray-700">Active</span></label>
      </Modal>
    </div>
  );
}

// ─── REMARKS PAGE ────────────────────────────────────────────────────────────
function RemarksPage({ remarks, users, projects, onDelete, toast }) {
  return (
    <div>
      <h4 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i className="fas fa-comments text-blue-800" />Client Remarks</h4>
      <div className="space-y-3">
        {[...remarks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
          const usr = users.find(u => u.key === r.userKey);
          const proj = projects.find(p => p.key === r.projectKey);
          return (
            <div key={r.key} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800 flex items-center gap-2"><i className="fas fa-user text-yellow-600" />{usr?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{proj?.name || '-'} · {fmtDT(r.createdAt)}</p>
                </div>
                <button onClick={() => { if (confirm('Delete?')) { onDelete(r.key); toast('Deleted'); } }} className="text-red-400 hover:text-red-600 text-sm w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"><i className="fas fa-trash" /></button>
              </div>
              <p className="text-gray-700">{r.text}</p>
            </div>
          );
        })}
        {remarks.length === 0 && <div className="bg-white rounded-2xl p-10 text-center text-gray-300 text-sm border border-gray-100">No client remarks yet</div>}
      </div>
    </div>
  );
}

// ─── COMPLAINT MODAL ─────────────────────────────────────────────────────────
function ComplaintModal({ show, onClose, cu, projects, onSave, toast }) {
  const [text, setText] = useState('');
  const proj = projects.find(p => p.key === cu.projectKey);
  const msg = encodeURIComponent(`*IPM Complaint – ${proj?.name || ''}*\n\n${text}`);
  const submit = () => {
    if (!text.trim()) { toast('Enter your remark', 'error'); return; }
    onSave({ text, userKey: cu.key, projectKey: cu.projectKey });
    setText(''); onClose(); toast('Remark submitted!');
  };
  return (
    <Modal show={show} onClose={onClose} title="Add Remark / Complaint" hdr="bg-yellow-600" size="md"
      footer={<>
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <a href={`https://wa.me/${COMPANY.whatsapp}?text=${msg}`} target="_blank" rel="noreferrer" className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-600"><i className="fab fa-whatsapp" />WhatsApp</a>
        <a href={`mailto:${COMPANY.email}?subject=IPM Complaint – ${proj?.name || ''}&body=${text}`} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700"><i className="fas fa-envelope" />Email</a>
        <button onClick={submit} className="bg-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-600"><i className="fas fa-paper-plane mr-1" />Submit</button>
      </>}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-3 text-sm"><i className="fas fa-info-circle mr-2" />Project: <strong>{proj?.name || '-'}</strong></div>
        <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Your Remark / Complaint</label>
          <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" rows={5} placeholder="Describe your issue or feedback..." value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <p className="font-bold text-gray-600 mb-1">Contact Options</p>
          <p><i className="fas fa-phone mr-1" />{COMPANY.phone}</p>
          <p><i className="fas fa-envelope mr-1" />{COMPANY.email}</p>
        </div>
      </div>
    </Modal>
  );
}

// ─── SETTINGS PAGE ───────────────────────────────────────────────────────────
function SettingsPage({ cu, onSaveUser, users, records, projects, remarks, toast }) {
  const [name, setName] = useState(cu.name);
  const [password, setPassword] = useState('');
  const save = () => {
    if (!name) { toast('Name required', 'error'); return; }
    const d = { name };
    if (password) d.password = password;
    onSaveUser(d, cu.key); toast('Settings saved!');
  };
  const exportData = () => {
    const data = { users, records, projects, remarks, exportedAt: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `a2z_ipm_backup_${todayStr()}.json`; a.click();
    toast('Data exported!');
  };
  return (
    <div>
      <h4 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i className="fas fa-cog text-blue-800" />Settings</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-blue-900 text-white px-5 py-3.5 rounded-t-2xl font-bold flex items-center gap-2"><i className="fas fa-user" />My Profile</div>
          <div className="p-5 space-y-4">
            <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">Name</label><input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={e => setName(e.target.value)} /></div>
            <div><label className="text-xs font-bold text-gray-600 uppercase block mb-1">New Password</label><input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Leave empty to keep current" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <button onClick={save} className="bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900"><i className="fas fa-save" />Save Changes</button>
          </div>
        </div>
        {cu.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="bg-blue-900 text-white px-5 py-3.5 rounded-t-2xl font-bold flex items-center gap-2"><i className="fas fa-database" />Data & System</div>
            <div className="p-5 space-y-3">
              <button onClick={exportData} className="w-full border-2 border-green-500 text-green-600 py-2.5 rounded-xl text-sm font-bold hover:bg-green-50 flex items-center justify-center gap-2"><i className="fas fa-download" />Export All Data (JSON)</button>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1.5">
                <p className="font-bold text-gray-800 text-base">System Info</p>
                <p><span className="text-gray-400">Version:</span> 3.0.0</p>
                <p><span className="text-gray-400">Company:</span> {COMPANY.name}</p>
                <p><span className="text-gray-400">Phone:</span> {COMPANY.phone}</p>
                <p><span className="text-gray-400">Email:</span> {COMPANY.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export function App() {
  const { users, projects, records, remarks, customForms, products, stockLogs, loading, saveUser, deleteUser, saveProject, deleteProject, saveRecord, deleteRecord, saveRemark, deleteRemark, saveCustomForm, deleteCustomForm, saveProduct, deleteProduct, saveStockLog, ensureAdmin } = useFirebase();
  const [cu, setCu] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showComplaint, setShowComplaint] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const adminChecked = useRef(false);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  useEffect(() => {
    if (!loading && !adminChecked.current) { adminChecked.current = true; ensureAdmin(users); }
  }, [loading, users]);

  useEffect(() => {
    if (!loading) {
      const saved = localStorage.getItem('a2z_user');
      if (saved) {
        const { key } = JSON.parse(saved);
        const user = users.find(u => u.key === key && u.active);
        if (user) setCu(user); else localStorage.removeItem('a2z_user');
      }
    }
  }, [loading, users]);

  const toast = (msg, type = 'success') => {
    const id = ++toastId;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  const handleLogin = (user) => { setCu(user); localStorage.setItem('a2z_user', JSON.stringify({ key: user.key })); setPage('dashboard'); };
  const handleLogout = () => { setCu(null); localStorage.removeItem('a2z_user'); };
  const nav = (p) => { setPage(p); setSidebarOpen(false); };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-700 flex items-center justify-center">
      <div className="text-white text-center"><i className="fas fa-bug text-6xl mb-4 block animate-bounce" />
        <p className="text-2xl font-black">A2Z IPM System</p><p className="text-blue-300 mt-2 flex items-center gap-2 justify-center"><i className="fas fa-spinner fa-spin" />Connecting to server...</p>
      </div>
    </div>
  );

  if (!cu) return (<><LoginPage onLogin={handleLogin} users={users} /><ToastBox toasts={toasts} remove={id => setToasts(p => p.filter(t => t.id !== id))} /></>);

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .sidebar, .topbar, header, nav, .no-print { display: none !important; }
          body { background: white !important; }
          .lg\\:ml-64 { margin-left: 0 !important; }
          @page { margin: 15mm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        <ToastBox toasts={toasts} remove={id => setToasts(p => p.filter(t => t.id !== id))} />

        {/* Online badge */}
        <div className={`fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg print:hidden ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />}
        <Sidebar page={page} role={cu.role} onNav={nav} open={sidebarOpen} />

        <div className="lg:ml-64 flex flex-col min-h-screen">
          {/* Topbar */}
          <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-20 print:hidden border-b border-gray-100">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-blue-800 p-1.5 rounded-lg hover:bg-gray-100"><i className="fas fa-bars text-lg" /></button>
            <div className="hidden lg:flex items-center gap-2 text-gray-400 text-sm">
              <i className="fas fa-bug text-blue-800" />
              <span className="font-bold text-blue-900">A2Z IPM</span>
              <span>/</span>
              <span>{NAV.find(n => n.page === page)?.label || page}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-gray-800 text-sm leading-none">{cu.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cu.role === 'admin' ? 'Administrator' : cu.role === 'staff' ? 'Staff' : 'Client'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-800 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">{cu.name.charAt(0).toUpperCase()}</div>
              <button onClick={handleLogout} className="border border-gray-200 text-gray-500 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5"><i className="fas fa-sign-out-alt" />Logout</button>
            </div>
          </header>

          {/* Pages */}
          <main className="flex-1 p-4 md:p-6">
            {page === 'dashboard'   && <Dashboard cu={cu} users={users} projects={projects} records={records} remarks={remarks} onComplaint={() => setShowComplaint(true)} onNav={nav} />}
            {page === 'dataentry'   && <DataEntryPage cu={cu} projects={projects} customForms={customForms} onSave={saveRecord} toast={toast} />}
            {page === 'records'     && <RecordsPage cu={cu} projects={projects} records={records} users={users} onDelete={deleteRecord} toast={toast} />}
            {page === 'reports'     && <ReportsPage cu={cu} projects={projects} records={records} users={users} />}
            {page === 'inventory'   && cu.role !== 'client' && <InventoryPage cu={cu} products={products} stockLogs={stockLogs} projects={projects} users={users} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onSaveStockLog={saveStockLog} toast={toast} />}
            {page === 'formbuilder' && cu.role === 'admin' && <FormBuilderPage customForms={customForms} onSave={saveCustomForm} onDelete={deleteCustomForm} toast={toast} />}
            {page === 'staff'       && cu.role === 'admin' && <StaffPage users={users} projects={projects} onSave={saveUser} onDelete={deleteUser} toast={toast} />}
            {page === 'clients'     && cu.role === 'admin' && <ClientsPage users={users} projects={projects} onSave={saveUser} onDelete={deleteUser} toast={toast} />}
            {page === 'projects'    && cu.role === 'admin' && <ProjectsPage projects={projects} onSave={saveProject} onDelete={deleteProject} toast={toast} />}
            {page === 'remarks'     && cu.role === 'admin' && <RemarksPage remarks={remarks} users={users} projects={projects} onDelete={deleteRemark} toast={toast} />}
            {page === 'settings'    && <SettingsPage cu={cu} onSaveUser={saveUser} users={users} records={records} projects={projects} remarks={remarks} toast={toast} />}
          </main>
        </div>

        {cu.role === 'client' && <ComplaintModal show={showComplaint} onClose={() => setShowComplaint(false)} cu={cu} projects={projects} onSave={saveRemark} toast={toast} />}
      </div>
    </>
  );
}
