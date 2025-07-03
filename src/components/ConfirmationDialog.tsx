import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Archive, Trash2, RotateCcw } from 'lucide-react';

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  itemCount?: number;
  showCheckbox?: boolean;
  checkboxText?: string;
  onCheckboxChange?: (checked: boolean) => void;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  itemCount,
  showCheckbox = false,
  checkboxText = "Don't ask again",
  onCheckboxChange
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    if (open && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Enter') {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-orange-600" />;
      case 'info':
      default:
        return <Archive className="w-6 h-6 text-blue-600" />;
    }
  };

  const getButtonStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'warning':
        return 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500';
      case 'info':
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10">
              {getIcon()}
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {message}
                  {itemCount && itemCount > 1 && (
                    <span className="font-medium"> ({itemCount} items)</span>
                  )}
                </p>
              </div>
              
              {/* Optional checkbox */}
              {showCheckbox && (
                <div className="mt-4">
                  <label className="flex items-center text-sm text-gray-600">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      onChange={(e) => onCheckboxChange?.(e.target.checked)}
                    />
                    {checkboxText}
                  </label>
                </div>
              )}
            </div>
          </div>
          
          {/* Buttons */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              ref={confirmButtonRef}
              type="button"
              className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors sm:ml-3 sm:w-auto ${getButtonStyles()} focus:outline-none focus:ring-2 focus:ring-offset-2`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onClose}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing confirmation dialogs
export function useConfirmationDialog() {
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'warning' | 'danger' | 'info';
    confirmText?: string;
    cancelText?: string;
    itemCount?: number;
    showCheckbox?: boolean;
    checkboxText?: string;
    onCheckboxChange?: (checked: boolean) => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirmation = (options: typeof dialog) => {
    setDialog({ ...options, open: true });
  };

  const hideConfirmation = () => {
    setDialog(prev => ({ ...prev, open: false }));
  };

  const confirmAndClose = () => {
    dialog.onConfirm();
    hideConfirmation();
  };

  return {
    dialog,
    showConfirmation,
    hideConfirmation,
    confirmAndClose,
  };
}

// Helper functions for common confirmation dialogs
export function createArchiveConfirmation(
  itemCount: number,
  onConfirm: () => void,
  showCheckbox?: boolean,
  onCheckboxChange?: (checked: boolean) => void
) {
  return {
    title: `Archive ${itemCount === 1 ? 'Screenshot' : 'Screenshots'}`,
    message: `Are you sure you want to archive ${itemCount === 1 ? 'this screenshot' : `${itemCount} screenshots`}? ${itemCount === 1 ? 'It' : 'They'} will be moved to the archive folder and can be restored later.`,
    confirmText: 'Archive',
    type: 'info' as const,
    itemCount,
    onConfirm,
    showCheckbox,
    checkboxText: "Don't ask again for archive operations",
    onCheckboxChange,
  };
}

export function createDeleteConfirmation(
  itemCount: number,
  onConfirm: () => void,
  permanent = false,
  showCheckbox?: boolean,
  onCheckboxChange?: (checked: boolean) => void
) {
  const action = permanent ? 'permanently delete' : 'delete';
  const warning = permanent 
    ? 'This action cannot be undone.' 
    : `${itemCount === 1 ? 'It' : 'They'} will be moved to the system trash.`;

  return {
    title: `${permanent ? 'Permanently Delete' : 'Delete'} ${itemCount === 1 ? 'Screenshot' : 'Screenshots'}`,
    message: `Are you sure you want to ${action} ${itemCount === 1 ? 'this screenshot' : `${itemCount} screenshots`}? ${warning}`,
    confirmText: permanent ? 'Delete Permanently' : 'Delete',
    type: 'danger' as const,
    itemCount,
    onConfirm,
    showCheckbox,
    checkboxText: `Don't ask again for ${permanent ? 'permanent ' : ''}delete operations`,
    onCheckboxChange,
  };
}

export function createRestoreConfirmation(
  itemCount: number,
  onConfirm: () => void
) {
  return {
    title: `Restore ${itemCount === 1 ? 'Screenshot' : 'Screenshots'}`,
    message: `Are you sure you want to restore ${itemCount === 1 ? 'this screenshot' : `${itemCount} screenshots`} from the archive? ${itemCount === 1 ? 'It' : 'They'} will be moved back to the main screenshots folder.`,
    confirmText: 'Restore',
    type: 'info' as const,
    itemCount,
    onConfirm,
  };
}