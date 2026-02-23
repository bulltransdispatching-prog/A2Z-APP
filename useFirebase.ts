// @ts-nocheck
import { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove, set } from 'firebase/database';
import { db } from '../firebase';

export function useFirebase() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [customForms, setCustomForms] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let loadedCount = 0;
    const totalRefs = 7;
    const checkLoaded = () => { loadedCount++; if (loadedCount >= totalRefs) setLoading(false); };

    const parseSnap = (snap) => {
      const list = [];
      snap.forEach(child => { list.push({ key: child.key, ...child.val() }); return false; });
      return list;
    };

    const unsub1 = onValue(ref(db, 'users'),       snap => { setUsers(parseSnap(snap));       checkLoaded(); }, () => checkLoaded());
    const unsub2 = onValue(ref(db, 'projects'),    snap => { setProjects(parseSnap(snap));    checkLoaded(); }, () => checkLoaded());
    const unsub3 = onValue(ref(db, 'records'),     snap => { setRecords(parseSnap(snap));     checkLoaded(); }, () => checkLoaded());
    const unsub4 = onValue(ref(db, 'remarks'),     snap => { setRemarks(parseSnap(snap));     checkLoaded(); }, () => checkLoaded());
    const unsub5 = onValue(ref(db, 'customForms'), snap => { setCustomForms(parseSnap(snap)); checkLoaded(); }, () => checkLoaded());
    const unsub6 = onValue(ref(db, 'products'),    snap => { setProducts(parseSnap(snap));    checkLoaded(); }, () => checkLoaded());
    const unsub7 = onValue(ref(db, 'stockLogs'),   snap => { setStockLogs(parseSnap(snap));   checkLoaded(); }, () => checkLoaded());

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
  }, []);

  // ── Users ──────────────────────────────────────────────────────────
  const saveUser = async (data, key) => {
    if (key) await update(ref(db, `users/${key}`), { ...data, updatedAt: Date.now() });
    else await push(ref(db, 'users'), { ...data, createdAt: Date.now() });
  };
  const deleteUser = async (key) => remove(ref(db, `users/${key}`));

  // ── Projects ───────────────────────────────────────────────────────
  const saveProject = async (data, key) => {
    if (key) await update(ref(db, `projects/${key}`), { ...data, updatedAt: Date.now() });
    else await push(ref(db, 'projects'), { ...data, createdAt: Date.now() });
  };
  const deleteProject = async (key) => remove(ref(db, `projects/${key}`));

  // ── Records ────────────────────────────────────────────────────────
  const saveRecord = async (data) => push(ref(db, 'records'), { ...data, createdAt: Date.now() });
  const deleteRecord = async (key) => remove(ref(db, `records/${key}`));

  // ── Remarks ────────────────────────────────────────────────────────
  const saveRemark = async (data) => push(ref(db, 'remarks'), { ...data, createdAt: Date.now() });
  const deleteRemark = async (key) => remove(ref(db, `remarks/${key}`));

  // ── Custom Forms ───────────────────────────────────────────────────
  const saveCustomForm = async (data, key) => {
    if (key) await update(ref(db, `customForms/${key}`), { ...data, updatedAt: Date.now() });
    else await push(ref(db, 'customForms'), { ...data, createdAt: Date.now() });
  };
  const deleteCustomForm = async (key) => remove(ref(db, `customForms/${key}`));

  // ── Inventory Products ─────────────────────────────────────────────
  const saveProduct = async (data, key) => {
    const payload = { ...data, updatedAt: Date.now() };
    if (key) {
      // editing: don't overwrite openingStock
      delete payload.openingStock;
      await update(ref(db, `products/${key}`), payload);
    } else {
      payload.createdAt = Date.now();
      await push(ref(db, 'products'), payload);
    }
  };
  const deleteProduct = async (key) => {
    // Also remove all stock logs for this product
    await remove(ref(db, `products/${key}`));
    const logsToDelete = stockLogs.filter(l => l.productKey === key);
    await Promise.all(logsToDelete.map(l => remove(ref(db, `stockLogs/${l.key}`))));
  };

  // ── Stock Logs ─────────────────────────────────────────────────────
  // Each entry: { productKey, type:'add'|'usage'|'adjust', qty, date, batchNo, supplier, userKey, projectKey, notes, entryType, createdAt }
  const saveStockLog = async (data) => {
    await push(ref(db, 'stockLogs'), { ...data, createdAt: Date.now() });
  };
  const deleteStockLog = async (key) => remove(ref(db, `stockLogs/${key}`));

  // ── Ensure Admin ───────────────────────────────────────────────────
  const ensureAdmin = async (currentUsers) => {
    const adminExists = currentUsers.find(u => u.username === 'admin' && u.role === 'admin');
    if (!adminExists) {
      await set(ref(db, 'users/admin_default'), {
        empId: 'ADM001', name: 'Administrator', username: 'admin',
        password: 'admin123', role: 'admin', projects: [], active: true, createdAt: Date.now()
      });
    }
  };

  return {
    users, projects, records, remarks, customForms, products, stockLogs, loading,
    saveUser, deleteUser,
    saveProject, deleteProject,
    saveRecord, deleteRecord,
    saveRemark, deleteRemark,
    saveCustomForm, deleteCustomForm,
    saveProduct, deleteProduct,
    saveStockLog, deleteStockLog,
    ensureAdmin,
  };
}
