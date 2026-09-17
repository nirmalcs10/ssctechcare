import { useState, useEffect } from 'react';

export const TRANSLATIONS = {
  en: {
    // Nav & Common
    dashboard: 'Dashboard',
    tickets: 'Job Tickets',
    kanban: 'Kanban Bench',
    inventory: 'Spare Parts',
    customers: 'Customers',
    invoices: 'Billing & Invoices',
    technicians: 'Technicians',
    track: 'Public Tracker',
    settings: 'Settings',
    management: 'Management',
    newJobCard: 'New Job Card',
    customerPortal: 'Customer Portal',
    signOut: 'Sign Out',
    searchPlaceholder: 'Search by Ticket #, Phone, Customer, Serial...',
    serviceCenterReady: 'Service Center Ready',
    serviceCenterDesc: 'Fast diagnosis, genuine spare parts tracking & professional A4 job cards.',
    
    // Statuses
    RECEIVED: 'Device Received',
    IN_DIAGNOSIS: 'Under Diagnosis',
    QUOTATION_PENDING: 'Quotation Pending',
    APPROVED: 'Customer Approved',
    WAITING_PARTS: 'Waiting for Parts',
    IN_REPAIR: 'Repair in Progress',
    TESTING_QC: 'Testing & QC',
    READY_FOR_PICKUP: 'Ready for Pickup',
    DELIVERED: 'Delivered / Closed',
    CANCELLED: 'Cancelled',

    // Settings Tabs
    account: 'Account',
    identity: 'Service Center Identity',
    backup: 'Backup and Restore',
    appearance: 'Appearance',
    language: 'Language',
    accountDesc: 'Profile, security & staff',
    identityDesc: 'Workshop brand & print terms',
    backupDesc: 'Snapshots & safety recovery',
    appearanceDesc: 'Theme, colors & layout density',
    languageDesc: 'Regional language & date formats',

    // Settings Content
    systemSettings: 'System Settings',
    systemSettingsDesc: 'Configure workshop identity, staff accounts, database snapshots, appearance, and language',
    changePassword: 'Change Password',
    staffManagement: 'Staff & User Management',
    addStaffUser: 'Add Staff User',
    saveIdentity: 'Save Service Center Identity',
    downloadBackup: 'Download Live Database Snapshot',
    restoreBackup: 'Restore Database from Backup',
    themeMode: 'Theme Mode',
    accentPalette: 'Primary Accent Palette',
    layoutDensity: 'Workbench Layout Density',
    primaryLanguage: 'Primary System Language',
    dateFormat: 'Date & Time Format',
    currencyFormat: 'Currency & Number System',
    save: 'Save',
    cancel: 'Cancel',
    active: 'Active',
    inactive: 'Inactive',

    // Dashboard
    activeRepairs: 'Active Repairs',
    readyForPickup: 'Ready for Collection',
    revenueToday: 'Today Revenue',
    lowStockAlert: 'Low Stock Items',
    recentTickets: 'Recent Repair Tickets',
    quickIntake: 'Quick Intake'
  },

  ta: {
    // Nav & Common
    dashboard: 'டாஷ்போர்டு',
    tickets: 'பழுதுபார்ப்பு டிக்கெட்டுகள்',
    kanban: 'பணி நிலை பலகை',
    inventory: 'உதிரி பாகங்கள்',
    customers: 'வாடிக்கையாளர்கள்',
    invoices: 'பில் மற்றும் ரசீதுகள்',
    technicians: 'தொழில்நுட்ப வல்லுநர்கள்',
    track: 'நேரலை டிராக்கர்',
    settings: 'அமைப்புகள்',
    management: 'நிர்வாகம்',
    newJobCard: 'புதிய வேலை அட்டை',
    customerPortal: 'வாடிக்கையாளர் போர்டல்',
    signOut: 'வெளியேறு',
    searchPlaceholder: 'டிக்கெட் எண், தொலைபேசி, வாடிக்கையாளர் மூலம் தேடுக...',
    serviceCenterReady: 'சேவை மையம் தயார்',
    serviceCenterDesc: 'விரைவான ஆய்வு, அசல் உதிரி பாகங்கள் மற்றும் A4 வேலை அட்டைகள்.',

    // Statuses
    RECEIVED: 'சாதனம் பெறப்பட்டது',
    IN_DIAGNOSIS: 'ஆய்வில் உள்ளது',
    QUOTATION_PENDING: 'மதிப்பீடு நிலுவையில்',
    APPROVED: 'வாடிக்கையாளர் ஒப்புதல்',
    WAITING_PARTS: 'பாகங்களுக்காக காத்திருக்கிறது',
    IN_REPAIR: 'பழுதுபார்ப்பு நடக்கிறது',
    TESTING_QC: 'பரிசோதனை மற்றும் தர சரிபார்ப்பு',
    READY_FOR_PICKUP: 'பெற தயாராக உள்ளது',
    DELIVERED: 'வழங்கப்பட்டது / முடிந்தது',
    CANCELLED: 'ரத்து செய்யப்பட்டது',

    // Settings Tabs
    account: 'கணக்கு',
    identity: 'சேவை மைய அடையாளம்',
    backup: 'காப்பு மற்றும் மீட்டமை',
    appearance: 'தோற்றம் & தீம்',
    language: 'மொழி',
    accountDesc: 'சுயவிவரம், கடவுச்சொல் மற்றும் ஊழியர்கள்',
    identityDesc: 'கடை பெயர், முகவரி மற்றும் விதிமுறைகள்',
    backupDesc: 'தரவுத்தள காப்பு மற்றும் பாதுகாப்பு',
    appearanceDesc: 'தீம், வண்ணங்கள் மற்றும் அடர்த்தி',
    languageDesc: 'மொழி மற்றும் தேதி வடிவங்கள்',

    // Settings Content
    systemSettings: 'கணினி அமைப்புகள்',
    systemSettingsDesc: 'பணிமனை விவரங்கள், ஊழியர்கள், காப்பு பிரதிகள் மற்றும் மொழியை உள்ளமைக்கவும்',
    changePassword: 'கடவுச்சொல்லை மாற்றவும்',
    staffManagement: 'ஊழியர்கள் & பயனர் நிர்வாகம்',
    addStaffUser: 'ஊழியரைச் சேர்க்கவும்',
    saveIdentity: 'சேவை மைய விவரங்களைச் சேமிக்கவும்',
    downloadBackup: 'தரவுத்தள காப்புப் பிரதியை பதிவிறக்கவும்',
    restoreBackup: 'காப்புப்பிரதியிலிருந்து மீட்டமைக்கவும்',
    themeMode: 'தீம் முறை',
    accentPalette: 'முக்கிய வண்ணத் தட்டு',
    layoutDensity: 'தளவமைப்பு இடைவெளி',
    primaryLanguage: 'முதன்மையான மொழி',
    dateFormat: 'தேதி மற்றும் நேர வடிவம்',
    currencyFormat: 'நாணய வடிவம்',
    save: 'சேமி',
    cancel: 'ரத்து',
    active: 'செயலில்',
    inactive: 'செயலற்றது',

    // Dashboard
    activeRepairs: 'செயலில் உள்ள பழுதுகள்',
    readyForPickup: 'டெலிவரிக்கு தயார்',
    revenueToday: 'இன்றைய வருவாய்',
    lowStockAlert: 'குறைந்த இருப்பு பாகங்கள்',
    recentTickets: 'சமீபத்திய டிக்கெட்டுகள்',
    quickIntake: 'விரைவு பதிவு'
  },

  hi: {
    // Nav & Common
    dashboard: 'डैशबोर्ड',
    tickets: 'मरम्मत टिकट',
    kanban: 'कार्य बेंच (कानबन)',
    inventory: 'अतिरिक्त पुर्जे (स्टॉक)',
    customers: 'ग्राहक सूची',
    invoices: 'बिल और चालान',
    technicians: 'तकनीशियन',
    track: 'सार्वजनिक ट्रैकर',
    settings: 'सेटिंग्स',
    management: 'प्रबंधन',
    newJobCard: 'नया जॉब कार्ड',
    customerPortal: 'ग्राहक पोर्टल',
    signOut: 'साइन आउट',
    searchPlaceholder: 'टिकट संख्या, फोन, ग्राहक या सीरियल नंबर से खोजें...',
    serviceCenterReady: 'सेवा केंद्र सक्रिय',
    serviceCenterDesc: 'तेज़ निदान, मूल स्पेयर पार्ट्स और पेशेवर A4 जॉब कार्ड।',

    // Statuses
    RECEIVED: 'उपकरण प्राप्त हुआ',
    IN_DIAGNOSIS: 'जांच जारी है',
    QUOTATION_PENDING: 'अनुमान लंबित',
    APPROVED: 'ग्राहक स्वीकृत',
    WAITING_PARTS: 'पुर्जों की प्रतीक्षा',
    IN_REPAIR: 'मरम्मत कार्य जारी',
    TESTING_QC: 'परीक्षण और गुणवत्ता जांच',
    READY_FOR_PICKUP: 'लेने के लिए तैयार',
    DELIVERED: 'वितरित / बंद',
    CANCELLED: 'रद्द किया गया',

    // Settings Tabs
    account: 'खाता',
    identity: 'सेवा केंद्र पहचान',
    backup: 'बैकअप और पुनर्स्थापना',
    appearance: 'दिखावट (थीम)',
    language: 'भाषा',
    accountDesc: 'प्रोफ़ाइल, सुरक्षा और कर्मचारी',
    identityDesc: 'दुकान ब्रांड और मुद्रण शर्तें',
    backupDesc: 'डेटाबेस बैकअप और सुरक्षा',
    appearanceDesc: 'थीम, रंग और लेआउट घनत्व',
    languageDesc: 'क्षेत्रीय भाषा और दिनांक प्रारूप',

    // Settings Content
    systemSettings: 'सिस्टम सेटिंग्स',
    systemSettingsDesc: 'दुकान की पहचान, स्टाफ खाते, बैकअप, थीम और भाषा कॉन्फ़िगर करें',
    changePassword: 'पासवर्ड बदलें',
    staffManagement: 'स्टाफ और उपयोगकर्ता प्रबंधन',
    addStaffUser: 'नया स्टाफ जोड़ें',
    saveIdentity: 'पहचान विवरण सहेजें',
    downloadBackup: 'डेटाबेस बैकअप डाउनलोड करें',
    restoreBackup: 'बैकअप फ़ाइल से पुनर्स्थापित करें',
    themeMode: 'थीम मोड',
    accentPalette: 'मुख्य रंग पैलेट',
    layoutDensity: 'लेआउट घनत्व',
    primaryLanguage: 'प्राथमिक प्रणाली भाषा',
    dateFormat: 'दिनांक और समय प्रारूप',
    currencyFormat: 'मुद्रा प्रारूप',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',

    // Dashboard
    activeRepairs: 'सक्रिय मरम्मत',
    readyForPickup: 'प्राप्त करने के लिए तैयार',
    revenueToday: 'आज का राजस्व',
    lowStockAlert: 'कम स्टॉक वाले पुर्जे',
    recentTickets: 'हाल के मरम्मत टिकट',
    quickIntake: 'त्वरित प्रवेश'
  },

  es: {
    // Nav & Common
    dashboard: 'Panel de Control',
    tickets: 'Tickets de Reparación',
    kanban: 'Mesa Kanban',
    inventory: 'Piezas y Repuestos',
    customers: 'Clientes',
    invoices: 'Facturación y Recibos',
    technicians: 'Técnicos',
    track: 'Rastreador Público',
    settings: 'Configuración',
    management: 'Gestión',
    newJobCard: 'Nueva Hoja de Trabajo',
    customerPortal: 'Portal del Cliente',
    signOut: 'Cerrar Sesión',
    searchPlaceholder: 'Buscar por Ticket, Teléfono, Cliente, Serial...',
    serviceCenterReady: 'Taller Preparado',
    serviceCenterDesc: 'Diagnóstico rápido, piezas originales y hojas de servicio profesionales.',

    // Statuses
    RECEIVED: 'Equipo Recibido',
    IN_DIAGNOSIS: 'En Diagnóstico',
    QUOTATION_PENDING: 'Presupuesto Pendiente',
    APPROVED: 'Aprobado por el Cliente',
    WAITING_PARTS: 'Esperando Repuestos',
    IN_REPAIR: 'Reparación en Curso',
    TESTING_QC: 'Pruebas y Control de Calidad',
    READY_FOR_PICKUP: 'Listo para Entregar',
    DELIVERED: 'Entregado / Finalizado',
    CANCELLED: 'Cancelado',

    // Settings Tabs
    account: 'Cuenta',
    identity: 'Identidad del Taller',
    backup: 'Copia de Seguridad',
    appearance: 'Apariencia y Tema',
    language: 'Idioma',
    accountDesc: 'Perfil, seguridad y personal',
    identityDesc: 'Marca del taller y términos impresos',
    backupDesc: 'Copias de base de datos y recuperación',
    appearanceDesc: 'Tema, colores y densidad',
    languageDesc: 'Idioma y formato de fecha',

    // Settings Content
    systemSettings: 'Configuración del Sistema',
    systemSettingsDesc: 'Configure la identidad del taller, cuentas del personal, copias de seguridad y lenguaje',
    changePassword: 'Cambiar Contraseña',
    staffManagement: 'Gestión de Personal',
    addStaffUser: 'Añadir Usuario de Personal',
    saveIdentity: 'Guardar Identidad del Taller',
    downloadBackup: 'Descargar Copia de Base de Datos',
    restoreBackup: 'Restaurar desde Copia',
    themeMode: 'Modo de Tema',
    accentPalette: 'Paleta de Color Principal',
    layoutDensity: 'Densidad del Diseño',
    primaryLanguage: 'Idioma Principal del Sistema',
    dateFormat: 'Formato de Fecha y Hora',
    currencyFormat: 'Formato de Moneda',
    save: 'Guardar',
    cancel: 'Cancelar',
    active: 'Activo',
    inactive: 'Inactivo',

    // Dashboard
    activeRepairs: 'Reparaciones Activas',
    readyForPickup: 'Listo para Recoger',
    revenueToday: 'Ingresos de Hoy',
    lowStockAlert: 'Artículos con Poco Stock',
    recentTickets: 'Tickets Recientes',
    quickIntake: 'Ingreso Rápido'
  }
};

