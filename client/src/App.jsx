import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import NewTicketModal from './components/NewTicketModal';
import PrintJobCard from './components/PrintJobCard';
import PrintInvoice from './components/PrintInvoice';

import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import KanbanBoard from './pages/KanbanBoard';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Technicians from './pages/Technicians';
import PublicTrack from './pages/PublicTrack';
import Settings from './pages/Settings';
import Login from './pages/Login';
import MainLogin from './pages/MainLogin';

import { Wrench, LayoutDashboard, Ticket, Kanban, Receipt, Menu, Boxes } from 'lucide-react';
import { api } from './api';
import { applyAppearance } from './utils/theme';

export default function App() {
  const [masterUser, setMasterUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketInitialAction, setTicketInitialAction] = useState(null);
  const [invoicePreselectTicketId, setInvoicePreselectTicketId] = useState(null);
  const [invoicePreselectInvoiceId, setInvoicePreselectInvoiceId] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals & Print Previews
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [printTicketData, setPrintTicketData] = useState(null);
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [shopSettings, setShopSettings] = useState({});

  // Summary Metrics for Sidebar badges
  const [metrics, setMetrics] = useState({ activeRepairs: 0, lowStockCount: 0 });

  // Initial Auth & Theme Check
  useEffect(() => {
    applyAppearance();
    checkAuth();

    const handleThemeChange = () => {
      applyAppearance();
    };
    window.addEventListener('ssc-appearance-changed', handleThemeChange);
    return () => window.removeEventListener('ssc-appearance-changed', handleThemeChange);
  }, []);

  const checkAuth = async () => {
    try {
      // Step 1: Check master session (Main Login gateway)
      const masterRes = await api.getMasterMe();
      if (masterRes && masterRes.masterUser) {
        setMasterUser(masterRes.masterUser);

        // Step 2: Check staff session (only if master is valid)
        try {
          const staffRes = await api.getMe();
          if (staffRes && staffRes.user) {
            setCurrentUser(staffRes.user);
          } else {
            setCurrentUser(null);
          }
        } catch (err) {
          setCurrentUser(null);
        }
      } else {
        setMasterUser(null);
        setCurrentUser(null);
      }
    } catch (err) {
      setMasterUser(null);
      setCurrentUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleMasterLogin = async (credentials) => {
    const data = await api.masterLogin(credentials);
    setMasterUser(data.masterUser);
    setCurrentTab('dashboard');
  };

  const handleLogin = async (credentials) => {
    const data = await api.login(credentials);
    setCurrentUser(data.user);
    setCurrentTab('dashboard');
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out from staff portal?')) {
      await api.logout();
      setCurrentUser(null);
      setCurrentTab('dashboard');
    }
  };

  const handleMasterLogout = async () => {
    if (window.confirm('Are you sure you want to sign out completely? This will end your main session.')) {
      await api.masterLogout();
      setMasterUser(null);
      setCurrentUser(null);
      setCurrentTab('dashboard');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMetrics();
    }
  }, [currentTab, currentUser]);

  // Redirect technician and frontdesk roles away from restricted tabs
  useEffect(() => {
    if (currentUser?.role === 'technician' && (currentTab === 'customers' || currentTab === 'technicians' || currentTab === 'invoices')) {
      setCurrentTab('dashboard');
    }
    if (currentUser?.role === 'frontdesk' && currentTab === 'technicians') {
      setCurrentTab('dashboard');
    }
  }, [currentUser, currentTab]);

  const loadMetrics = async () => {
    try {
      const [dash, settings] = await Promise.all([
        api.getDashboard(),
        api.getSettings()
      ]);
      setMetrics({
        activeRepairs: dash.activeRepairs || 0,
        lowStockCount: (dash.lowStockItems || []).length
      });
      setShopSettings(settings || {});
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  // Ticket selection
  const handleSelectTicket = (id, action = null) => {
    setSelectedTicketId(id);
    setTicketInitialAction(action);
    setCurrentTab('ticket-detail');
  };

  // Trigger Print Job Card
  const handlePrintJobCard = async (ticketId) => {
    try {
      const data = await api.getTicket(ticketId);
      const settings = await api.getSettings();
      setPrintTicketData(data);
      setShopSettings(settings);
    } catch (err) {
      alert('Failed to load ticket for printing: ' + err.message);
    }
  };

  // Trigger Print Invoice
  const handlePrintInvoice = async (invoiceId) => {
    try {
      const data = await api.getInvoice(invoiceId);
      setPrintInvoiceData(data);
    } catch (err) {
      alert('Failed to load invoice for printing: ' + err.message);
    }
  };

  // Direct invoice generation from ticket
  const handleGenerateInvoiceFromTicket = (ticketId) => {
    setInvoicePreselectTicketId(ticketId);
    setInvoicePreselectInvoiceId(null);
    setCurrentTab('invoices');
  };

  // Global search from Navbar
  const handleGlobalSearch = (query) => {
    setCurrentTab('tickets');
  };

  // Loading screen during initial token verification
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30 text-white mb-4 animate-pulse">
          <Wrench className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading SSC TechCare Station...</p>
      </div>
    );
  }

  // ========== TIER 1: Main Login (email + password gateway) ==========
  if (!masterUser) {
    if (currentTab === 'track') {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full">
            <PublicTrack onBackToLogin={() => setCurrentTab('login')} isLoggedIn={false} />
          </div>
        </div>
      );
    }

    return (
      <MainLogin
        onLoginSuccess={handleMasterLogin}
        onGoToTracker={() => setCurrentTab('track')}
      />
    );
  }

  // ========== TIER 2: Staff Login (username + password) ==========
  if (!currentUser) {
    if (currentTab === 'track') {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full">
            <PublicTrack onBackToLogin={() => setCurrentTab('login')} isLoggedIn={false} />
          </div>
        </div>
      );
    }

    return (
      <Login
        onLoginSuccess={handleLogin}
        onGoToTracker={() => setCurrentTab('track')}
        onMasterLogout={handleMasterLogout}
        masterUser={masterUser}
      />
    );
  }

  const handleNavigate = (tab, params) => {
    if (tab === 'invoices') {
      if (params?.ticketId) {
        setInvoicePreselectTicketId(params.ticketId);
        setInvoicePreselectInvoiceId(null);
      } else if (params?.invoiceId) {
        setInvoicePreselectInvoiceId(params.invoiceId);
        setInvoicePreselectTicketId(null);
      }
      setCurrentTab('invoices');
      return;
    }
    if (params?.ticketId) {
      handleSelectTicket(params.ticketId);
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenNewTicket={() => setIsNewTicketOpen(true)}
        onSearch={handleGlobalSearch}
        onNavigate={tab => {
          setSelectedTicketId(null);
          setCurrentTab(tab);
          setIsMobileSidebarOpen(false);
        }}
        currentUser={currentUser}
        masterUser={masterUser}
        onLogout={handleLogout}
        onMasterLogout={handleMasterLogout}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => {
            setSelectedTicketId(null);
            setCurrentTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          metrics={metrics}
          currentUser={currentUser}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full min-w-0">
          {currentTab === 'dashboard' && (
            <Dashboard
              onSelectTicket={handleSelectTicket}
              onOpenNewTicket={() => setIsNewTicketOpen(true)}
              onNavigate={handleNavigate}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'tickets' && (
            <Tickets
              onSelectTicket={handleSelectTicket}
              onOpenNewTicket={() => setIsNewTicketOpen(true)}
              onPrintJobCard={handlePrintJobCard}
            />
          )}

          {currentTab === 'ticket-detail' && selectedTicketId && (
            <TicketDetail
              ticketId={selectedTicketId}
              onBack={() => {
                setSelectedTicketId(null);
                setTicketInitialAction(null);
                setCurrentTab('tickets');
              }}
              onPrintJobCard={handlePrintJobCard}
              onGenerateInvoice={handleGenerateInvoiceFromTicket}
              onViewInvoice={handlePrintInvoice}
              currentUser={currentUser}
              initialAction={ticketInitialAction}
              onClearAction={() => setTicketInitialAction(null)}
            />
          )}

          {currentTab === 'kanban' && (
            <KanbanBoard
              onSelectTicket={handleSelectTicket}
              onOpenNewTicket={() => setIsNewTicketOpen(true)}
            />
          )}

          {currentTab === 'inventory' && (
            <Inventory />
          )}

          {currentTab === 'customers' && currentUser?.role !== 'technician' && (
            <Customers
              onSelectTicket={handleSelectTicket}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'invoices' && currentUser?.role !== 'technician' && (
            <Invoices
              preselectedTicketId={invoicePreselectTicketId}
              preselectedInvoiceId={invoicePreselectInvoiceId}
              onClearPreselect={() => {
                setInvoicePreselectTicketId(null);
                setInvoicePreselectInvoiceId(null);
              }}
              onPrintInvoice={handlePrintInvoice}
              onSelectTicket={handleSelectTicket}
            />
          )}

          {currentTab === 'technicians' && currentUser?.role === 'admin' && (
            <Technicians
              onSelectTicket={handleSelectTicket}
            />
          )}

          {currentTab === 'track' && (
            <PublicTrack
              onBackToLogin={() => setCurrentTab('dashboard')}
              isLoggedIn={true}
            />
          )}

          {currentTab === 'settings' && (
            <Settings currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around pb-safe shadow-lg">
        <button
          onClick={() => {
            setSelectedTicketId(null);
            setCurrentTab('dashboard');
            setIsMobileSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'dashboard' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Dashboard</span>
        </button>

        <button
          onClick={() => {
            setSelectedTicketId(null);
            setCurrentTab('tickets');
            setIsMobileSidebarOpen(false);
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'tickets' || currentTab === 'ticket-detail' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ticket className="w-5 h-5" />
          {metrics.activeRepairs > 0 && (
            <span className="absolute top-0 right-1 px-1.5 py-0.2 bg-sky-500 text-white rounded-full text-[9px] font-bold">
              {metrics.activeRepairs}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Tickets</span>
        </button>

        <button
          onClick={() => {
            setSelectedTicketId(null);
            setCurrentTab('kanban');
            setIsMobileSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'kanban' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Kanban className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Workflow</span>
        </button>

        {currentUser?.role === 'technician' ? (
          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentTab('inventory');
              setIsMobileSidebarOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              currentTab === 'inventory' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Parts</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentTab('invoices');
              setIsMobileSidebarOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              currentTab === 'invoices' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Invoices</span>
          </button>
        )}

        <button
          onClick={() => setIsMobileSidebarOpen(prev => !prev)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            isMobileSidebarOpen ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </nav>

      {/* Intake / New Repair Ticket Modal */}
      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSuccess={(created) => {
          loadMetrics();
          handleSelectTicket(created.id);
        }}
      />

      {/* Print Job Sheet A4 Modal */}
      {printTicketData && (
        <PrintJobCard
          ticket={printTicketData}
          shopSettings={shopSettings}
          onClose={() => setPrintTicketData(null)}
        />
      )}

      {/* Print Tax Invoice A4 Modal */}
      {printInvoiceData && (
        <PrintInvoice
          invoice={printInvoiceData}
          onClose={() => setPrintInvoiceData(null)}
        />
      )}
    </div>
  );
}
