// @ts-nocheck
import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { COMPANY } from './firebase';

const COLORS = ['#004080','#28a745','#ffc107','#dc3545','#17a2b8','#6f42c1','#fd7e14'];

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '-';
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
const todayStr = () => new Date().toISOString().split('T')[0];

const CATEGORIES = ['Insecticide','Rodenticide','Bait','Equipment','PPE','Other'];
const UNITS = ['ml','L','g','kg','pcs','box','roll','pair'];

function Modal({ show, onClose, title, hdr='bg-blue-900', children, footer, size='lg' }) {
  const sizes = { sm:'max-w-sm', md:'max-w-md', lg:'max-w-2xl', xl:'max-w-5xl', full:'max-w-7xl' };
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 bg-black/60" onClick={e=>e.target===e.currentTarget&&onClose()}>
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

// ─── PRODUCT MODAL (Admin Only) ───────────────────────────────────────────────
function ProductModal({ show, onClose, editing, onSave, toast }) {
  const [name, setName] = useState(editing?.name || '');
  const [category, setCategory] = useState(editing?.category || 'Insecticide');
  const [brand, setBrand] = useState(editing?.brand || '');
  const [unit, setUnit] = useState(editing?.unit || 'ml');
  const [sku, setSku] = useState(editing?.sku || '');
  const [minStock, setMinStock] = useState(editing?.minStock?.toString() || '500');
  const [openingStock, setOpeningStock] = useState(editing?.openingStock?.toString() || '0');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [active, setActive] = useState(editing?.active ?? true);

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'text-xs font-bold text-gray-600 uppercase block mb-1';

  const save = () => {
    if (!name.trim()) { toast('Product name required', 'error'); return; }
    onSave({
      name: name.trim(), category, brand, unit, sku, active,
      minStock: Number(minStock) || 0,
      openingStock: editing ? undefined : Number(openingStock) || 0,
      notes,
    }, editing?.key);
    onClose();
  };

  return (
    <Modal show={show} onClose={onClose} title={editing ? 'Edit Product' : 'Add Product'} hdr="bg-blue-900" size="lg"
      footer={<>
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <button onClick={save} className="bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1"/>Save Product</button>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Product Name *</label>
          <input type="text" className={inp} placeholder="e.g. Deltamethrin 2.5%" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select className={inp} value={category} onChange={e=>setCategory(e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Brand / Manufacturer</label>
          <input type="text" className={inp} placeholder="Brand name" value={brand} onChange={e=>setBrand(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>SKU / Batch Ref</label>
          <input type="text" className={inp} placeholder="e.g. SKU-001" value={sku} onChange={e=>setSku(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Unit</label>
          <select className={inp} value={unit} onChange={e=>setUnit(e.target.value)}>
            {UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Min Stock Alert ({unit})</label>
          <input type="number" className={inp} value={minStock} onChange={e=>setMinStock(e.target.value)} />
        </div>
        {!editing && (
          <div>
            <label className={lbl}>Opening Stock ({unit})</label>
            <input type="number" className={inp} value={openingStock} onChange={e=>setOpeningStock(e.target.value)} />
          </div>
        )}
        <div className="col-span-2">
          <label className={lbl}>Notes</label>
          <textarea className={inp} rows={2} placeholder="Optional notes..." value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={active} onChange={e=>setActive(e.target.checked)} />
            <span className="text-sm font-semibold text-gray-700">Active (visible to staff)</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ─── STOCK ADJUST MODAL (Admin) ───────────────────────────────────────────────
function StockAdjustModal({ show, onClose, product, onSave, toast }) {
  const [type, setType] = useState('add');
  const [qty, setQty] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  const save = () => {
    if (!qty || Number(qty) <= 0) { toast('Enter valid quantity', 'error'); return; }
    onSave({
      productKey: product.key, type, qty: Number(qty), batchNo, supplier, date, notes,
      entryType: 'admin_adjustment'
    });
    onClose(); toast('Stock updated!');
  };

  return (
    <Modal show={show} onClose={onClose} title={`Adjust Stock – ${product?.name}`} hdr="bg-green-700" size="md"
      footer={<>
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <button onClick={save} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1"/>Save</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Adjustment Type</label>
          <div className="grid grid-cols-3 gap-2">
            {[['add','Stock In','green'],['remove','Stock Out','red'],['adjust','Manual Adjust','blue']].map(([v,l,c])=>(
              <button key={v} onClick={()=>setType(v)}
                className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${type===v ? `bg-${c}-500 text-white border-${c}-500` : `border-gray-200 text-gray-500 hover:border-${c}-300`}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Quantity ({product?.unit}) *</label>
            <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Batch Number</label>
            <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="e.g. BT-2024-001" value={batchNo} onChange={e=>setBatchNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Supplier</label>
            <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Supplier name" value={supplier} onChange={e=>setSupplier(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Notes</label>
          <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ─── USAGE ENTRY MODAL (Staff) ────────────────────────────────────────────────
function UsageModal({ show, onClose, products, projects, cu, onSave, toast }) {
  const [productKey, setProductKey] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayStr());
  const [batchNo, setBatchNo] = useState('');
  const [notes, setNotes] = useState('');

  const myProjects = cu.role === 'staff'
    ? projects.filter(p => p.active && (cu.projects || []).includes(p.key))
    : projects.filter(p => p.active);

  const selProd = products.find(p => p.key === productKey);

  const save = () => {
    if (!productKey || !qty || Number(qty) <= 0) { toast('Select product and enter quantity', 'error'); return; }
    if (!projectKey) { toast('Select a project', 'error'); return; }
    onSave({
      productKey, projectKey, qty: Number(qty), batchNo, date, notes,
      userKey: cu.key, type: 'usage', entryType: 'staff_usage'
    });
    setProductKey(''); setQty(''); setBatchNo(''); setNotes('');
    onClose(); toast('Usage recorded!');
  };

  return (
    <Modal show={show} onClose={onClose} title="Log Chemical Usage" hdr="bg-orange-600" size="md"
      footer={<>
        <button onClick={onClose} className="border border-gray-300 text-gray-500 px-4 py-2 rounded-xl text-sm">Cancel</button>
        <button onClick={save} className="bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-bold"><i className="fas fa-save mr-1"/>Save Usage</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Product *</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={productKey} onChange={e=>setProductKey(e.target.value)}>
            <option value="">-- Select Product --</option>
            {products.filter(p=>p.active).map(p=>(
              <option key={p.key} value={p.key}>{p.name} ({p.unit}) – Stock: {p.currentStock ?? 0}</option>
            ))}
          </select>
        </div>
        {selProd && (
          <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${(selProd.currentStock ?? 0) < (selProd.minStock ?? 0) ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            <i className={`fas fa-${(selProd.currentStock ?? 0) < (selProd.minStock ?? 0) ? 'exclamation-triangle' : 'check-circle'}`} />
            Current Stock: <strong>{selProd.currentStock ?? 0} {selProd.unit}</strong>
            {(selProd.currentStock ?? 0) < (selProd.minStock ?? 0) && <span className="font-bold ml-1">⚠ LOW STOCK!</span>}
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Project *</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={projectKey} onChange={e=>setProjectKey(e.target.value)}>
            <option value="">-- Select Project --</option>
            {myProjects.map(p=><option key={p.key} value={p.key}>{p.code} – {p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Qty Used ({selProd?.unit || 'units'}) *</label>
            <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" value={qty} onChange={e=>setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Batch Number</label>
            <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="e.g. BT-001" value={batchNo} onChange={e=>setBatchNo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Notes</label>
          <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ─── INVENTORY REPORT (Print-ready) ──────────────────────────────────────────
function InventoryPrintReport({ products, stockLogs, users, projects, filterMonth }) {
  const [yr, mo] = filterMonth.split('-').map(Number);
  const monthLabel = new Date(yr, mo-1, 1).toLocaleString('en-GB',{month:'long',year:'numeric'});

  return (
    <div className="bg-white font-sans text-sm hidden print:block" style={{maxWidth:800,margin:'0 auto'}}>
      {/* Header */}
      <div className="bg-blue-900 text-white p-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-bug text-xl"/></div>
              <div>
                <h2 className="font-black text-xl leading-none">{COMPANY.name}</h2>
                <p className="text-blue-200 text-xs">Integrated Pest Management Services</p>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-blue-200">
            <p><i className="fas fa-phone mr-1"/>{COMPANY.phone}</p>
            <p><i className="fas fa-envelope mr-1"/>{COMPANY.email}</p>
          </div>
        </div>
      </div>
      <div className="border-b-4 border-blue-800 px-6 py-3 bg-blue-50">
        <h3 className="font-black text-blue-900 text-lg">Inventory & Stock Report</h3>
        <p className="text-gray-500 text-sm">{monthLabel} · Generated: {fmtDT(Date.now())}</p>
      </div>
      <div className="px-6 py-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ['Total Products', products.length, 'blue'],
            ['Low Stock', products.filter(p=>(p.currentStock??0)<(p.minStock??0)&&p.active).length, 'red'],
            ['Total Usage (Month)', stockLogs.filter(l=>l.date?.startsWith(filterMonth)&&l.type==='usage').reduce((s,l)=>s+l.qty,0), 'orange'],
            ['Stock-In (Month)', stockLogs.filter(l=>l.date?.startsWith(filterMonth)&&l.type==='add').reduce((s,l)=>s+l.qty,0), 'green'],
          ].map(([l,v,c])=>(
            <div key={l} className={`bg-gray-50 rounded-xl p-4 text-center border-l-4 border-${c}-500`}>
              <p className={`text-2xl font-black text-${c}-700`}>{v}</p>
              <p className="text-xs text-gray-400 mt-1">{l}</p>
            </div>
          ))}
        </div>
        {/* Products table */}
        <h4 className="font-bold text-gray-700 mb-2 text-base">Current Stock Status</h4>
        <table className="w-full text-xs mb-5 rounded-xl overflow-hidden">
          <thead><tr className="bg-blue-900 text-white">
            {['#','Product','Category','Brand','Unit','Current Stock','Min Alert','Status'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {products.filter(p=>p.active).map((p,i)=>{
              const low = (p.currentStock??0) < (p.minStock??0);
              return (
                <tr key={p.key} className={`border-t ${i%2===0?'bg-white':'bg-gray-50'}`}>
                  <td className="px-3 py-2 text-gray-400">{i+1}</td>
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2">{p.category}</td>
                  <td className="px-3 py-2">{p.brand||'-'}</td>
                  <td className="px-3 py-2">{p.unit}</td>
                  <td className="px-3 py-2 font-bold">{p.currentStock??0} {p.unit}</td>
                  <td className="px-3 py-2">{p.minStock??0} {p.unit}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${low?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{low?'⚠ Low':'OK'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Log table */}
        <h4 className="font-bold text-gray-700 mb-2 text-base">Transaction Log – {monthLabel}</h4>
        <table className="w-full text-xs rounded-xl overflow-hidden">
          <thead><tr className="bg-blue-900 text-white">
            {['Date','Product','Type','Qty','Project','By','Batch','Notes'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {stockLogs.filter(l=>l.date?.startsWith(filterMonth)).sort((a,b)=>a.date>b.date?-1:1).map((l,i)=>{
              const prod = products.find(p=>p.key===l.productKey);
              const proj = projects.find(p=>p.key===l.projectKey);
              const usr = users.find(u=>u.key===l.userKey);
              return (
                <tr key={l.key} className={`border-t ${i%2===0?'bg-white':'bg-gray-50'}`}>
                  <td className="px-3 py-2">{fmtDate(l.date)}</td>
                  <td className="px-3 py-2 font-semibold">{prod?.name||'-'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${l.type==='add'?'bg-green-100 text-green-700':l.type==='usage'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>
                      {l.type==='add'?'Stock In':l.type==='usage'?'Usage':'Adjust'}
                    </span>
                  </td>
                  <td className="px-3 py-2">{l.qty} {prod?.unit}</td>
                  <td className="px-3 py-2">{proj?.name||'-'}</td>
                  <td className="px-3 py-2">{usr?.name||(l.entryType==='admin_adjustment'?'Admin':'-')}</td>
                  <td className="px-3 py-2 font-mono">{l.batchNo||'-'}</td>
                  <td className="px-3 py-2 text-gray-400">{l.notes||'-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-6 pt-4 border-t flex justify-between text-xs text-gray-300">
          <span>{COMPANY.address}</span>
          <span>Generated: {fmtDT(Date.now())}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN INVENTORY PAGE ──────────────────────────────────────────────────────
export function InventoryPage({ cu, products, stockLogs, projects, users, onSaveProduct, onDeleteProduct, onSaveStockLog, toast }) {
  const [tab, setTab] = useState('products');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7));
  const [selProductTrend, setSelProductTrend] = useState('');

  const isAdmin = cu.role === 'admin';
  const isPCO = cu.role === 'admin' || cu.role === 'staff';

  // Compute current stock for each product from stockLogs
  const productsWithStock = products.map(prod => {
    const logs = stockLogs.filter(l => l.productKey === prod.key);
    let stock = prod.openingStock ?? 0;
    logs.forEach(l => {
      if (l.type === 'add') stock += l.qty;
      else if (l.type === 'usage') stock -= l.qty;
      else if (l.type === 'adjust') stock = l.qty; // manual set
    });
    return { ...prod, currentStock: Math.max(0, stock) };
  });

  const filteredProducts = productsWithStock.filter(p => {
    const matchQ = !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase()) || p.brand?.toLowerCase().includes(searchQ.toLowerCase());
    const matchCat = !catFilter || p.category === catFilter;
    return matchQ && matchCat;
  });

  const lowStockProducts = productsWithStock.filter(p => p.active && (p.currentStock ?? 0) < (p.minStock ?? 0));

  // Month logs
  const monthLogs = stockLogs.filter(l => l.date?.startsWith(filterMonth));
  const totalUsage = monthLogs.filter(l=>l.type==='usage').reduce((s,l)=>s+l.qty,0);
  const totalStockIn = monthLogs.filter(l=>l.type==='add').reduce((s,l)=>s+l.qty,0);

  // Per-product trend data for selected product
  const trendProduct = productsWithStock.find(p=>p.key===selProductTrend);
  const trendData = [];
  if (trendProduct) {
    const [yr, mo] = filterMonth.split('-').map(Number);
    const days = new Date(yr, mo, 0).getDate();
    let runningStock = trendProduct.openingStock ?? 0;
    // Pre-apply logs before this month
    stockLogs.filter(l=>l.productKey===selProductTrend && l.date < `${filterMonth}-01`).forEach(l=>{
      if (l.type==='add') runningStock += l.qty;
      else if (l.type==='usage') runningStock -= l.qty;
      else if (l.type==='adjust') runningStock = l.qty;
    });
    for (let d=1; d<=days; d++) {
      const ds = `${filterMonth}-${String(d).padStart(2,'0')}`;
      const dayLogs = stockLogs.filter(l=>l.productKey===selProductTrend&&l.date===ds);
      let used=0, received=0;
      dayLogs.forEach(l=>{
        if (l.type==='add') { runningStock+=l.qty; received+=l.qty; }
        else if (l.type==='usage') { runningStock-=l.qty; used+=l.qty; }
        else if (l.type==='adjust') runningStock=l.qty;
      });
      if (dayLogs.length>0 || d===1) {
        trendData.push({ day:d, stock:Math.max(0,runningStock), used, received });
      }
    }
  }

  // Usage by product (bar chart)
  const usageByProduct = products.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0,15)+'…' : p.name,
    usage: monthLogs.filter(l=>l.productKey===p.key&&l.type==='usage').reduce((s,l)=>s+l.qty,0),
    received: monthLogs.filter(l=>l.productKey===p.key&&l.type==='add').reduce((s,l)=>s+l.qty,0),
  })).filter(d=>d.usage>0||d.received>0);

  const TABS = [
    { id:'products', label:'Products',      icon:'box-open',   adminOnly:false },
    { id:'log',      label:'Stock Log',     icon:'list-alt',   adminOnly:false },
    { id:'usage',    label:'Usage Log',     icon:'spray-can',  adminOnly:false },
    { id:'trend',    label:'Trend Analysis',icon:'chart-line', adminOnly:false },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div>
          <h4 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <i className="fas fa-warehouse text-blue-800"/>Central Inventory
          </h4>
          <p className="text-gray-400 text-sm mt-0.5">Manage chemicals, equipment & supplies</p>
        </div>
        <div className="flex gap-2 flex-wrap print:hidden">
          {isPCO && (
            <button onClick={()=>setShowUsageModal(true)} className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600">
              <i className="fas fa-minus-circle"/>Log Usage
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={()=>{setEditingProduct(null);setShowProductModal(true);}} className="bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-900">
                <i className="fas fa-plus"/>Add Product
              </button>
              <button onClick={()=>window.print()} className="border border-blue-300 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-50">
                <i className="fas fa-print"/>Print Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl mt-0.5"/>
          <div>
            <p className="font-bold text-red-700 text-base">⚠ Low Stock Alert ({lowStockProducts.length} products)</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lowStockProducts.map(p=>(
                <span key={p.key} className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-bold">
                  {p.name}: {p.currentStock}{p.unit} / min {p.minStock}{p.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { l:'Total Products', v:products.filter(p=>p.active).length, c:'from-blue-600 to-blue-800', i:'box-open' },
          { l:'Low Stock Items', v:lowStockProducts.length, c:'from-red-500 to-red-700', i:'exclamation-triangle' },
          { l:`Usage This Month`, v:totalUsage, c:'from-orange-500 to-orange-700', i:'spray-can', suf:'units' },
          { l:`Stock-In This Month`, v:totalStockIn, c:'from-green-500 to-green-700', i:'plus-circle', suf:'units' },
        ].map(s=>(
          <div key={s.l} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.c} flex items-center justify-center shrink-0`}>
              <i className={`fas fa-${s.i} text-white`}/>
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{v instanceof Number ? v.toLocaleString() : s.v}{s.suf?` ${s.suf}`:''}</p>
              <p className="text-xs text-gray-400 leading-tight">{s.l}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Month filter (for logs + trend) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4 flex flex-wrap gap-3 items-center print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Month:</label>
          <input type="month" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Search:</label>
          <input type="text" placeholder="Search products..." className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Category:</label>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            <option value="">All</option>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5 overflow-x-auto print:hidden">
        {TABS.map(t=>(!t.adminOnly || isAdmin) && (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${tab===t.id?'bg-white text-blue-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            <i className={`fas fa-${t.icon} text-xs`}/>{t.label}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-gray-500 border-b text-left">
                {['Product','Category','Brand','SKU','Unit','Current Stock','Min Alert','Status','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredProducts.map(p => {
                  const low = (p.currentStock??0) < (p.minStock??0) && p.active;
                  return (
                    <tr key={p.key} className={`border-t hover:bg-gray-50 transition-colors ${low?'bg-red-50/30':''}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-800">{p.name}</div>
                        {p.notes && <div className="text-xs text-gray-400 truncate max-w-36">{p.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.brand||'-'}</td>
                      <td className="px-4 py-3"><code className="bg-gray-100 text-xs px-2 py-0.5 rounded">{p.sku||'-'}</code></td>
                      <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`font-black text-lg ${low?'text-red-600':'text-blue-800'}`}>{p.currentStock??0}</span>
                        <span className="text-gray-400 text-xs ml-1">{p.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{p.minStock??0} {p.unit}</td>
                      <td className="px-4 py-3">
                        {low
                          ? <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">⚠ Low</span>
                          : <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold">✓ OK</span>}
                        {!p.active && <span className="ml-1 bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full">Inactive</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {isAdmin && (
                            <>
                              <button onClick={()=>{setAdjustProduct(p);setShowAdjustModal(true);}}
                                className="bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100" title="Adjust Stock">
                                <i className="fas fa-plus-minus"/>
                              </button>
                              <button onClick={()=>{setEditingProduct(p);setShowProductModal(true);}}
                                className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100">
                                <i className="fas fa-edit"/>
                              </button>
                              <button onClick={()=>{if(confirm('Delete product?')){onDeleteProduct(p.key);toast('Deleted');}}}
                                className="bg-red-50 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-100">
                                <i className="fas fa-trash"/>
                              </button>
                            </>
                          )}
                          <button onClick={()=>{setSelProductTrend(p.key);setTab('trend');}}
                            className="bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-100" title="View Trend">
                            <i className="fas fa-chart-line"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK LOG TAB */}
      {tab === 'log' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-700"/>Usage vs Stock-In – {filterMonth}</h5>
              {usageByProduct.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={usageByProduct} margin={{left:-10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="name" tick={{fontSize:9}} angle={-20} textAnchor="end" height={40}/>
                    <YAxis tick={{fontSize:10}} allowDecimals={false}/>
                    <Tooltip/>
                    <Legend/>
                    <Bar dataKey="usage" name="Used" fill="#fd7e14" radius={[4,4,0,0]}/>
                    <Bar dataKey="received" name="Received" fill="#28a745" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-gray-300 text-sm">No data this month</div>}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-list text-blue-700"/>Stock Summary – {filterMonth}</h5>
              <div className="space-y-2 overflow-y-auto max-h-48">
                {productsWithStock.filter(p=>p.active).map(p=>{
                  const used = monthLogs.filter(l=>l.productKey===p.key&&l.type==='usage').reduce((s,l)=>s+l.qty,0);
                  const received = monthLogs.filter(l=>l.productKey===p.key&&l.type==='add').reduce((s,l)=>s+l.qty,0);
                  const low = (p.currentStock??0) < (p.minStock??0);
                  return (
                    <div key={p.key} className={`flex justify-between items-center py-2 border-b last:border-0 ${low?'bg-red-50/50 rounded-xl px-2':''}`}>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">Used: {used} · In: {received} {p.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${low?'text-red-600':'text-blue-800'}`}>{p.currentStock??0}</p>
                        <p className="text-xs text-gray-400">{p.unit}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full Log Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-blue-900 text-white font-bold flex items-center gap-2 rounded-t-2xl">
              <i className="fas fa-list-alt"/>Transaction Log
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-gray-500 border-b text-left">
                  {['Date','Product','Type','Qty','Project','By','Batch #','Supplier','Notes'].map(h=>(
                    <th key={h} className="px-3 py-3 text-xs font-bold uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {monthLogs.sort((a,b)=>a.date>b.date?-1:1).map((l,i)=>{
                    const prod = productsWithStock.find(p=>p.key===l.productKey);
                    const proj = projects.find(p=>p.key===l.projectKey);
                    const usr = users.find(u=>u.key===l.userKey);
                    return (
                      <tr key={l.key||i} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-gray-700">{fmtDate(l.date)}</td>
                        <td className="px-3 py-2.5 font-semibold">{prod?.name||'-'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${l.type==='add'?'bg-green-100 text-green-700':l.type==='usage'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>
                            {l.type==='add'?'📦 Stock In':l.type==='usage'?'🔧 Usage':'⚙ Adjust'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-gray-800">{l.qty} <span className="text-gray-400 font-normal text-xs">{prod?.unit}</span></td>
                        <td className="px-3 py-2.5 text-gray-600">{proj?.name||'-'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{usr?.name||(l.entryType==='admin_adjustment'?'Admin':'-')}</td>
                        <td className="px-3 py-2.5"><code className="bg-gray-100 text-xs px-1.5 py-0.5 rounded">{l.batchNo||'-'}</code></td>
                        <td className="px-3 py-2.5 text-gray-500">{l.supplier||'-'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{l.notes||'-'}</td>
                      </tr>
                    );
                  })}
                  {monthLogs.length===0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">No transactions this month</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* USAGE LOG TAB (Staff view) */}
      {tab === 'usage' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-orange-600 text-white font-bold flex items-center justify-between rounded-t-2xl">
              <span className="flex items-center gap-2"><i className="fas fa-spray-can"/>Usage Records – {filterMonth}</span>
              {isPCO && <button onClick={()=>setShowUsageModal(true)} className="bg-white text-orange-600 px-3 py-1 rounded-xl text-xs font-bold hover:bg-orange-50"><i className="fas fa-plus mr-1"/>Log Usage</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-gray-500 border-b text-left">
                  {['Date','Product','Qty Used','Project','Technician','Batch #','Notes'].map(h=>(
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {monthLogs.filter(l=>l.type==='usage').sort((a,b)=>a.date>b.date?-1:1).map((l,i)=>{
                    const prod = productsWithStock.find(p=>p.key===l.productKey);
                    const proj = projects.find(p=>p.key===l.projectKey);
                    const usr = users.find(u=>u.key===l.userKey);
                    return (
                      <tr key={l.key||i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{fmtDate(l.date)}</td>
                        <td className="px-4 py-3 font-bold">{prod?.name||'-'}</td>
                        <td className="px-4 py-3"><span className="font-black text-orange-600">{l.qty}</span> <span className="text-gray-400 text-xs">{prod?.unit}</span></td>
                        <td className="px-4 py-3 text-gray-600">{proj?.name||'-'}</td>
                        <td className="px-4 py-3 text-gray-600">{usr?.name||'-'}</td>
                        <td className="px-4 py-3"><code className="bg-gray-100 text-xs px-2 py-0.5 rounded">{l.batchNo||'-'}</code></td>
                        <td className="px-4 py-3 text-xs text-gray-400">{l.notes||'-'}</td>
                      </tr>
                    );
                  })}
                  {monthLogs.filter(l=>l.type==='usage').length===0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No usage records this month</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TREND ANALYSIS TAB */}
      {tab === 'trend' && (
        <div className="space-y-5">
          {/* Product selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Select Product for Trend</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selProductTrend} onChange={e=>setSelProductTrend(e.target.value)}>
              <option value="">-- Select Product --</option>
              {productsWithStock.filter(p=>p.active).map(p=>(
                <option key={p.key} value={p.key}>{p.name} (Stock: {p.currentStock??0} {p.unit})</option>
              ))}
            </select>
          </div>

          {trendProduct && (
            <>
              {/* Product info card */}
              <div className={`rounded-2xl p-5 border-2 ${(trendProduct.currentStock??0)<(trendProduct.minStock??0)?'bg-red-50 border-red-300':'bg-green-50 border-green-300'}`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <h5 className="font-black text-gray-800 text-lg">{trendProduct.name}</h5>
                    <p className="text-gray-500 text-sm">{trendProduct.category} · {trendProduct.brand||'—'} · SKU: {trendProduct.sku||'—'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      ['Current Stock', `${trendProduct.currentStock??0} ${trendProduct.unit}`, (trendProduct.currentStock??0)<(trendProduct.minStock??0)?'text-red-600':'text-green-700'],
                      ['Min Alert', `${trendProduct.minStock??0} ${trendProduct.unit}`, 'text-orange-600'],
                      ['Month Usage', `${monthLogs.filter(l=>l.productKey===trendProduct.key&&l.type==='usage').reduce((s,l)=>s+l.qty,0)} ${trendProduct.unit}`, 'text-blue-700'],
                    ].map(([l,v,c])=>(
                      <div key={l} className="bg-white rounded-xl p-3 shadow-sm">
                        <p className={`text-xl font-black ${c}`}>{v}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {(trendProduct.currentStock??0)<(trendProduct.minStock??0) && (
                  <div className="mt-3 bg-red-100 text-red-700 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"/>⚠ Stock below minimum threshold! Please reorder.
                  </div>
                )}
              </div>

              {/* Stock level over time */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-area text-blue-700"/>Stock Level Trend – {filterMonth}</h5>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#004080" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#004080" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="usedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fd7e14" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#fd7e14" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="day" tick={{fontSize:10}} label={{value:'Day',position:'insideBottom',offset:-5,fontSize:10}}/>
                      <YAxis tick={{fontSize:10}}/>
                      <Tooltip formatter={(v,n)=>[`${v} ${trendProduct.unit}`,n]}/>
                      <Legend/>
                      {trendProduct.minStock && (
                        <Line type="monotone" dataKey="min" name={`Min Alert (${trendProduct.minStock})`} stroke="#dc3545" strokeDasharray="8 4" strokeWidth={2} dot={false} data={trendData.map(d=>({...d,min:trendProduct.minStock}))}/>
                      )}
                      <Area type="monotone" dataKey="stock" name="Stock Level" stroke="#004080" strokeWidth={2.5} fill="url(#stockGrad)"/>
                      <Area type="monotone" dataKey="used" name="Daily Usage" stroke="#fd7e14" strokeWidth={2} fill="url(#usedGrad)"/>
                      <Bar dataKey="received" name="Received" fill="#28a745" radius={[4,4,0,0]}/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-56 flex items-center justify-center text-gray-300 text-sm">No transactions this month</div>}
              </div>

              {/* Transaction detail for this product */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800 text-white font-bold flex items-center gap-2 rounded-t-2xl">
                  <i className="fas fa-history"/>Transaction History – {trendProduct.name}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 text-gray-500 border-b text-left">
                      {['Date','Type','Qty','Project','By','Batch #','Notes'].map(h=>(
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {stockLogs.filter(l=>l.productKey===trendProduct.key).sort((a,b)=>a.date>b.date?-1:1).map((l,i)=>{
                        const proj=projects.find(p=>p.key===l.projectKey);
                        const usr=users.find(u=>u.key===l.userKey);
                        return (
                          <tr key={l.key||i} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-semibold">{fmtDate(l.date)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${l.type==='add'?'bg-green-100 text-green-700':l.type==='usage'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>
                                {l.type==='add'?'Stock In':l.type==='usage'?'Usage':'Adjust'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-black text-gray-800">{l.qty} {trendProduct.unit}</td>
                            <td className="px-4 py-2.5 text-gray-600">{proj?.name||'-'}</td>
                            <td className="px-4 py-2.5 text-gray-600">{usr?.name||(l.entryType==='admin_adjustment'?'Admin':'-')}</td>
                            <td className="px-4 py-2.5"><code className="bg-gray-100 text-xs px-2 py-0.5 rounded">{l.batchNo||'-'}</code></td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">{l.notes||'-'}</td>
                          </tr>
                        );
                      })}
                      {stockLogs.filter(l=>l.productKey===trendProduct.key).length===0 && (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No transactions recorded</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!selProductTrend && (
            /* All products usage comparison */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h5 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-700"/>All Products – Usage Comparison ({filterMonth})</h5>
              {usageByProduct.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageByProduct} layout="vertical" margin={{left:20,right:20}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:10}}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110}/>
                    <Tooltip/>
                    <Legend/>
                    <Bar dataKey="usage" name="Used" fill="#fd7e14" radius={[0,4,4,0]}/>
                    <Bar dataKey="received" name="Stock In" fill="#28a745" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Select a product above or add usage records for {filterMonth}</div>}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isAdmin && (
        <>
          <ProductModal show={showProductModal} onClose={()=>{setShowProductModal(false);setEditingProduct(null);}} editing={editingProduct} onSave={onSaveProduct} toast={toast}/>
          {adjustProduct && <StockAdjustModal show={showAdjustModal} onClose={()=>{setShowAdjustModal(false);setAdjustProduct(null);}} product={adjustProduct} onSave={onSaveStockLog} toast={toast}/>}
        </>
      )}
      {isPCO && <UsageModal show={showUsageModal} onClose={()=>setShowUsageModal(false)} products={productsWithStock} projects={projects} cu={cu} onSave={onSaveStockLog} toast={toast}/>}

      {/* Print Report (hidden on screen) */}
      <InventoryPrintReport products={productsWithStock} stockLogs={stockLogs} users={users} projects={projects} filterMonth={filterMonth}/>
    </div>
  );
}
