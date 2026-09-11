import { FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'confirm',
  cancelLabel = 'cancel',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm rounded-2xl p-6 bg-white dark:bg-[#151922] border border-gray-200 dark:border-gray-800 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    danger
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}
                >
                  {danger ? <AlertTriangle size={18} /> : <Trash2 size={18} />}
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 lowercase">
                  {title}
                </h3>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="close modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed lowercase">
              {message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors lowercase"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-medium rounded-xl transition-all lowercase ${
                  danger
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
