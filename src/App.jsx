import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Shield, Search, Calendar, Settings, LogIn, LogOut, 
  Home, RefreshCw, CheckCircle2, AlertCircle, QrCode, Camera, Flashlight, Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// --- INITIAL DUMMY DATA ---
const INITIAL_STUDENTS = [
  { id: 'SB20260001', name: 'NUR AINA BINTI ZULKIFLI', year: '5', class: '5 Bestari', gender: 'P', status: 'Active', guardian: 'Zulkifli Ahmad', phone: '012-3456789', qr_token: 'STU-2026-0001' },
  { id: 'SB20260002', name: 'AHMAD ZIKRI BIN HASSAN', year: '5', class: '5 Bestari', gender: 'L', status: 'Active', guardian: 'Hassan Basri', phone: '013-9876543', qr_token: 'STU-2026-0002' },
  { id: 'SB20260003', name: 'MUHAMMAD DANIAL BIN FARID', year: '4', class: '4 Cemerlang', gender: 'L', status: 'Active', guardian: 'Farid Kamil', phone: '017-1122334', qr_token: 'STU-2026-0003' },
  { id: 'SB20260004', name: 'SITI NURHALIZA BINTI AMIR', year: '4', class: '4 Cemerlang', gender: 'P', status: 'Active', guardian: 'Amir Hamzah', phone: '019-8877665', qr_token: 'STU-2026-0004' }
];

const INITIAL_ATTENDANCE = [
  { student_id: 'SB20260001', date: '2026-10-06', status: 'Hadir', method: 'QR', time: '07:15 AM' },
  { student_id: 'SB20260002', date: '2026-10-06', status: 'Tidak Hadir', method: 'Manual', time: '-' }
];

// CSV Parser Helper Function
const parseCSV = (csvText) => {
  if (!csvText) return [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (lines.length < 1) return [];

  const parsedStudents = [];

  for (let i = 0; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"\vert{}"$/g, ''));
    
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

    parsedStudents.push({
      id: cleanValues[0] || `SB2026${String(i).padStart(4, '0')}`,
      name: cleanValues[1] || 'TANPA NAMA',
      gender: cleanValues[2] || 'L',
      year: cleanValues[3] || '1',
      class: cleanValues[4] || '1 Bestari',
      guardian: cleanValues[5] || '-',
      phone: cleanValues[6] || '-',
      status: 'Active',
      qr_token: cleanValues[0] || `SB2026${String(i).padStart(4, '0')}`
    });
  }
  return parsedStudents;
};

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [selectedClass, setSelectedClass] = useState('1 FAJAR');
  const [syncStatus, setSyncStatus] = useState({ loading: false, success: null, message: '' });

  // --- QR SCANNER STATES & REFS ---
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedStudent, setLastScannedStudent] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);
  const html5QrCodeRef = useRef(null);

  // Auto Sync dari Google Sheets apabila web dibuka
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

  // --- QR SCANNER LOGIC ---
  const startScanner = async () => {
    setIsScanning(true);
    setScanFeedback(null);

    setTimeout(async () => {
      try {
        const qrCodeScanner = new Html5Qrcode("reader");
        html5QrCodeRef.current = qrCodeScanner;

        await qrCodeScanner.start(
          { facingMode: "environment" }, // Kamera belakang
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleQrCodeScanned(decodedText);
          },
          (errorMessage) => {
            // Ignore frame scan errors
          }
        );
      } catch (err) {
        console.error("Camera access error:", err);
        setScanFeedback({ type: 'error', message: 'Gagal mengakses kamera. Pastikan kebenaran kamera dibenarkan.' });
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner", err);
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Handle scanned QR Data
  const handleQrCodeScanned = (scannedText) => {
    const today = '2026-10-06';
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Cari murid berdasarkan ID atau QR Token
    const student = students.find(s => 
      s.id.toLowerCase() === scannedText.toLowerCase() || 
      s.qr_token.toLowerCase() === scannedText.toLowerCase()
    );

    if (student) {
      setLastScannedStudent(student);
      
      // Kemaskini kehadiran murid
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.student_id === student.id && a.date === today));
        return [...filtered, { 
          student_id: student.id, 
          date: today, 
          status: 'Hadir', 
          method: 'QR', 
          time: currentTime 
        }];
      });

      setScanFeedback({ 
        type: 'success', 
        message: `Hadir: ${student.name} (${student.class}) pada ${currentTime}` 
      });
    } else {
      setScanFeedback({ 
        type: 'error', 
        message: `Kod QR tidak dikenali: "${scannedText}"` 
      });
    }
  };

  // Live Sync Manual
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
    const today = '2026-10-06';
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setAttendance(prev => {
      const filtered = prev.filter(a => !(a.student_id === studentId && a.date === today));
      return [...filtered, { student_id: studentId, date: today, status, method: 'Manual', time: currentTime }];
    });
  };

  const markAllPresent = () => {
    const today = '2026-10-06';
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const classStudents = students.filter(s => s.class === selectedClass);
    const updated = classStudents.map(s => ({
      student_id: s.id,
      date: today,
      status: 'Hadir',
      method: 'Manual',
      time: currentTime
    }));
    setAttendance(prev => {
      const rest = prev.filter(a => !classStudents.some(cs => cs.id === a.student_id && a.date === today));
      return [...rest, ...updated];
    });
  };

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
            onClick={() => { stopScanner(); setActiveTab('dashboard'); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Home className="w-4 h-4" />
            <span>Papan Pemuka</span>
          </button>

          <button 
            onClick={() => { stopScanner(); setActiveTab('qr-scanner'); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'qr-scanner' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <QrCode className="w-4 h-4 text-blue-600" />
            <span>Imbas QR (Kamera)</span>
          </button>

          <button 
            onClick={() => { stopScanner(); setActiveTab('attendance'); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kehadiran Kelas</span>
          </button>

          <button 
            onClick={() => { stopScanner(); setActiveTab('students'); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'students' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Users className="w-4 h-4" />
            <span>Direktori Murid ({students.length})</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => { stopScanner(); setActiveTab('admin'); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Hub Pentadbir</span>
            </button>
          )}
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-6 max-w-7xl">
          {/* QR SCANNER TAB */}
          {activeTab === 'qr-scanner' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="text-left">
                    <h2 className="text-lg font-bold text-slate-800">Pengimbas QR Kehadiran</h2>
                    <p className="text-xs text-slate-500">Halakan kamera telefon / peranti ke Kod QR Kad Murid.</p>
                  </div>

                  {!isScanning ? (
                    <button 
                      onClick={startScanner}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center space-x-2 transition shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Buka Kamera</span>
                    </button>
                  ) : (
                    <button 
                      onClick={stopScanner}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center space-x-2 transition shadow-sm"
                    >
                      <span>Tutup Kamera</span>
                    </button>
                  )}
                </div>

                {/* Scanner Container */}
                <div className="relative bg-slate-900 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center border border-slate-800">
                  <div id="reader" className="w-full h-full"></div>
                  
                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-900/90 text-white">
                      <QrCode className="w-16 h-16 text-blue-400 animate-pulse" />
                      <p className="text-sm font-medium">Kamera Belum Diaktifkan</p>
                      <p className="text-xs text-slate-400 max-w-xs">Tekan butang "Buka Kamera" di atas untuk mula mengimbas kehadiran murid.</p>
                    </div>
                  )}
                </div>

                {/* Scan Feedback Status */}