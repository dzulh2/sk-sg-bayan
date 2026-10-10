import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Search, Calendar, Settings, LogIn, LogOut, 
  Home, RefreshCw, CheckCircle2, AlertCircle, QrCode, Camera, Printer, 
  CreditCard, Save, BarChart3, ChevronRight, UserX, Percent, Trophy, AlertTriangle, Award,
  Maximize2, Minimize2, RotateCcw, Clock
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQfGF2_35Fp9ySTksLZmsE8azknMV1IhkqTHXYji6JMvCEHA4L6rTQhMjvSsL_XtkP8JpIDU1KKOJ7J/pub?output=csv"; 
const ATTENDANCE_API_URL = "https://script.google.com/macros/s/AKfycbwp21xM60fM1C9a8DCYC2o3ar10-NvYHWTFoWWddOOij4ssLLjbbcSTJHIG-Rj-0Ifq/exec"; 

const INITIAL_STUDENTS = [
  { id: 'SB20260001', name: 'NUR AINA BINTI ZULKIFLI', year: '5', class: '5 Bestari', gender: 'P', status: 'Active', guardian: 'm-12345678@moe-dl.edu.my', phone: '012-3456789', qr_token: 'SB20260001' },
  { id: 'SB20260002', name: 'AHMAD ZIKRI BIN HASSAN', year: '5', class: '5 Bestari', gender: 'L', status: 'Active', guardian: 'm-87654321@moe-dl.edu.my', phone: '013-9876543', qr_token: 'SB20260002' },
  { id: 'SB20260003', name: 'ADELLSON GANING ANAK JEMMY', year: '1', class: '1 FAJAR', gender: 'L', status: 'Active', guardian: 'm-11223344@moe-dl.edu.my', phone: '014-1234567', qr_token: 'SB20260003' },
  { id: 'SB20260004', name: 'AIRENparser ANTA WONG', year: '1', class: '1 FAJAR', gender: 'P', status: 'Active', guardian: 'm-55667788@moe-dl.edu.my', phone: '015-9876543', qr_token: 'SB20260004' }
];

