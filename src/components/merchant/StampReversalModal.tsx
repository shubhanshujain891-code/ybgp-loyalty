import React, { useState } from 'react';
import { X, Undo2, AlertCircle, RotateCw, ShieldAlert } from 'lucide-react';
import { Business, StampTransaction, User } from '../../types';
import { dbService } from '../../services/db';

interface StampReversalModalProps {
  business: Business;
  transaction: StampTransaction;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const StampReversalModal: React.FC<StampReversalModalProps> = ({
  business,
  transaction,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReverse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a specific audit reason (minimum 5 characters).');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      dbService.reverseStampTransaction({
        businessId: business.id,
        transactionId: transaction.id,
        reversalReason: reason.trim(),
        staffUser: currentUser,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reversal failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-red-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/30 text-red-200 rounded-xl">
              <Undo2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Reverse Stamp Transaction</h2>
              <p className="text-xs text-red-200">
                Tx: {transaction.id} · Customer: {transaction.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-red-800 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleReverse} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Original Stamps:</span>
              <span className="font-bold text-slate-900">+{transaction.stampsAwarded}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Awarded By:</span>
              <span className="font-medium text-slate-800">{transaction.staffName}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Time:</span>
              <span className="font-medium text-slate-800">{new Date(transaction.createdAt).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Reversal Audit Reason
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Accidental double-scan, order refunded by customer at counter"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-900 font-sans"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This reason will be permanently recorded in the immutable audit ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>Confirm Reversal</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
