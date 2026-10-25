import { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { DashboardScreen } from './components/DashboardScreen.tsx';
import { UploadIngestionScreen } from './components/UploadIngestionScreen.tsx';
import { LedgerListScreen } from './components/LedgerListScreen.tsx';
import { SettingsScreen } from './components/SettingsScreen.tsx';
import { AbaVerifyScreen } from './components/AbaVerifyScreen.tsx';
import { TransactionDetailModal } from './components/TransactionDetailModal.tsx';
import { TransactionEditModal } from './components/TransactionEditModal.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_SETTINGS,
  INITIAL_NOTIFICATIONS,
} from './data/mockData.ts';
import { Transaction, AppSettings, AppNotification } from './types.ts';
import { useAuth } from './context/AuthContext.tsx';

export default function App() {
  const { currentUser, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('khema_user_settings');
      if (saved) return { ...INITIAL_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return INITIAL_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('khema_user_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('khema_user_transactions');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('khema_user_transactions', JSON.stringify(transactions));
    } catch (e) {}
  }, [transactions]);

  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [incomingUploadFile, setIncomingUploadFile] = useState<File | null>(null);

  // Clear all transactions completely (Reset to 0)
  const handleClearAllTransactions = async () => {
    if (window.confirm('តើអ្នកពិតជាចង់សម្អាត និងលុបប្រវត្តិប្រតិបត្តិការទាំងអស់មែនទេ? (ចំណូល និងចំណាយ នឹងក្លាយជា $0.00)')) {
      setTransactions([]);
      try {
        localStorage.setItem('khema_user_transactions', JSON.stringify([]));
      } catch (e) {}
      try {
        await fetch('/api/clear-all-transactions', { method: 'POST' });
      } catch (e) {}
    }
  };

  // Sync transactions from server (shared across all devices)
  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setTransactions(data.data);
          try {
            localStorage.setItem('khema_user_transactions', JSON.stringify(data.data));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Could not load server transactions:', e);
    }
  };

  // Auto-refresh every 10 seconds so mobile phone & desktop stay in sync with the exact same data
  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(() => {
      fetchTransactions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch shared Google Sheet webhook configuration from server
  useEffect(() => {
    fetch('/api/google-sheet-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.webhookUrl) {
          setSettings((prev) => ({
            ...prev,
            googleSheetWebhookUrl: data.webhookUrl,
            googleSheetUrl: data.sheetUrl || prev.googleSheetUrl,
          }));
        }
      })
      .catch((e) => console.warn('Could not load google sheet config:', e));
  }, []);

  // Unread notifications count
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  // Add newly scanned transaction (put at the very TOP)
  const handleSaveTransaction = async (newTx: Transaction) => {
    // Put at index 0 immediately so it is easily examined on top
    setTransactions((prev) => [newTx, ...prev]);

    // Save to real Excel backend and Google Sheets
    try {
      await fetch('/api/save-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTx,
          googleSheetWebhookUrl: settings.googleSheetAutoSync !== false ? settings.googleSheetWebhookUrl : undefined,
        }),
      });
      fetchTransactions();
    } catch (err) {
      console.error('Failed to save to Excel:', err);
    }

    // Switch view to Ledger list immediately so user can easily review the top entry!
    setCurrentTab('ledger-list');

    // Create notification
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'បានកត់ត្រាវិក្កយបត្រថ្មី',
      message: `${newTx.vendor} ($${newTx.amountUSD.toFixed(2)}) ត្រូវបានដាក់នៅខាងលើគេបង្អស់។`,
      time: 'ទើបតែឥឡូវនេះ',
      read: false,
      type: 'ai',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Add batch of scanned transactions (put at the very TOP)
  const handleSaveBatchTransactions = (txs: Transaction[]) => {
    setTransactions((prev) => [...txs, ...prev]);

    // Switch view to Ledger list immediately so user can easily review the top entries!
    setCurrentTab('ledger-list');

    // Create notification
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'បានកត់ត្រាវិក្កយបត្រថ្មី (Multi-Scan)',
      message: `វិក្កយបត្រថ្មីចំនួន ${txs.length} ត្រូវបានដាក់បញ្ចូលក្នុងតារាងជោគជ័យ។`,
      time: 'ទើបតែឥឡូវនេះ',
      read: false,
      type: 'ai',
    };
    setNotifications((prev) => [newNotif, ...prev]);
    fetchTransactions();
  };

  // Update existing transaction
  const handleUpdateTransaction = async (updated: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    if (selectedTransaction?.id === updated.id) {
      setSelectedTransaction(updated);
    }

    try {
      await fetch('/api/update-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          entryNo: updated.entryNo,
          jvNo: updated.jvNo || updated.ref,
          vendor: updated.vendor,
          vendorKh: updated.vendorKh,
          category: updated.category,
          date: updated.date,
          amountUSD: updated.amountUSD,
          amountKHR: updated.amountKHR,
          status: updated.status,
        }),
      });
      fetchTransactions();
    } catch (err) {
      console.error('Failed to update Excel transaction:', err);
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string, entryNo?: number, jvNo?: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (selectedTransaction?.id === id) {
      setSelectedTransaction(null);
    }

    try {
      await fetch('/api/delete-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          entryNo,
          jvNo,
        }),
      });
    } catch (err) {
      console.warn('Could not sync deletion with Excel backend:', err);
    }
  };

  // Toggle status (paid / pending)
  const handleToggleStatus = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus: 'paid' | 'pending' = t.status === 'paid' ? 'pending' : 'paid';
          const updated = {
            ...t,
            status: nextStatus,
            statusTextKh: nextStatus === 'paid' ? 'បានបង់' : 'ជំពាក់',
          };
          // Also persist status update to backend Excel
          fetch('/api/update-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: updated.id,
              entryNo: updated.entryNo,
              jvNo: updated.jvNo || updated.ref,
              status: nextStatus,
            }),
          }).catch(console.error);

          return updated;
        }
        return t;
      })
    );
    if (selectedTransaction && selectedTransaction.id === id) {
      const nextStatus = selectedTransaction.status === 'paid' ? 'pending' : 'paid';
      setSelectedTransaction({
        ...selectedTransaction,
        status: nextStatus,
        statusTextKh: nextStatus === 'paid' ? 'បានបង់' : 'ជំពាក់',
      });
    }
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Navigation helpers
  const handleNavigateToUpload = (file?: File) => {
    if (file) {
      setIncomingUploadFile(file);
    } else {
      setIncomingUploadFile(null);
    }
    setCurrentTab('upload-ingestion');
  };

  const handleNavigateToLedger = () => {
    setCurrentTab('ledger-list');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col selection:bg-secondary/20 selection:text-secondary w-full">
      {/* Container: 100% full-width on mobile phone & responsive wide view on computer */}
      <div className="w-full min-h-screen flex flex-col relative">
        {/* Top Sticky Header */}
        <Header
          currentTab={currentTab}
          unreadNotifsCount={unreadNotifsCount}
          userAvatar={settings.userAvatar}
          onTabChange={(tab) => setCurrentTab(tab)}
          onOpenNotifications={() => setShowNotifications(true)}
          onGoToSettings={() => setCurrentTab('settings')}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative w-full pt-16 bg-surface">
          <div className="w-full max-w-[1600px] mx-auto flex flex-col flex-1">
            {currentTab === 'dashboard' && (
              <DashboardScreen
                transactions={transactions}
                settings={settings}
                onNavigateToUpload={handleNavigateToUpload}
                onNavigateToLedger={handleNavigateToLedger}
                onSelectTransaction={(tx) => setSelectedTransaction(tx)}
              />
            )}

            {currentTab === 'aba-verify' && <AbaVerifyScreen />}

            {currentTab === 'upload-ingestion' && (
              <UploadIngestionScreen
                settings={settings}
                onSaveTransaction={handleSaveTransaction}
                onSaveBatchTransactions={handleSaveBatchTransactions}
                initialFile={incomingUploadFile}
              />
            )}

            {currentTab === 'ledger-list' && (
              <LedgerListScreen
                transactions={transactions}
                settings={settings}
                onSelectTransaction={(tx) => setSelectedTransaction(tx)}
                onEditTransaction={(tx) => setEditingTransaction(tx)}
                onDeleteTransaction={handleDeleteTransaction}
                onClearAll={handleClearAllTransactions}
                onRefresh={fetchTransactions}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsScreen
                settings={settings}
                transactions={transactions}
                onUpdateSettings={handleUpdateSettings}
                onClearAll={handleClearAllTransactions}
                onLogout={logout}
              />
            )}
          </div>
        </main>

        {/* Bottom Fixed Navigation Bar (Mobile only) */}
        <BottomNav currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)} />

        {/* Detailed Transaction Modal */}
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onToggleStatus={handleToggleStatus}
          onEdit={(tx) => setEditingTransaction(tx)}
          onDelete={(id) =>
            handleDeleteTransaction(
              id,
              selectedTransaction?.entryNo,
              selectedTransaction?.jvNo || selectedTransaction?.ref
            )
          }
        />

        {/* Edit Transaction Modal */}
        <TransactionEditModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleUpdateTransaction}
          onDelete={handleDeleteTransaction}
        />

        {/* Notifications Modal */}
        <NotificationsModal
          notifications={notifications}
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllAsRead={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          }}
          onClear={() => setNotifications([])}
        />
      </div>
    </div>
  );
}
