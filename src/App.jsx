import React, { useState } from 'react';
import { 
  Users, Shield, Search, Calendar, Settings, LogIn, LogOut, 
  Home, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';

// --- INITIAL DUMMY DATA ---
const INITIAL_STUDENTS = [
  { id: 'SB20260001', name: 'NUR AINA BINTI ZULKIFLI', year: '5', class: '5 Bestari', gender: 'P', status: 'Active', guardian: 'Zulkifli Ahmad', phone: '012-3456789', qr_token: 'STU-2026-0001' },
  { id: 'SB20260002', name: 'AHMAD ZIKRI BIN HASSAN', year: '5', class: '5 Bestari', gender: 'L', status: 'Active', guardian: 'Hassan Basri', phone: '013-9876543', qr_token: 'STU-2026-0002' },
  { id: 'SB20260003', name: 'MUHAMMAD DANIAL BIN FARID', year: '4', class: '4 Cemerlang', gender: 'L', status: 'Active', guardian: 'Farid Kamil', phone: '017-1122334', qr_token: 'STU-2026-0003' },
  { id: 'SB20260004', name: 'SITI NURHALIZA BINTI AMIR', year: '4', class: '4 Cemerlang', gender: 'P', status: 'Active', guardian: 'Amir Hamzah', phone: '019-8877665', qr_token: 'STU-2026-0004' }
];

const INITIAL_ATTENDANCE = [
  { student_id: 'SB20260001', date: '2026-10-05', status: 'Hadir', method: 'QR' },
  { student_id: 'SB20260002', date: '2026-10-05', status: 'Tidak Hadir', method: 'Manual' },
  { student_id: 'SB20260003', date: '2026-10-05', status: 'Bersebab', method: 'Manual' }
];

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Selected Class for Manual Attendance
  const [selectedClass, setSelectedClass] = useState('5 Bestari');

  // Google Sheets Live Sync State
  const [sheetUrl, setSheetUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState({ loading: false, success: null, message: '' });

  // CSV Parser Helper
  // Updated CSV Parser Helper with Header Detection
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 1) return [];

    const parsedStudents = [];

    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"\vert{}"$/g, ''));
      
      // Skip empty or shifted lines
      const cleanValues = values.filter(v => v !== '');
      if (cleanValues.length < 2) continue;

      const firstCol = cleanValues[0] || '';
      const secondCol = cleanValues[1] || '';

      // Skip row if it contains header keywords like "No ID", "ID", or "Nama Murid"
      if (
        firstCol.toLowerCase().includes('no id') || 
        firstCol.toLowerCase().includes('id murid') ||
        secondCol.toLowerCase().includes('nama murid')
      ) {
        continue;
      }

      parsedStudents.push({
        id: cleanValues[0] || `SB2026${String(i).padStart(4, '0')}`,
        name: cleanValues[1] || 'TANPA NAMA',
        gender: cleanValues[2] || 'L',
        year: cleanValues[3] || '1',
        class: cleanValues[4] || '1 Bestari',
        guardian: cleanValues[5] || '-',
        phone: cleanValues[6] || '-',
        status: 'Active',
        qr_token: `STU-2026-${String(i).padStart(4, '0')}`
      });
    }
    return parsedStudents;
  };

  // Live Sync Function
  const handleGoogleSheetsSync = async () => {
    if (!sheetUrl.trim()) {
      setSyncStatus({ loading: false, success: false, message: 'Sila masukkan pautan terbitan CSV Google Sheets terlebih dahulu.' });
      return;
    }

    if (!sheetUrl.includes('output=csv')) {
      setSyncStatus({ 
        loading: false, 
        success: false, 
        message: 'Pautan tidak sah! Pastikan pautan tamat dengan "output=csv" (File -> Share -> Publish to Web -> Choose CSV).' 
      });
      return;
    }

    setSyncStatus({ loading: true, success: null, message: 'Memuat turun data dari Google Sheets...' });

    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error('Gagal memuat turun fail CSV.');
      const csvData = await response.text();
      
      const importedStudents = parseCSV(csvData);
      
      if (importedStudents.length === 0) {
        setSyncStatus({ loading: false, success: false, message: 'Tiada rekod murid ditemui dalam helaian Google Sheets tersebut.' });
      } else {
        setStudents(importedStudents);
        setSyncStatus({ 
          loading: false, 
          success: true, 
          message: `Berjaya! ${importedStudents.length} rekod murid telah dikemaskini dari Google Sheets.` 
        });
      }
    } catch (err) {
      setSyncStatus({ 
        loading: false, 
        success: false, 
        message: 'Ralat semasa sambungan. Pastikan helaian Google Sheets telah di-Publish to Web sebagai CSV.' 
      });
    }
  };

  // Login Handler
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminId === 'adminsksb' && adminPass === 'yba3410') {
      setIsAdmin(true);
      setShowLoginModal(false);
      setAdminId('');
      setAdminPass('');
      setLoginError('');
    } else {
      setLoginError('ID atau kata laluan tidak sah!');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setActiveTab('dashboard');
  };

  // Attendance Toggle
  const toggleAttendance = (studentId, status) => {
    const today = '2026-10-05';
    setAttendance(prev => {
      const filtered = prev.filter(a => !(a.student_id === studentId && a.date === today));
      return [...filtered, { student_id: studentId, date: today, status, method: 'Manual' }];
    });
  };

  const markAllPresent = () => {
    const today = '2026-10-05';
    const classStudents = students.filter(s => s.class === selectedClass);
    const updated = classStudents.map(s => ({
      student_id: s.id,
      date: today,
      status: 'Hadir',
      method: 'Manual'
    }));
    setAttendance(prev => {
      const rest = prev.filter(a => !classStudents.some(cs => cs.id === a.student_id && a.date === today));
      return [...rest, ...updated];
    });
  };

  // Dynamic Class Options List based on current students
  const availableClasses = Array.from(new Set(students.map(s => s.class)));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">SK SUNGAI BAYAN</h1>
            <p className="text-xs text-slate-400">System e-Hadir & Sahsiah Murid</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin ? (
            <div className="flex items-center space-x-3">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 font-medium">
                Pentadbir Sistem (Admin)
              </span>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Keluar</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Log Masuk Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Home className="w-4 h-4" />
            <span>Papan Pemuka</span>
          </button>

          <button 
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kehadiran Kelas</span>
          </button>

          <button 
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'students' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Users className="w-4 h-4" />
            <span>Direktori Murid ({students.length})</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Hub Pentadbir</span>
            </button>
          )}
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-6 max-w-7xl">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800">Ringkasan Kehadiran Hari Ini</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Murid</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{students.length}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hadir</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {attendance.filter(a => a.status === 'Hadir').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tidak Hadir</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {attendance.filter(a => a.status === 'Tidak Hadir').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bersebab</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {attendance.filter(a => a.status === 'Bersebab').length}
                  </p>
                </div>
              </div>

              {/* Student Quick List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Senarai Ringkas Murid</h3>
                  <button onClick={() => setActiveTab('students')} className="text-xs text-blue-600 font-medium hover:underline">Lihat Semua</button>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {students.map(s => {
                    const att = attendance.find(a => a.student_id === s.id);
                    return (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.id} • Kelas: {s.class}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          att?.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                          att?.status === 'Tidak Hadir' ? 'bg-red-100 text-red-800' :
                          att?.status === 'Bersebab' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {att ? att.status : 'Belum Rekod'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CLASS ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Kehadiran Kelas Manual</h2>
                  <p className="text-sm text-slate-500">Pilih kelas untuk kemaskini status kehadiran murid hari ini.</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <select 
                    value={selectedClass} 
                    onChange={e => setSelectedClass(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <button 
                    onClick={markAllPresent}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                  >
                    Tanda Semua Hadir
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Murid</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3 text-center">Status Kehadiran Hari Ini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.filter(s => s.class === selectedClass).map(s => {
                      const att = attendance.find(a => a.student_id === s.id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-400">{s.id}</p>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{s.class}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center space-x-2">
                              <button 
                                onClick={() => toggleAttendance(s.id, 'Hadir')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${att?.status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'}`}
                              >
                                Hadir
                              </button>
                              <button 
                                onClick={() => toggleAttendance(s.id, 'Tidak Hadir')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${att?.status === 'Tidak Hadir' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-red-50'}`}
                              >
                                Tidak Hadir
                              </button>
                              <button 
                                onClick={() => toggleAttendance(s.id, 'Bersebab')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${att?.status === 'Bersebab' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-purple-50'}`}
                              >
                                Bersebab
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STUDENTS DIRECTORY TAB */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Direktori Murid ({students.length})</h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari nama / ID murid..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery)).map(s => (
                  <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">{s.name}</h3>
                        <p className="text-xs text-blue-600 font-semibold">{s.id} • Kelas {s.class}</p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        Jantina: {s.gender}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p><span className="font-semibold text-slate-700">Waris:</span> {s.guardian}</p>
                      <p><span className="font-semibold text-slate-700">Telefon:</span> {s.phone}</p>
                      <p><span className="font-semibold text-slate-700">QR Identity:</span> {s.qr_token}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN HUB TAB */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6">
              <div className="bg-purple-900 text-white p-6 rounded-2xl shadow-md">
                <h2 className="text-2xl font-bold">Hub Pentadbir Sistem (Admin)</h2>
                <p className="text-purple-200 text-sm mt-1">Akses penuh pengurusan data murid, tetapan sekolah, dan selenggara rekod.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-lg">Google Sheets Live Sync</h3>
                <p className="text-sm text-slate-600">
                  Tampal pautan <strong>Publish to Web (CSV)</strong> Google Sheets anda di bawah untuk menarik rekod murid terkini secara automatik.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button 
                    onClick={handleGoogleSheetsSync}
                    disabled={syncStatus.loading}
                    className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncStatus.loading ? 'animate-spin' : ''}`} />
                    <span>{syncStatus.loading ? 'Sedang Sync...' : 'Sync Sekarang'}</span>
                  </button>
                </div>

                {/* Sync Feedback Message */}
                {syncStatus.message && (
                  <div className={`p-4 rounded-lg text-xs font-medium flex items-center space-x-2 ${
                    syncStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {syncStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                    <span>{syncStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ADMIN LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Log Masuk Pentadbir</h3>
              <p className="text-xs text-slate-500">Masukkan ID dan kata laluan khas Admin sekolah.</p>
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 font-medium text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ID Pengguna</label>
                <input 
                  type="text" 
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  placeholder="adminsksb"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kata Laluan</label>
                <input 
                  type="password" 
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                >
                  Log Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}