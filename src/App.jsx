import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Search, Calendar, Settings, LogIn, LogOut, 
  Home, RefreshCw, CheckCircle2, AlertCircle, QrCode, Camera, Printer, CreditCard, Save, BarChart3, ChevronRight
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// --- INITIAL DUMMY DATA ---
const INITIAL_STUDENTS = [
  { id: 'SB20260001', name: 'NUR AINA BINTI ZULKIFLI', year: '5', class: '5 Bestari', gender: 'P', status: 'Active', guardian: 'm-12345678@moe-dl.edu.my', phone: '012-3456789', qr_token: 'SB20260001' },
  { id: 'SB20260002', name: 'AHMAD ZIKRI BIN HASSAN', year: '5', class: '5 Bestari', gender: 'L', status: 'Active', guardian: 'm-87654321@moe-dl.edu.my', phone: '013-9876543', qr_token: 'SB20260002' }
];

const INITIAL_ATTENDANCE = [
  { student_id: 'SB20260001', date: '2026-10-06', status: 'Hadir', method: 'QR' },
  { student_id: 'SB20260002', date: '2026-10-06', status: 'Tidak Hadir', method: 'Manual' }
];

// CSV Parser Helper Function
const parseCSV = (csvText) => {
  if (!csvText) return [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (lines.length < 1) return [];

  const parsedStudents = [];

  for (let i = 0; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const cleanValues = values.filter(v => v !== '');
    if (cleanValues.length < 2) continue;

    const firstCol = cleanValues[0] || '';
    const secondCol = cleanValues[1] || '';

    if (
      firstCol.toLowerCase().includes('no id') || 
      firstCol.toLowerCase().includes('id murid') ||
      secondCol.toLowerCase().includes('nama murid')
    ) {
      continue;
    }

    const studentId = cleanValues[0] || `SB2026${String(i).padStart(4, '0')}`;

    parsedStudents.push({
      id: studentId,
      name: cleanValues[1] || 'TANPA NAMA',
      gender: (cleanValues[2] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L',
      year: cleanValues[3] || '1',
      class: cleanValues[4] || '1 FAJAR',
      guardian: cleanValues[5] || '-', 
      phone: cleanValues[6] || '-',
      status: 'Active',
      qr_token: studentId
    });
  }
  return parsedStudents;
};

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem('sksb_students');
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch (e) {
      return INITIAL_STUDENTS;
    }
  });

  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('sksb_sheet_url') || '';
  });

  const [attendance, setAttendance] = useState(() => {
    try {
      const saved = localStorage.getItem('sksb_attendance');
      return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
    } catch (e) {
      return INITIAL_ATTENDANCE;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [selectedClass, setSelectedClass] = useState('1 FAJAR');
  const [dashboardDetailClass, setDashboardDetailClass] = useState('');
  const [printClassFilter, setPrintClassFilter] = useState('Semua');
  const [syncStatus, setSyncStatus] = useState({ loading: false, success: null, message: '' });
  const [saveMessage, setSaveMessage] = useState('');

  const [scanResult, setScanResult] = useState(null);
  const [manualQrInput, setManualQrInput] = useState('');

  // Auto Sync
  useEffect(() => {
    const savedUrl = localStorage.getItem('sksb_sheet_url');
    if (savedUrl) {
      fetch(savedUrl)
        .then(res => res.text())
        .then(csvData => {
          const imported = parseCSV(csvData);
          if (imported.length > 0) {
            setStudents(imported);
            localStorage.setItem('sksb_students', JSON.stringify(imported));
          }
        })
        .catch(err => console.error("Auto sync error:", err));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sksb_attendance', JSON.stringify(attendance));
  }, [attendance]);

  // Tetapkan kelas terperinci lalai jika belum dipilih
  useEffect(() => {
    if (!dashboardDetailClass && availableClasses.length > 0) {
      setDashboardDetailClass(availableClasses[0]);
    }
  }, [students]);

  // QR Scanner Logic
  useEffect(() => {
    let scanner = null;
    if (activeTab === 'scan') {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
        },
        false
      );

      scanner.render(
        (decodedText) => {
          handleQrScanned(decodedText);
        },
        () => {}
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      }
    };
  }, [activeTab, students, selectedDate]);

  const handleQrScanned = (scannedCode) => {
    const cleanCode = scannedCode.trim();

    const foundStudent = students.find(s => 
      s.id.toLowerCase() === cleanCode.toLowerCase() || 
      s.qr_token.toLowerCase() === cleanCode.toLowerCase()
    );

    if (foundStudent) {
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.student_id === foundStudent.id && a.date === selectedDate));
        return [...filtered, { student_id: foundStudent.id, date: selectedDate, status: 'Hadir', method: 'QR Kamera' }];
      });

      setScanResult({
        success: true,
        student: foundStudent,
        message: `KEHADIRAN DIREKODKAN (${selectedDate}): ${foundStudent.name} (${foundStudent.class})`
      });
    } else {
      setScanResult({
        success: false,
        student: null,
        message: `KOD QR TIDAK DITEMUI: "${cleanCode}" tiada dalam senarai murid.`
      });
    }
  };

  const handleManualQrSubmit = (e) => {
    e.preventDefault();
    if (manualQrInput) {
      handleQrScanned(manualQrInput);
      setManualQrInput('');
    }
  };

  const handleGoogleSheetsSync = async () => {
    if (!sheetUrl.trim()) {
      setSyncStatus({ loading: false, success: false, message: 'Sila masukkan pautan terbitan CSV Google Sheets terlebih dahulu.' });
      return;
    }

    if (!sheetUrl.includes('output=csv')) {
      setSyncStatus({ 
        loading: false, 
        success: false, 
        message: 'Pautan tidak sah! Pastikan pautan tamat dengan "output=csv".' 
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
        localStorage.setItem('sksb_students', JSON.stringify(importedStudents));
        localStorage.setItem('sksb_sheet_url', sheetUrl);

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

  const toggleAttendance = (studentId, status) => {
    setAttendance(prev => {
      const filtered = prev.filter(a => !(a.student_id === studentId && a.date === selectedDate));
      return [...filtered, { student_id: studentId, date: selectedDate, status, method: 'Manual' }];
    });
  };

  const markAllPresent = () => {
    const classStudents = students.filter(s => s.class === selectedClass);
    const updated = classStudents.map(s => ({
      student_id: s.id,
      date: selectedDate,
      status: 'Hadir',
      method: 'Manual'
    }));
    setAttendance(prev => {
      const rest = prev.filter(a => !classStudents.some(cs => cs.id === a.student_id && a.date === selectedDate));
      return [...rest, ...updated];
    });
  };

  const handleSaveAttendance = () => {
    localStorage.setItem('sksb_attendance', JSON.stringify(attendance));
    setSaveMessage(`Rekod kehadiran kelas ${selectedClass} (${selectedDate}) telah disimpan!`);
    setTimeout(() => {
      setSaveMessage('');
    }, 4000);
  };

  const availableClasses = Array.from(new Set(students.map(s => s.class)));

  const printFilteredStudents = printClassFilter === 'Semua' 
    ? students 
    : students.filter(s => s.class === printClassFilter);

  const filteredAttendanceByDate = attendance.filter(a => a.date === selectedDate);

  // Kiraan Statistik Perincian Kelas Dashboard
  const getDetailedClassStats = (className) => {
    const classStudents = students.filter(s => s.class === className);
    const totalStudents = classStudents.length;

    let totalHadir = 0;
    let totalTidakHadir = 0;
    let totalBersebab = 0;

    let maleHadir = 0;
    let maleTidakHadir = 0;
    let maleBersebab = 0;
    let maleTotal = 0;

    let femaleHadir = 0;
    let femaleTidakHadir = 0;
    let femaleBersebab = 0;
    let femaleTotal = 0;

    classStudents.forEach(st => {
      const att = filteredAttendanceByDate.find(a => a.student_id === st.id);
      const isMale = st.gender === 'L';
      
      if (isMale) maleTotal++;
      else femaleTotal++;

      if (att?.status === 'Hadir') {
        totalHadir++;
        if (isMale) maleHadir++;
        else femaleHadir++;
      } else if (att?.status === 'Bersebab') {
        totalBersebab++;
        if (isMale) maleBersebab++;
        else femaleBersebab++;
      } else if (att?.status === 'Tidak Hadir') {
        totalTidakHadir++;
        if (isMale) maleTidakHadir++;
        else femaleTidakHadir++;
      }
    });

    const percent = totalStudents > 0 ? Math.round((totalHadir / totalStudents) * 100) : 0;

    return {
      totalStudents, totalHadir, totalTidakHadir, totalBersebab, percent,
      maleTotal, maleHadir, maleTidakHadir, maleBersebab,
      femaleTotal, femaleHadir, femaleTidakHadir, femaleBersebab
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .print-area { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; padding: 10px !important; }
          .id-card { page-break-inside: avoid; break-inside: avoid; border: 2px solid #1e293b !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md no-print">
        <div className="flex items-center space-x-3">
          <div className="bg-white/10 p-1 rounded-xl border border-white/20 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo SK Sungai Bayan" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
              }}
            />
            <Shield className="w-6 h-6 text-blue-400 hidden" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">SK SUNGAI BAYAN</h1>
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
        <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-1 no-print">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Home className="w-4 h-4" />
            <span>Papan Pemuka</span>
          </button>

          <button 
            onClick={() => setActiveTab('scan')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'scan' ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Imbas QR (Pintu Pagar)</span>
          </button>

          <button 
            onClick={() => setActiveTab('print')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'print' ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>Cetak Kad ID / QR</span>
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
          {/* DASHBOARD TAB WITH CHARTS AND DETAILED CLASS BREAKDOWN */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Ringkasan Kehadiran Keseluruhan</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Pantau statistik kehadiran harian dan pecahan lelaki/perempuan mengikut kelas.</p>
                </div>
                
                <div className="flex items-center space-x-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-sm">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-500">Tarikh:</span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="text-xs font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
                  />
                </div>
              </div>
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah Murid</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{students.length}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hadir</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {filteredAttendanceByDate.filter(a => a.status === 'Hadir').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tidak Hadir</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {filteredAttendanceByDate.filter(a => a.status === 'Tidak Hadir').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bersebab</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {filteredAttendanceByDate.filter(a => a.status === 'Bersebab').length}
                  </p>
                </div>
              </div>

              {/* OVERALL CHART & DETAILED BREAKDOWN SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* CARTA PERATUSAN KEHADIRAN MENGIKUT KELAS (OVERALL CHART) */}
                <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-slate-800 text-sm">Carta Kehadiran Mengikut Kelas ({selectedDate})</h3>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-medium">
                      Klik bar kelas untuk butiran
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {availableClasses.map(cName => {
                      const stats = getDetailedClassStats(cName);
                      const isSelected = dashboardDetailClass === cName;

                      return (
                        <div 
                          key={cName} 
                          onClick={() => setDashboardDetailClass(cName)}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            isSelected 
                              ? 'bg-blue-50/80 border-blue-400 shadow-xs' 
                              : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              <span>Kelas {cName}</span>
                              {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-600" />}
                            </span>
                            <span className="font-mono font-bold text-slate-700">
                              {stats.totalHadir} / {stats.totalStudents} ({stats.percent}%)
                            </span>
                          </div>

                          {/* Visual Bar Chart */}
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-500" 
                              style={{ width: `${stats.percent}%` }}
                            ></div>
                            <div 
                              className="bg-red-400 h-full transition-all duration-500" 
                              style={{ width: `${100 - stats.percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* MAKLUMAT TERPERINCI KELAS YANG DIPILIH (LELAKI & PEREMPUAN) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Maklumat Terperinci</p>
                        <h3 className="font-black text-slate-900 text-lg">Kelas {dashboardDetailClass || 'Pilihan'}</h3>
                      </div>

                      <select 
                        value={dashboardDetailClass} 
                        onChange={e => setDashboardDetailClass(e.target.value)}
                        className="bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 rounded-lg px-2.5 py-1.5 outline-none"
                      >
                        {availableClasses.map(c => (
                          <option key={c} value={c}>Kelas {c}</option>
                        ))}
                      </select>
                    </div>

                    {dashboardDetailClass && (() => {
                      const detail = getDetailedClassStats(dashboardDetailClass);
                      return (
                        <div className="mt-4 space-y-4">
                          
                          {/* JANTINA: LELAKI */}
                          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-blue-900 uppercase tracking-wide">Lelaki (L)</span>
                              <span className="text-xs font-bold bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
                                Jumlah: {detail.maleTotal}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Hadir</p>
                                <p className="text-base font-bold text-emerald-600">{detail.maleHadir}</p>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Tidak Hadir / Bersebab</p>
                                <p className="text-base font-bold text-red-600">{detail.maleTidakHadir + detail.maleBersebab}</p>
                              </div>
                            </div>
                          </div>

                          {/* JANTINA: PEREMPUAN */}
                          <div className="bg-pink-50/60 p-4 rounded-xl border border-pink-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-pink-900 uppercase tracking-wide">Perempuan (P)</span>
                              <span className="text-xs font-bold bg-pink-200/80 text-pink-900 px-2 py-0.5 rounded-full">
                                Jumlah: {detail.femaleTotal}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div className="bg-white p-2.5 rounded-lg border border-pink-100">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Hadir</p>
                                <p className="text-base font-bold text-emerald-600">{detail.femaleHadir}</p>
                              </div>
                              <div className="bg-white p-2.5 rounded-lg border border-pink-100">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Tidak Hadir / Bersebab</p>
                                <p className="text-base font-bold text-red-600">{detail.femaleTidakHadir + detail.femaleBersebab}</p>
                              </div>
                            </div>
                          </div>

                          {/* KESELURAHAN KELAS */}
                          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">Peratusan Kehadiran Kelas</span>
                              <span className="font-bold text-emerald-400 text-sm">{detail.percent}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {detail.totalHadir} murid hadir daripada {detail.totalStudents} murid berdaftar.
                            </p>
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>

              {/* Student Quick List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Senarai Ringkas Kehadiran ({selectedDate})</h3>
                  <button onClick={() => setActiveTab('students')} className="text-xs text-blue-600 font-medium hover:underline">Lihat Semua</button>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {students.map(s => {
                    const att = attendance.find(a => a.student_id === s.id && a.date === selectedDate);
                    return (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.id} • Kelas: {s.class} ({s.gender})</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            att?.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            att?.status === 'Tidak Hadir' ? 'bg-red-100 text-red-800' :
                            att?.status === 'Bersebab' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {att ? att.status : 'Belum Rekod'}
                          </span>
                          {att?.method && <p className="text-[10px] text-slate-400 mt-0.5">{att.method}</p>}
                        </div>
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
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Kehadiran Kelas Manual</h2>
                  <p className="text-sm text-slate-500">Pilih kelas dan tarikh untuk semakan atau kemaskini kehadiran.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-sm">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="text-xs font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
                    />
                  </div>

                  <select 
                    value={selectedClass} 
                    onChange={e => setSelectedClass(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 outline-none shadow-sm"
                  >
                    {availableClasses.map(c => (
                      <option key={c} value={c}>Kelas {c}</option>
                    ))}
                  </select>

                  <button 
                    onClick={markAllPresent}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition border border-slate-300"
                  >
                    Tanda Semua Hadir
                  </button>

                  <button 
                    onClick={handleSaveAttendance}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Rekod</span>
                  </button>
                </div>
              </div>

              {saveMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Murid</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3 text-center">Status Kehadiran ({selectedDate})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.filter(s => s.class === selectedClass).map(s => {
                      const att = attendance.find(a => a.student_id === s.id && a.date === selectedDate);
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

          {/* TAB CETAK KAD ID / QR MURID */}
          {activeTab === 'print' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print bg-indigo-900 text-white p-6 rounded-2xl shadow-md">
                <div>
                  <h2 className="text-2xl font-bold">Penjana Kad Matrik & QR Murid</h2>
                  <p className="text-indigo-200 text-xs mt-1">Cetak Kad ID murid bertema SK Sungai Bayan lengkap dengan Kod QR yang sedia diimbas.</p>
                </div>

                <div className="flex items-center space-x-3">
                  <select 
                    value={printClassFilter} 
                    onChange={e => setPrintClassFilter(e.target.value)}
                    className="bg-white text-slate-900 text-xs font-semibold px-3 py-2 rounded-lg outline-none"
                  >
                    <option value="Semua">Semua Kelas ({students.length})</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>Kelas {c}</option>
                    ))}
                  </select>

                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Kad ID (A4)</span>
                  </button>
                </div>
              </div>

              {/* ID CARDS GRID CONTAINER */}
              <div className="print-area grid grid-cols-1 md:grid-cols-2 gap-6">
                {printFilteredStudents.map(s => {
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(s.id)}`;
                  
                  return (
                    <div 
                      key={s.id} 
                      className="id-card bg-white rounded-2xl border-2 border-slate-800 shadow-md overflow-hidden flex flex-col justify-between relative"
                      style={{ minHeight: '230px' }}
                    >
                      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white px-4 py-3 flex items-center justify-between border-b-2 border-amber-400">
                        <div className="flex items-center space-x-2">
                          <img 
                            src="/logo.png" 
                            alt="SK Sungai Bayan" 
                            className="w-7 h-7 object-contain bg-white/10 rounded p-0.5"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div>
                            <h3 className="font-extrabold text-xs tracking-wider leading-tight text-amber-300">SK SUNGAI BAYAN</h3>
                            <p className="text-[9px] text-slate-300 tracking-tight">KAD MATRIK & KEHADIRAN MURID</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black tracking-widest">
                          2026
                        </span>
                      </div>

                      <div className="p-4 flex items-center justify-between gap-3 bg-slate-50/50 flex-1">
                        <div className="space-y-1.5 flex-1">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nama Murid</p>
                            <h4 className="font-black text-slate-900 text-sm leading-tight uppercase">{s.name}</h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded border border-blue-300">
                              ID: {s.id}
                            </span>
                            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-300">
                              KELAS: {s.class}
                            </span>
                          </div>

                          <div className="pt-1 text-[10px] text-slate-600 space-y-0.5 border-t border-slate-200">
                            <p className="truncate max-w-[200px]">
                              <span className="font-bold text-slate-800">Emel DELIMA:</span> {s.guardian}
                            </p>
                            <p><span className="font-bold text-slate-800">No. Tel:</span> {s.phone}</p>
                          </div>
                        </div>

                        <div className="bg-white p-2 rounded-xl border-2 border-slate-300 shadow-sm text-center flex flex-col items-center justify-center flex-shrink-0">
                          <img 
                            src={qrUrl} 
                            alt={`QR ${s.id}`} 
                            className="w-24 h-24 object-contain rounded"
                          />
                          <p className="text-[8px] font-mono font-bold text-slate-500 mt-1">{s.id}</p>
                        </div>
                      </div>

                      <div className="bg-slate-900 px-4 py-1 flex items-center justify-between text-[8px] text-slate-400">
                        <span>Kad ID Rasmi Sekolah SK Sungai Bayan</span>
                        <span className="font-mono text-amber-400">E-HADIR DIGITAL</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCAN QR TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-md text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-400/30">
                  <Camera className="w-6 h-6 text-emerald-300" />
                </div>
                <h2 className="text-2xl font-bold">Pengimbas Kehadiran Pintu Pagar</h2>
                <p className="text-emerald-200 text-xs mt-1">Tarikh Imbasan: <strong>{selectedDate}</strong></p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden border-2 border-dashed border-slate-300"></div>

                <form onSubmit={handleManualQrSubmit} className="flex gap-2 pt-2">
                  <input 
                    type="text" 
                    value={manualQrInput}
                    onChange={e => setManualQrInput(e.target.value)}
                    placeholder="Atau taip No ID murid secara manual..."
                    className="flex-1 px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
                    Tanda Hadir
                  </button>
                </form>
              </div>

              {scanResult && (
                <div className={`p-5 rounded-2xl border shadow-md transition-all ${
                  scanResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
                }`}>
                  <div className="flex items-start space-x-3">
                    {scanResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-base">{scanResult.success ? 'BERJAYA IMBAS' : 'RALAT IMBASAN'}</h4>
                      <p className="text-sm mt-1">{scanResult.message}</p>
                      {scanResult.student && (
                        <div className="mt-3 bg-white/80 p-3 rounded-lg border border-emerald-200 text-xs space-y-1 text-slate-700">
                          <p><span className="font-semibold">Nama:</span> {scanResult.student.name}</p>
                          <p><span className="font-semibold">Kelas:</span> {scanResult.student.class}</p>
                          <p><span className="font-semibold">Emel DELIMA:</span> {scanResult.student.guardian}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                      <p className="truncate"><span className="font-semibold text-slate-700">Emel DELIMA:</span> {s.guardian}</p>
                      <p><span className="font-semibold text-slate-700">No. Tel:</span> {s.phone}</p>
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