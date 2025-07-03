import React, { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, Copy, Edit, Eye, FolderOpen, Info } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  visible: boolean;
}

export function ContextMenu({ x, y, items, onClose, visible }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      // Adjust horizontal position if menu would go off-screen
      if (x + rect.width > viewportWidth) {
        newX = x - rect.width;
      }

      // Adjust vertical position if menu would go off-screen
      if (y + rect.height > viewportHeight) {
        newY = y - rect.height;
      }

      // Ensure menu doesn't go off the left or top edges
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [visible, x, y]);

  // Close menu on outside click or escape key
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1 min-w-[180px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="border-t border-gray-200 my-1"
            />
          );
        }

        const IconComponent = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => {
              if (!item.disabled) {
                item.action();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
              item.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {IconComponent && (
              <IconComponent className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Hook for managing context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    items: [],
    visible: false,
  });

  const showContextMenu = (
    event: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items,
      visible: true,
    });
  };

  const hideContextMenu = () => {
    setContextMenu(prev => ({
      ...prev,
      visible: false,
    }));
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
}

// Predefined menu item creators for common actions
export const createArchiveMenuItem = (onArchive: () => void): ContextMenuItem => ({
  id: 'archive',
  label: 'Archive',
  icon: Archive,
  action: onArchive,
});

export const createRestoreMenuItem = (onRestore: () => void): ContextMenuItem => ({
  id: 'restore',
  label: 'Restore',
  icon: ArchiveRestore,
  action: onRestore,
});

export const createDeleteMenuItem = (onDelete: () => void, permanent = false): ContextMenuItem => ({
  id: 'delete',
  label: permanent ? 'Delete Permanently' : 'Delete',
  icon: Trash2,
  action: onDelete,
  danger: true,
});

export const createCopyMenuItem = (onCopy: () => void): ContextMenuItem => ({
  id: 'copy',
  label: 'Copy to Clipboard',
  icon: Copy,
  action: onCopy,
});

export const createViewMenuItem = (onView: () => void): ContextMenuItem => ({
  id: 'view',
  label: 'View',
  icon: Eye,
  action: onView,
});

export const createEditMenuItem = (onEdit: () => void): ContextMenuItem => ({
  id: 'edit',
  label: 'Edit',
  icon: Edit,
  action: onEdit,
});

export const createShowInFinderMenuItem = (onShowInFinder: () => void): ContextMenuItem => ({
  id: 'show-in-finder',
  label: 'Show in Finder',
  icon: FolderOpen,
  action: onShowInFinder,
});

export const createPropertiesMenuItem = (onProperties: () => void): ContextMenuItem => ({
  id: 'properties',
  label: 'Properties',
  icon: Info,
  action: onProperties,
});

export const createSeparator = (id = 'separator'): ContextMenuItem => ({
  id,
  label: '',
  action: () => {},
  separator: true,
});

// Helper function to create context menu items for screenshots
export function createScreenshotMenuItems(
  screenshot: any,
  callbacks: {
    onArchive?: () => void;
    onRestore?: () => void;
    onDelete?: () => void;
    onCopy?: () => void;
    onView?: () => void;
    onEdit?: () => void;
    onShowInFinder?: () => void;
    onProperties?: () => void;
  },
  isArchived = false
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // View and edit actions
  if (callbacks.onView) {
    items.push(createViewMenuItem(callbacks.onView));
  }
  
  if (callbacks.onEdit) {
    items.push(createEditMenuItem(callbacks.onEdit));
  }

  if (callbacks.onCopy) {
    items.push(createCopyMenuItem(callbacks.onCopy));
  }

  if (items.length > 0) {
    items.push(createSeparator());
  }

  // Archive/restore actions
  if (isArchived) {
    if (callbacks.onRestore) {
      items.push(createRestoreMenuItem(callbacks.onRestore));
    }
  } else {
    if (callbacks.onArchive) {
      items.push(createArchiveMenuItem(callbacks.onArchive));
    }
  }

  // File system actions
  if (callbacks.onShowInFinder) {
    items.push(createShowInFinderMenuItem(callbacks.onShowInFinder));
  }

  if (items.length > 0 && (callbacks.onDelete || callbacks.onProperties)) {
    items.push(createSeparator());
  }

  // Delete action
  if (callbacks.onDelete) {
    items.push(createDeleteMenuItem(callbacks.onDelete, isArchived));
  }

  // Properties action
  if (callbacks.onProperties) {
    items.push(createPropertiesMenuItem(callbacks.onProperties));
  }

  return items;
}