const INITIAL_ATTENDANCE = [
  { student_id: 'SB20260001', date: '2026-10-10', status: 'Hadir', method: 'QR' },
  { student_id: 'SB20260002', date: '2026-10-10', status: 'Tidak Hadir', method: 'Manual' },
  { student_id: 'SB20260003', date: '2026-10-10', status: 'Hadir', method: 'QR' },
  { student_id: 'SB20260004', date: '2026-10-10', status: 'Bersebab', method: 'Manual' }
];

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

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

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return today.getMonth();
  });

  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('sksb_sheet_url') || DEFAULT_SHEET_URL;
  });

  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem('sksb_students');
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch (e) {
      return INITIAL_STUDENTS;
    }
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
  const [dashboardDetailClass, setDashboardDetailClass] = useState('Semua Kelas');
  const [printClassFilter, setPrintClassFilter] = useState('Semua');
  const [certFilterClass, setCertFilterClass] = useState('Semua');
  const [printSubTab, setPrintSubTab] = useState('cards');

  // Fullscreen Display & Rotation Controls
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [fullscreenScreenView, setFullscreenScreenView] = useState(0); // 0 = Summary & Leaderboard, 1 = Class % Breakdown
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date());

  const [syncStatus, setSyncStatus] = useState({ loading: false, success: null, message: '' });
  const [saveMessage, setSaveMessage] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const [scanResult, setScanResult] = useState(null);
  const [manualQrInput, setManualQrInput] = useState('');

  const availableClasses = Array.from(new Set(students.map(s => s.class)));

  // Auto Sync Data Murid
  useEffect(() => {
    const activeUrl = sheetUrl.includes('output=csv') ? sheetUrl : DEFAULT_SHEET_URL;
    if (activeUrl && activeUrl.includes('output=csv')) {
      fetch(activeUrl)
        .then(res => res.text())
        .then(csvData => {
          const imported = parseCSV(csvData);
          if (imported.length > 0) {
            setStudents(imported);
            localStorage.setItem('sksb_students', JSON.stringify(imported));
          }
        })
        .catch(err => console.error("Auto sync student error:", err));
    }
  }, [sheetUrl]);

  // Auto Sync Kehadiran Cloud
  useEffect(() => {
    if (ATTENDANCE_API_URL && ATTENDANCE_API_URL.startsWith('https://script.google.com')) {
      fetch(ATTENDANCE_API_URL)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setAttendance(data);
            localStorage.setItem('sksb_attendance', JSON.stringify(data));
            setLastUpdatedTime(new Date());
          }
        })
        .catch(err => console.error("Error fetching online attendance:", err));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sksb_attendance', JSON.stringify(attendance));
    setLastUpdatedTime(new Date());
  }, [attendance]);

  // Fullscreen 15-second Carousel Rotation
  useEffect(() => {
    let timer = null;
    if (isFullscreenMode) {
      timer = setInterval(() => {
        setFullscreenScreenView(prev => (prev === 0 ? 1 : 0));
      }, 15000);
    } else {
      setFullscreenScreenView(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFullscreenMode]);

  // QR Scanner Logic
  useEffect(() => {
    let scanner = null;
    let timer = null;

    if (activeTab === 'scan') {
      timer = setTimeout(() => {
        const qrContainer = document.getElementById("qr-reader");
        if (qrContainer) {
          try {
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
          } catch (err) {
            console.error("Scanner init error:", err);
          }
        }
      }, 150);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      }
    };
  }, [activeTab, students, selectedDate]);

  const handleQrScanned = async (scannedCode) => {
    const rawCode = scannedCode.trim();
    const cleanCode = rawCode.toLowerCase();

    const foundStudent = students.find(s => {
      const studentId = (s.id || '').trim().toLowerCase();
      const qrToken = (s.qr_token || '').trim().toLowerCase();
      
      const studentNum = studentId.replace(/\D/g, '');
      const scannedNum = cleanCode.replace(/\D/g, '');

      return (
        studentId === cleanCode || 
        qrToken === cleanCode ||
        (studentNum !== '' && studentNum === scannedNum)
      );
    });

    if (foundStudent) {
      const newRecord = { student_id: foundStudent.id, date: selectedDate, status: 'Hadir', method: 'QR Kamera' };

      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.student_id === foundStudent.id && a.date === selectedDate));
        return [...filtered, newRecord];
      });

      setScanResult({
        success: true,
        student: foundStudent,
        message: `KEHADIRAN DIREKODKAN (${formatDateDMY(selectedDate)}): ${foundStudent.name} (${foundStudent.class})`
      });

      if (ATTENDANCE_API_URL && ATTENDANCE_API_URL.startsWith('https://script.google.com')) {
        try {
          await fetch(ATTENDANCE_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [newRecord] })
          });
        } catch (e) {
          console.error("Cloud sync error on QR scan:", e);
        }
      }

    } else {
      setScanResult({
        success: false,
        student: null,
        message: `KOD QR TIDAK DITEMUI: "${rawCode}" tiada dalam senarai murid.`
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

  const handleResetDailyAttendance = () => {
    if (window.confirm(`Adakah anda pasti untuk RESET semua rekod kehadiran kelas ${selectedClass} pada tarikh ${formatDateDMY(selectedDate)}?`)) {
      const classStudentIds = students.filter(s => s.class === selectedClass).map(s => s.id);
      setAttendance(prev => prev.filter(a => !(a.date === selectedDate && classStudentIds.includes(a.student_id))));
      setSaveMessage(`Rekod kehadiran kelas ${selectedClass} bagi ${formatDateDMY(selectedDate)} telah di-reset.`);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  const handleSaveAttendance = async () => {
    setIsSavingAttendance(true);
    setSaveMessage('Sedang menyimpan rekod kehadiran ke pangkalan data awan...');

    const classStudents = students.filter(s => s.class === selectedClass);
    const recordsToSync = attendance.filter(a => 
      a.date === selectedDate && classStudents.some(cs => cs.id === a.student_id)
    );

    if (ATTENDANCE_API_URL && ATTENDANCE_API_URL.startsWith('https://script.google.com')) {
      try {
        await fetch(ATTENDANCE_API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: recordsToSync })
        });
        setSaveMessage(`Berjaya! Rekod kehadiran kelas ${selectedClass} (${formatDateDMY(selectedDate)}) telah disimpan!`);
      } catch (err) {
        console.error("Cloud save error:", err);
        setSaveMessage(`Disimpan secara tempatan. (Ralat sambungan awan)`);
      }
    } else {
      setSaveMessage(`Rekod disimpan secara tempatan.`);
    }

    setIsSavingAttendance(false);
    setTimeout(() => {
      setSaveMessage('');
    }, 5000);
  };

  const printFilteredStudents = (printClassFilter === 'Semua' || !printClassFilter)
    ? students 
    : students.filter(s => s.class === printClassFilter);

  const filteredAttendanceByDate = attendance.filter(a => a.date === selectedDate);

  const totalSchoolStudents = students.length;
  const totalSchoolHadir = filteredAttendanceByDate.filter(a => a.status === 'Hadir').length;
  const totalSchoolPercent = totalSchoolStudents > 0 ? Math.round((totalSchoolHadir / totalSchoolStudents) * 100) : 0;

  const getDetailedClassStats = (className) => {
    const classStudents = className === 'Semua Kelas' 
      ? students 
      : students.filter(s => s.class === className);

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

    const maleAbsentList = [];
    const femaleAbsentList = [];

    classStudents.forEach(st => {
      const att = filteredAttendanceByDate.find(a => a.student_id === st.id);
      const isMale = st.gender === 'L';
      const status = att ? att.status : 'Tidak Hadir';

      if (isMale) maleTotal++;
      else femaleTotal++;

      if (status === 'Hadir') {
        totalHadir++;
        if (isMale) maleHadir++;
        else femaleHadir++;
      } else if (status === 'Bersebab') {
        totalBersebab++;
        if (isMale) {
          maleBersebab++;
          maleAbsentList.push({ ...st, reason: 'Bersebab' });
        } else {
          femaleBersebab++;
          femaleAbsentList.push({ ...st, reason: 'Bersebab' });
        }
      } else {
        totalTidakHadir++;
        if (isMale) {
          maleTidakHadir++;
          maleAbsentList.push({ ...st, reason: 'Tanpa Sebab' });
        } else {
          femaleTidakHadir++;
          femaleAbsentList.push({ ...st, reason: 'Tanpa Sebab' });
        }
      }
    });

    const percent = totalStudents > 0 ? Math.round((totalHadir / totalStudents) * 100) : 0;

    return {
      totalStudents, totalHadir, totalTidakHadir, totalBersebab, percent,
      maleTotal, maleHadir, maleTidakHadir, maleBersebab, maleAbsentList,
      femaleTotal, femaleHadir, femaleTidakHadir, femaleBersebab, femaleAbsentList
    };
  };

  const getClassDailyLeaderboard = () => {
    return availableClasses
      .map(cName => {
        const stats = getDetailedClassStats(cName);
        return { className: cName, percent: stats.percent, totalHadir: stats.totalHadir, totalStudents: stats.totalStudents };
      })
      .sort((a, b) => b.percent - a.percent);
  };

  const monthsList = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

  const getMonthlyClassStats = (monthIdx, className) => {
    const monthlyAttendance = attendance.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      return d.getMonth() === monthIdx;
    });

    const classStudents = className === 'Semua Kelas' ? students : students.filter(s => s.class === className);
    if (classStudents.length === 0) return { percent: 0, totalHadir: 0, totalRecords: 0 };

    let totalHadir = 0;
    let totalRecords = 0;

    classStudents.forEach(st => {
      const stRecords = monthlyAttendance.filter(a => a.student_id === st.id);
      stRecords.forEach(r => {
        totalRecords++;
        if (r.status === 'Hadir') totalHadir++;
      });
    });

    const percent = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 95;
    return { percent, totalHadir, totalRecords };
  };

  const getClassMonthlyLeaderboard = () => {
    return availableClasses
      .map(cName => {
        const stats = getMonthlyClassStats(selectedMonth, cName);
        return { className: cName, percent: stats.percent };
      })
      .sort((a, b) => b.percent - a.percent);
  };

  const getPerfectAttendanceStudents = () => {
    const targetStudents = (certFilterClass === 'Semua' || !certFilterClass)
      ? students 
      : students.filter(s => s.class === certFilterClass);

    return targetStudents.filter(st => {
      const studentRecords = attendance.filter(a => a.student_id === st.id);
      if (studentRecords.length === 0) return true;
      return !studentRecords.some(a => a.status === 'Tidak Hadir');
    });
  };

  const renderPieChartSectors = () => {
    const classData = availableClasses.map(c => ({
      name: c,
      stats: getDetailedClassStats(c)
    }));

    const totalWeight = classData.reduce((sum, item) => sum + (item.stats.totalStudents || 1), 0);
    let cumulativeAngle = 0;

    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
      '#06b6d4', '#6366f1', '#84cc16', '#f97316', '#14b8a6'
    ];

    return classData.map((item, index) => {
      const portion = (item.stats.totalStudents || 1) / totalWeight;
      const angle = portion * 360;

      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const x1 = 100 + 80 * Math.cos((Math.PI * (startAngle - 90)) / 180);
      const y1 = 100 + 80 * Math.sin((Math.PI * (startAngle - 90)) / 180);
      const x2 = 100 + 80 * Math.cos((Math.PI * (endAngle - 90)) / 180);
      const y2 = 100 + 80 * Math.sin((Math.PI * (endAngle - 90)) / 180);

      const largeArc = angle > 180 ? 1 : 0;
      const pathData = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const color = colors[index % colors.length];
      const isSelected = dashboardDetailClass === item.name;

      return (
        <path
          key={item.name}
          d={pathData}
          fill={color}
          opacity={isSelected ? 1 : 0.8}
          stroke="#ffffff"
          strokeWidth={isSelected ? "3" : "1.5"}
          className="cursor-pointer transition-all duration-200 hover:opacity-100 hover:scale-105 origin-center"
          onClick={() => setDashboardDetailClass(item.name)}
        >
          <title>{`Kelas ${item.name}: ${item.stats.percent}% Kehadiran`}</title>
        </path>
      );
    });
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

      {/* FULLSCREEN DEDICATED DISPLAY MODE */}
      {isFullscreenMode ? (
        <div className="fixed inset-0 bg-slate-950 text-white z-50 p-6 flex flex-col justify-between overflow-hidden select-none">
          
          {/* DISPLAY HEADER */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Logo Sekolah" className="w-12 h-12 object-contain" onError={e => e.target.style.display = 'none'} />
              <div>
                <h1 className="text-2xl font-black text-amber-400 tracking-wider">SK SUNGAI BAYAN</h1>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Paparan Dashboard Skrin Utama Kehadiran Murid</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="text-right border-r border-slate-800 pr-6">
                <p className="text-xs font-bold text-slate-400 uppercase">Tarikh Kehadiran</p>
                <p className="text-lg font-black text-blue-300 font-mono">{formatDateDMY(selectedDate)}</p>
              </div>

              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase flex items-center justify-end gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Kemas Kini Terakhir</span>
                </p>
                <p className="text-xs font-mono text-emerald-400 font-bold">{lastUpdatedTime.toLocaleTimeString()}</p>
              </div>

              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-2.5 rounded-xl transition border border-slate-700"
                title="Keluar Skrin Penuh"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* SCREEN A: OVERALL KPIS + TOP DAILY CLASS LEADERBOARD */}
          {fullscreenScreenView === 0 && (
            <div className="flex-1 my-6 flex flex-col justify-around gap-6">
              
              {/* BIG KPI CARDS */}
              <div className="grid grid-cols-5 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center shadow-lg">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Jumlah Murid</p>
                  <p className="text-5xl font-black text-white mt-2">{totalSchoolStudents}</p>
                </div>

                <div className="bg-slate-900 border-l-8 border-l-emerald-500 border border-slate-800 p-6 rounded-2xl text-center shadow-lg">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Hadir</p>
                  <p className="text-5xl font-black text-emerald-400 mt-2">{totalSchoolHadir}</p>
                </div>

                <div className="bg-slate-900 border-l-8 border-l-red-500 border border-slate-800 p-6 rounded-2xl text-center shadow-lg">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Tidak Hadir</p>
                  <p className="text-5xl font-black text-red-400 mt-2">
                    {filteredAttendanceByDate.filter(a => a.status === 'Tidak Hadir').length}
                  </p>
                </div>

                <div className="bg-slate-900 border-l-8 border-l-purple-500 border border-slate-800 p-6 rounded-2xl text-center shadow-lg">
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Bersebab</p>
                  <p className="text-5xl font-black text-purple-400 mt-2">
                    {filteredAttendanceByDate.filter(a => a.status === 'Bersebab').length}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-900 to-indigo-900 border border-blue-700 p-6 rounded-2xl text-center shadow-lg">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">% Kehadiran Sekolah</p>
                  <p className="text-5xl font-black text-amber-300 mt-2">{totalSchoolPercent}%</p>
                </div>
              </div>

              {/* DAILY LEADERBOARD */}
              <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 p-6 rounded-2xl text-white shadow-xl">
                <div className="flex items-center space-x-3 mb-4">
                  <Trophy className="w-8 h-8 text-yellow-200 animate-bounce" />
                  <h2 className="text-2xl font-black uppercase tracking-wider">Papan Pendahulu Kelas Terbaik Hari Ini ({formatDateDMY(selectedDate)})</h2>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {getClassDailyLeaderboard().slice(0, 3).map((item, index) => (
                    <div key={`fs-daily-${item.className}`} className="bg-slate-950/40 backdrop-blur-md p-5 rounded-xl border border-white/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-amber-200 uppercase">Kedudukan #{index + 1}</p>
                        <h3 className="text-2xl font-black">{item.className}</h3>
                        <p className="text-xs text-slate-300 mt-1">{item.totalHadir} / {item.totalStudents} Murid</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-full text-xs mb-1">
                          #{index + 1}
                        </span>
                        <p className="text-3xl font-black text-yellow-300">{item.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* SCREEN B: CLASS-BY-CLASS PERCENTAGE BREAKDOWN */}
          {fullscreenScreenView === 1 && (
            <div className="flex-1 my-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-blue-400 uppercase tracking-wider">Pecahan Peratusan Kehadiran Mengikut Kelas ({formatDateDMY(selectedDate)})</h2>
                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                  Mod Paparan Kelas
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6 my-auto">
                {availableClasses.map(cName => {
                  const stats = getDetailedClassStats(cName);
                  return (
                    <div key={`fs-class-${cName}`} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-black text-white">{cName}</h3>
                        <span className="text-2xl font-black text-emerald-400">{stats.percent}%</span>
                      </div>

                      <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden flex mb-3">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${stats.percent}%` }}></div>
                        <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${100 - stats.percent}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-t border-slate-800 pt-2">
                        <span>Hadir: <strong className="text-emerald-400">{stats.totalHadir}</strong></span>
                        <span>Tidak Hadir: <strong className="text-red-400">{stats.totalTidakHadir}</strong></span>
                        <span>Jumlah: <strong>{stats.totalStudents}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DISPLAY FOOTER */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs font-bold text-slate-400">
            <span>SK SUNGAI BAYAN — Sistem e-Hadir Digital</span>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-emerald-400 uppercase tracking-wider">Sistem Berjalan Aktif</span>
            </div>
            <span>Pertukaran Skrin Otomatik (15s)</span>
          </div>

        </div>
      ) : (
        /* STANDARD WORKFLOW INTERFACE */
        <>
          {/* Top Navbar Header */}
          <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shadow-md no-print">
            <div className="flex items-center space-x-3">
              <div className="bg-white/10 p-1 rounded-xl border border-white/20 flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="Logo SK Sungai Bayan" 
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                  }}
                />
                <Shield className="w-5 h-5 text-blue-400 hidden" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight tracking-wide">SK SUNGAI BAYAN</h1>
                <p className="text-[11px] text-slate-400">System e-Hadir & Sahsiah Murid</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isAdmin ? (
                <div className="flex items-center space-x-3">
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/30 font-medium">
                    Pentadbir Sistem (Admin)
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Keluar</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log Masuk Admin</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Container */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar Navigation */}
            <nav className="w-full md:w-60 bg-white border-r border-slate-200 p-3 space-y-1 no-print">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Home className="w-4 h-4" />
                <span>Papan Pemuka</span>
              </button>

              <button 
                onClick={() => setActiveTab('scan')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'scan' ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Imbas QR (Pintu Pagar)</span>
              </button>

              <button 
                onClick={() => setActiveTab('print')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'print' ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Cetak Kad ID / Sijil</span>
              </button>

              <button 
                onClick={() => setActiveTab('attendance')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Calendar className="w-4 h-4" />
                <span>Kehadiran Kelas</span>
              </button>

              <button 
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'students' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Users className="w-4 h-4" />
                <span>Direktori Murid ({students.length})</span>
              </button>

              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Hub Pentadbir</span>
                </button>
              )}
            </nav>

            {/* Content Area */}
            <main className="flex-1 p-4 md:p-5 overflow-y-auto max-w-7xl">
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  
                  {/* HEADER & DATE SELECTOR */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Ringkasan Kehadiran Keseluruhan</h2>
                      <p className="text-[11px] text-slate-500">Pantau statistik kehadiran harian dan senarai nama murid tidak hadir.</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 px-2.5 py-1 rounded-lg shadow-sm">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-[11px] font-bold text-slate-500">Tarikh:</span>
                        <input 
                          type="date" 
                          value={selectedDate}
                          onChange={e => setSelectedDate(e.target.value)}
                          className="text-[11px] font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
                        />
                        <span className="text-[10px] text-blue-600 font-mono font-bold border-l pl-2 border-slate-200">
                          ({formatDateDMY(selectedDate)})
                        </span>
                      </div>

                      {/* FULL-FRAME TOGGLE BUTTON */}
                      <button 
                        onClick={() => setIsFullscreenMode(true)}
                        className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                        title="Tukar ke Paparan Dedicated Display Skrin Penuh"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Skrin Penuh</span>
                      </button>
                    </div>
                  </div>

                  {/* STAT CARDS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Jumlah Murid</p>
                      <p className="text-xl font-bold text-slate-900 mt-0.5">{totalSchoolStudents}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Hadir</p>
                      <p className="text-xl font-bold text-emerald-600 mt-0.5">{totalSchoolHadir}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tidak Hadir</p>
                      <p className="text-xl font-bold text-red-600 mt-0.5">
                        {filteredAttendanceByDate.filter(a => a.status === 'Tidak Hadir').length}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bersebab</p>
                      <p className="text-xl font-bold text-purple-600 mt-0.5">
                        {filteredAttendanceByDate.filter(a => a.status === 'Bersebab').length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-sm col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">% Sekolah</p>
                        <Percent className="w-3.5 h-3.5 text-blue-300" />
                      </div>
                      <p className="text-xl font-black text-amber-400 mt-0.5">{totalSchoolPercent}%</p>
                    </div>
                  </div>

                  {/* DUAL SCOREBOARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* 1. DAILY SCOREBOARD */}
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-600 rounded-xl p-3 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Trophy className="w-4 h-4 text-yellow-200" />
                          <h3 className="font-extrabold text-xs uppercase tracking-wide">Papan Pendahulu Harian ({formatDateDMY(selectedDate)})</h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {getClassDailyLeaderboard().slice(0, 3).map((item, index) => {
                          const rankBadges = [
                            { rank: '1', bg: 'bg-yellow-400 text-slate-900' },
                            { rank: '2', bg: 'bg-slate-200 text-slate-900' },
                            { rank: '3', bg: 'bg-amber-700 text-white' }
                          ];
                          const badge = rankBadges[index];

                          return (
                            <div key={`daily-${item.className}`} className="bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/20 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-amber-100">#{index + 1}</span>
                                <span className={`w-5 h-5 rounded-full text-center leading-5 font-black text-[10px] ${badge.bg}`}>
                                  #{badge.rank}
                                </span>
                              </div>
                              <h4 className="text-xs font-black truncate mt-0.5">{item.className}</h4>
                              <p className="text-sm font-black text-yellow-300">{item.percent}%</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. MONTHLY SCOREBOARD */}
                    <div className="bg-gradient-to-r from-indigo-700 to-blue-800 rounded-xl p-3 text-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Award className="w-4 h-4 text-blue-200" />
                          <h3 className="font-extrabold text-xs uppercase tracking-wide">Papan Pendahulu Bulanan ({monthsList[selectedMonth]})</h3>
                        </div>
                        <select 
                          value={selectedMonth}
                          onChange={e => setSelectedMonth(Number(e.target.value))}
                          className="bg-white/20 text-white text-[10px] font-bold rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          {monthsList.map((m, idx) => (
                            <option key={m} value={idx} className="text-slate-900">{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {getClassMonthlyLeaderboard().slice(0, 3).map((item, index) => {
                          return (
                            <div key={`monthly-${item.className}`} className="bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/20 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-blue-200">#{index + 1}</span>
                                <span className="text-[9px] bg-blue-400/30 px-1 rounded font-bold">Bulan</span>
                              </div>
                              <h4 className="text-xs font-black truncate mt-0.5">{item.className}</h4>
                              <p className="text-sm font-black text-blue-200">{item.percent}%</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* MAIN CONTENT GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
                    
                    {/* LEFT SIDE: DONUT/PIE CHART & MONTHLY VERTICAL BARS */}
                    <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
                      
                      {/* CLICKABLE PIE/DONUT CHART */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between border-b pb-1.5 border-slate-100">
                            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Pai Kehadiran Mengikut Kelas ({formatDateDMY(selectedDate)})</span>
                            </h3>
                            <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                              Klik sektor untuk butiran
                            </span>
                          </div>

                          <div className="flex items-center justify-around pt-2">
                            <div className="relative w-28 h-28 flex-shrink-0">
                              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                                {renderPieChartSectors()}
                                <circle cx="100" cy="100" r="45" fill="#ffffff" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Purata</span>
                                <span className="text-xs font-black text-slate-800">{totalSchoolPercent}%</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-24 overflow-y-auto pr-1">
                              {availableClasses.map((c, i) => {
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#84cc16'];
                                const isSel = dashboardDetailClass === c;

                                return (
                                  <button
                                    key={c}
                                    onClick={() => setDashboardDetailClass(c)}
                                    className={`flex items-center space-x-1.5 text-[10px] text-left p-1 rounded transition ${
                                      isSel ? 'bg-slate-100 font-extrabold text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></span>
                                    <span className="truncate max-w-[70px]">{c}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* VERTICAL BAR CHART */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1.5 border-slate-100">
                          <h3 className="font-bold text-slate-800 text-xs">Peratus Kehadiran Tahunan Mengikut Bulan (%)</h3>
                          <span className="text-[9px] text-slate-400">Klik bulan untuk butiran</span>
                        </div>

                        <div className="flex items-end justify-between gap-1 pt-3 h-28 px-2">
                          {monthsList.map((m, idx) => {
                            const mStats = getMonthlyClassStats(idx, 'Semua Kelas');
                            const isSel = selectedMonth === idx;

                            return (
                              <div 
                                key={m} 
                                onClick={() => setSelectedMonth(idx)}
                                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                              >
                                <span className={`text-[8px] font-bold ${isSel ? 'text-blue-600' : 'text-slate-400'}`}>
                                  {mStats.percent}%
                                </span>
                                <div className="w-full bg-slate-100 rounded-t h-20 flex items-end overflow-hidden p-0.5">
                                  <div 
                                    className={`w-full rounded-t transition-all duration-300 ${
                                      isSel ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400'
                                    }`}
                                    style={{ height: `${mStats.percent}%` }}
                                  ></div>
                                </div>
                                <span className={`text-[9px] font-bold ${isSel ? 'text-blue-700 underline' : 'text-slate-600'}`}>
                                  {m}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* RIGHT SIDE: MAKLUMAT TERPERINCI */}
                    <div className="lg:col-span-5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
                      <div>
                        <div className="border-b pb-2 border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Maklumat Terperinci</p>
                            <h3 className="font-black text-slate-900 text-sm">{dashboardDetailClass}</h3>
                          </div>

                          <select 
                            value={dashboardDetailClass} 
                            onChange={e => setDashboardDetailClass(e.target.value)}
                            className="bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-800 rounded px-2 py-1 outline-none"
                          >
                            <option value="Semua Kelas">Semua Kelas</option>
                            {availableClasses.map(c => (
                              <option key={c} value={c}>Kelas {c}</option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const detail = getDetailedClassStats(dashboardDetailClass);
                          return (
                            <div className="mt-2 space-y-2">
                              
                              {/* LELAKI ABSENT LIST */}
                              <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-blue-900 uppercase">Lelaki (L)</span>
                                  <span className="text-[9px] font-bold bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded">
                                    Hadir: {detail.maleHadir} / {detail.maleTotal}
                                  </span>
                                </div>

                                <div className="bg-white p-2 rounded border border-blue-100">
                                  <p className="text-[9px] font-bold text-red-600 uppercase flex items-center gap-1 mb-1">
                                    <UserX className="w-3 h-3" />
                                    <span>Tidak Hadir ({detail.maleAbsentList.length})</span>
                                  </p>
                                  {detail.maleAbsentList.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Semua hadir.</p>
                                  ) : (
                                    <ul className="divide-y divide-slate-100 max-h-20 overflow-y-auto pr-1">
                                      {detail.maleAbsentList.map(st => (
                                        <li key={st.id} className="py-0.5 text-[10px] flex items-center justify-between">
                                          <span className="font-medium text-slate-800 uppercase truncate max-w-[130px]">{st.name}</span>
                                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${st.reason === 'Bersebab' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                                            {st.reason}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>

                              {/* PEREMPUAN ABSENT LIST */}
                              <div className="bg-pink-50/60 p-2.5 rounded-lg border border-pink-200 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-pink-900 uppercase">Perempuan (P)</span>
                                  <span className="text-[9px] font-bold bg-pink-200/80 text-pink-900 px-1.5 py-0.5 rounded">
                                    Hadir: {detail.femaleHadir} / {detail.femaleTotal}
                                  </span>
                                </div>

                                <div className="bg-white p-2 rounded border border-pink-100">
                                  <p className="text-[9px] font-bold text-red-600 uppercase flex items-center gap-1 mb-1">
                                    <UserX className="w-3 h-3" />
                                    <span>Tidak Hadir ({detail.femaleAbsentList.length})</span>
                                  </p>
                                  {detail.femaleAbsentList.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Semua hadir.</p>
                                  ) : (
                                    <ul className="divide-y divide-slate-100 max-h-20 overflow-y-auto pr-1">
                                      {detail.femaleAbsentList.map(st => (
                                        <li key={st.id} className="py-0.5 text-[10px] flex items-center justify-between">
                                          <span className="font-medium text-slate-800 uppercase truncate max-w-[130px]">{st.name}</span>
                                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${st.reason === 'Bersebab' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                                            {st.reason}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>

                            </div>
                          );
                        })()}
                      </div>

                      <div className="bg-slate-900 text-white p-2.5 rounded-lg mt-2 flex items-center justify-between text-[10px]">
                        <span>Pilihan Bulan: <strong>{monthsList[selectedMonth]}</strong></span>
                        <span className="text-amber-400 font-bold">Tarikh: {formatDateDMY(selectedDate)}</span>
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* CLASS ATTENDANCE TAB */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Kehadiran Kelas Manual</h2>
                      <p className="text-xs text-slate-500">Pilih kelas dan tarikh untuk semakan atau kemaskini kehadiran.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 px-2.5 py-1 rounded-lg shadow-sm">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
                        className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none shadow-sm"
                      >
                        {availableClasses.map(c => (
                          <option key={c} value={c}>Kelas {c}</option>
                        ))}
                      </select>

                      <button 
                        onClick={markAllPresent}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition border border-slate-300"
                      >
                        Tanda Semua Hadir
                      </button>

                      {/* RESET ATTENDANCE BUTTON */}
                      <button 
                        onClick={handleResetDailyAttendance}
                        className="flex items-center space-x-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1.5 rounded-lg transition border border-amber-300"
                        title="Reset Kehadiran Hari Ini"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Reset Hari Ini</span>
                      </button>

                      <button 
                        onClick={handleSaveAttendance}
                        disabled={isSavingAttendance}
                        className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                      >
                        <Save className={`w-3.5 h-3.5 ${isSavingAttendance ? 'animate-spin' : ''}`} />
                        <span>{isSavingAttendance ? 'Sedang Simpan...' : 'Simpan Rekod'}</span>
                      </button>
                    </div>
                  </div>

                  {saveMessage && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{saveMessage}</span>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Murid</th>
                          <th className="px-4 py-2.5">Kelas</th>
                          <th className="px-4 py-2.5 text-center">Status Kehadiran ({formatDateDMY(selectedDate)})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.filter(s => s.class === selectedClass).map(s => {
                          const att = attendance.find(a => a.student_id === s.id && a.date === selectedDate);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-2.5">
                                <p className="font-bold text-slate-900">{s.name}</p>
                                <p className="text-[10px] text-slate-400">{s.id}</p>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{s.class}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button 
                                    onClick={() => toggleAttendance(s.id, 'Hadir')}
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${att?.status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'}`}
                                  >
                                    Hadir
                                  </button>
                                  <button 
                                    onClick={() => toggleAttendance(s.id, 'Tidak Hadir')}
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${att?.status === 'Tidak Hadir' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-red-50'}`}
                                  >
                                    Tidak Hadir
                                  </button>
                                  <button 
                                    onClick={() => toggleAttendance(s.id, 'Bersebab')}
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${att?.status === 'Bersebab' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-purple-50'}`}
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

              {/* TAB CETAK KAD ID / QR MURID & SIJIL 100% */}
              {activeTab === 'print' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 bg-slate-200 p-1 rounded-xl no-print max-w-md">
                    <button 
                      onClick={() => setPrintSubTab('cards')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        printSubTab === 'cards' 
                          ? 'bg-indigo-900 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Kad Matrik & QR Murid
                    </button>
                    <button 
                      onClick={() => setPrintSubTab('certs')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        printSubTab === 'certs' 
                          ? 'bg-amber-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sijil Kehadiran 100%
                    </button>
                  </div>

                  {printSubTab === 'cards' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print bg-indigo-900 text-white p-4 rounded-xl shadow-md">
                        <div>
                          <h2 className="text-lg font-bold">Penjana Kad Matrik & QR Murid</h2>
                          <p className="text-indigo-200 text-xs">Cetak Kad ID murid bertema SK Sungai Bayan lengkap dengan Kod QR yang sedia diimbas.</p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <select 
                            value={printClassFilter} 
                            onChange={e => setPrintClassFilter(e.target.value)}
                            className="bg-white text-slate-900 text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none"
                          >
                            <option value="Semua">Semua Kelas ({students.length})</option>
                            {availableClasses.map(c => (
                              <option key={c} value={c}>Kelas {c}</option>
                            ))}
                          </select>

                          <button 
                            onClick={() => window.print()} 
                            className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-md"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak Kad ID ({printFilteredStudents.length})</span>
                          </button>
                        </div>
                      </div>

                      <div className="print-area grid grid-cols-1 md:grid-cols-2 gap-4">
                        {printFilteredStudents.map(s => {
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(s.id)}`;
                          
                          return (
                            <div 
                              key={s.id} 
                              className="id-card bg-white rounded-xl border-2 border-slate-800 shadow-md overflow-hidden flex flex-col justify-between relative"
                              style={{ minHeight: '220px' }}
                            >
                              <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white px-3 py-2 flex items-center justify-between border-b-2 border-amber-400">
                                <div className="flex items-center space-x-2">
                                  <img 
                                    src="/logo.png" 
                                    alt="SK Sungai Bayan" 
                                    className="w-6 h-6 object-contain bg-white/10 rounded p-0.5"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                  <div>
                                    <h3 className="font-extrabold text-[11px] tracking-wider leading-tight text-amber-300">SK SUNGAI BAYAN</h3>
                                    <p className="text-[8px] text-slate-300 tracking-tight">KAD MATRIK & KEHADIRAN MURID</p>
                                  </div>
                                </div>
                                <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black tracking-widest">
                                  2026
                                </span>
                              </div>

                              <div className="p-3 flex items-center justify-between gap-2.5 bg-slate-50/50 flex-1 overflow-hidden">
                                <div className="space-y-1 flex-1 min-w-0 pr-1">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Nama Murid</p>
                                    <h4 
                                      className={`font-black text-slate-900 leading-tight uppercase break-words ${
                                        s.name.length > 30 
                                          ? 'text-[10px]' 
                                          : s.name.length > 22 
                                            ? 'text-[11px]' 
                                            : 'text-xs'
                                      }`}
                                      style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {s.name}
                                    </h4>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="bg-blue-100 text-blue-900 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-300">
                                      ID: {s.id}
                                    </span>
                                    <span className="bg-emerald-100 text-emerald-900 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-300">
                                      KELAS: {s.class}
                                    </span>
                                  </div>

                                  <div className="pt-1 text-[8px] text-slate-600 space-y-0.5 border-t border-slate-200">
                                    <p className="break-all">
                                      <span className="font-bold text-slate-800">Emel DELIMA:</span> {s.guardian}
                                    </p>
                                    <p><span className="font-bold text-slate-800">No. Tel:</span> {s.phone}</p>
                                  </div>
                                </div>

                                <div className="bg-white p-1 rounded-lg border-2 border-slate-300 shadow-sm text-center flex flex-col items-center justify-center flex-shrink-0">
                                  <img 
                                    src={qrUrl} 
                                    alt={`QR ${s.id}`} 
                                    className="w-16 h-16 object-contain rounded"
                                  />
                                  <p className="text-[8px] font-mono font-bold text-slate-500 mt-0.5">{s.id}</p>
                                </div>
                              </div>

                              <div className="bg-slate-900 px-3 py-1 flex items-center justify-between text-[8px] text-slate-400">
                                <span>Kad ID Rasmi SK Sungai Bayan</span>
                                <span className="font-mono text-amber-400">E-HADIR DIGITAL</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {printSubTab === 'certs' && (
                    <div className="space-y-4">
                      <div className="bg-amber-700 text-white p-4 rounded-xl shadow-md no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <Award className="w-6 h-6 text-amber-200" />
                          <div>
                            <h2 className="text-lg font-bold">Penjana Sijil Kehadiran 100%</h2>
                            <p className="text-amber-100 text-xs">Cetak sijil penghargaan khas bagi murid yang tidak pernah tidak hadir.</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <select 
                            value={certFilterClass} 
                            onChange={e => setCertFilterClass(e.target.value)}
                            className="bg-white text-slate-900 text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none"
                          >
                            <option value="Semua">Semua Kelas ({students.length})</option>
                            {availableClasses.map(c => (
                              <option key={c} value={c}>Kelas {c}</option>
                            ))}
                          </select>

                          <button 
                            onClick={() => window.print()} 
                            className="flex items-center space-x-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-md"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak Sijil ({getPerfectAttendanceStudents().length})</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 no-print space-y-2">
                        <p className="text-xs font-bold text-slate-600 uppercase">Pratonton Sijil ({getPerfectAttendanceStudents().length} Murid Ditemui)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {getPerfectAttendanceStudents().map(s => (
                            <div key={`preview-${s.id}`} className="bg-white p-3 rounded-lg border border-amber-300 shadow-sm flex items-center justify-between text-xs">
                              <div>
                                <h4 className="font-bold text-slate-900">{s.name}</h4>
                                <p className="text-[10px] text-slate-500">ID: {s.id} • Kelas: {s.class}</p>
                              </div>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                100%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="hidden print:block space-y-8">
                        {getPerfectAttendanceStudents().map(s => (
                          <div 
                            key={`cert-${s.id}`} 
                            className="w-full h-[98vh] border-8 border-double border-amber-600 p-10 flex flex-col justify-between text-center bg-white relative page-break-after-always"
                          >
                            <div className="space-y-4">
                              <img src="/logo.png" alt="Logo Sekolah" className="w-20 h-20 mx-auto object-contain" />
                              <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-widest">SEKOLAH KEBANGSAAN SUNGAI BAYAN</h1>
                              <p className="text-xs font-semibold text-slate-600 uppercase">Sijil Penghargaan Kehadiran Penuh</p>
                              <div className="w-24 h-1 bg-amber-500 mx-auto my-2"></div>
                            </div>

                            <div className="space-y-4 my-auto">
                              <p className="text-sm text-slate-700">Dengan ini diperakui bahawa</p>
                              <h2 className="text-2xl font-black text-amber-700 uppercase underline decoration-amber-400 decoration-2">{s.name}</h2>
                              <p className="text-xs font-bold text-slate-800">NO ID: {s.id} &nbsp;|&nbsp; KELAS: {s.class}</p>
                              <p className="text-sm text-slate-700 max-w-xl mx-auto leading-relaxed">
                                Telah mencapai rekod <strong>Kehadiran 100% (Penuh)</strong> bagi sesi persekolahan 2026 atas komitmen dan disiplin cemerlang yang ditunjukkan.
                              </p>
                            </div>

                            <div className="flex items-end justify-between pt-8 text-xs text-slate-700 border-t border-slate-300">
                              <div className="text-left">
                                <p className="font-bold">Tarikh: {formatDateDMY(selectedDate)}</p>
                                <p>SK Sungai Bayan, HEM e-Hadir</p>
                              </div>
                              <div className="text-center w-40">
                                <div className="border-b border-slate-800 mb-1 h-10"></div>
                                <p className="font-bold uppercase">Guru Besar / PK HEM</p>
                                <p className="text-[9px]">SK Sungai Bayan</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SCAN QR TAB */}
              {activeTab === 'scan' && (
                <div className="space-y-4 max-w-xl mx-auto">
                  <div className="bg-emerald-900 text-white p-4 rounded-xl shadow-md text-center">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-1 border border-emerald-400/30">
                      <Camera className="w-5 h-5 text-emerald-300" />
                    </div>
                    <h2 className="text-lg font-bold">Pengimbas Kehadiran Pintu Pagar</h2>
                    <p className="text-emerald-200 text-xs">Tarikh Imbasan: <strong>{formatDateDMY(selectedDate)}</strong></p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-dashed border-slate-300"></div>

                    <form onSubmit={handleManualQrSubmit} className="flex gap-2">
                      <input 
                        type="text" 
                        value={manualQrInput}
                        onChange={e => setManualQrInput(e.target.value)}
                        placeholder="Atau taip No ID murid secara manual..."
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition">
                        Tanda Hadir
                      </button>
                    </form>
                  </div>

                  {scanResult && (
                    <div className={`p-4 rounded-xl border shadow-md transition-all ${
                      scanResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
                    }`}>
                      <div className="flex items-start space-x-2.5">
                        {scanResult.success ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="font-bold text-sm">{scanResult.success ? 'BERJAYA IMBAS' : 'RALAT IMBASAN'}</h4>
                          <p className="text-xs mt-0.5">{scanResult.message}</p>
                          {scanResult.student && (
                            <div className="mt-2 bg-white/80 p-2 rounded border border-emerald-200 text-[11px] space-y-0.5 text-slate-700">
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Direktori Murid ({students.length})</h2>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Cari nama / ID murid..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none w-56"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery)).map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-xs">{s.name}</h3>
                            <p className="text-[10px] text-blue-600 font-semibold">{s.id} • Kelas {s.class}</p>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                            Jantina: {s.gender}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <p className="truncate"><span className="font-semibold text-slate-700">Emel DELIMA:</span> {s.guardian}</p>
                          <p><span className="font-semibold text-slate-700">No. Tel:</span> {s.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ADMIN HUB TAB */}
              {activeTab === 'admin' && isAdmin && (
                <div className="space-y-4">
                  <div className="bg-purple-900 text-white p-4 rounded-xl shadow-md">
                    <h2 className="text-lg font-bold">Hub Pentadbir Sistem (Admin)</h2>
                    <p className="text-purple-200 text-xs">Akses penuh pengurusan data murid, tetapan sekolah, dan selenggara rekod.</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <h3 className="font-bold text-slate-800 text-sm">Google Sheets Live Sync</h3>
                    <p className="text-xs text-slate-600">
                      Tampal pautan <strong>Publish to Web (CSV)</strong> Google Sheets anda di bawah untuk menarik rekod murid terkini.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        value={sheetUrl}
                        onChange={e => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <button 
                        onClick={handleGoogleSheetsSync}
                        disabled={syncStatus.loading}
                        className="flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
                        <span>{syncStatus.loading ? 'Sedang Sync...' : 'Sync Sekarang'}</span>
                      </button>
                    </div>

                    {syncStatus.message && (
                      <div className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
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
              <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Log Masuk Pentadbir</h3>
                  <p className="text-xs text-slate-500">Masukkan ID dan kata laluan khas Admin sekolah.</p>
                </div>

                {loginError && (
                  <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded-lg border border-red-200 font-medium text-center">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ID Pengguna</label>
                    <input 
                      type="text" 
                      value={adminId}
                      onChange={e => setAdminId(e.target.value)}
                      placeholder="adminsksb"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button 
                      type="button" 
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 bg-slate-100 text-slate-700 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
                    >
                      Log Masuk
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}