export function getSavedLanguage() {
  try {
    const raw = localStorage.getItem('ssc_locale');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.language && TRANSLATIONS[parsed.language]) {
        return parsed.language;
      }
    }
  } catch {}
  return 'en';
}

export function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) lang = 'en';
  try {
    const raw = localStorage.getItem('ssc_locale');
    const existing = raw ? JSON.parse(raw) : {};
    existing.language = lang;
    localStorage.setItem('ssc_locale', JSON.stringify(existing));
  } catch {
    localStorage.setItem('ssc_locale', JSON.stringify({ language: lang }));
  }

  window.dispatchEvent(new CustomEvent('ssc-language-changed', { detail: { language: lang } }));
}

export function t(key, lang = null) {
  const currentLang = lang || getSavedLanguage();
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}

export function useTranslation() {
  const [lang, setLangState] = useState(getSavedLanguage);

  useEffect(() => {
    const handler = (e) => {
      const newLang = e.detail?.language || getSavedLanguage();
      setLangState(newLang);
    };
    window.addEventListener('ssc-language-changed', handler);
    return () => window.removeEventListener('ssc-language-changed', handler);
  }, []);

  const translate = (key) => t(key, lang);

  return {
    lang,
    setLanguage: (newLang) => {
      setLanguage(newLang);
      setLangState(newLang);
    },
    t: translate
  };
}
