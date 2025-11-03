/**
 * ContactPillManager - Multi-select contact picker with inline editing
 *
 * Features:
 * - Multi-select contacts (unlike single-select TopicPillManager)
 * - Inline editable pill display with individual remove buttons
 * - Dropdown with search/filter by name or role
 * - Empty state with "+ Add contacts" prompt
 * - Keyboard accessible (ESC to close, Enter to toggle selection)
 * - Glass morphism design consistent with TopicPillManager
 *
 * Key Differences from TopicPillManager:
 * - Accepts `contactIds: string[]` instead of single `topicId`
 * - Displays multiple pills, each with remove button
 * - Dropdown allows multi-select via checkboxes
 * - Shows contact role if available: "John Smith (CEO)"
 *
 * @module components/ContactPillManager
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, User, ChevronDown } from 'lucide-react';
import { getRadiusClass, TRANSITIONS, Z_INDEX } from '../design-system/theme';
import type { Contact } from '../types';

export interface ContactPillManagerProps {
  /** Current contact IDs (multi-select) */
  contactIds: string[];

  /** Callback when contacts change */
  onContactsChange: (contactIds: string[]) => void;

  /** All available contacts */
  allContacts: Contact[];

  /** Can user edit? */
  editable: boolean;

  /** Optional CSS classes */
  className?: string;

  /** Optional callback when a new contact is created */
  onCreateContact?: (name: string) => Promise<Contact>;
}

/**
 * ContactPillManager component
 */
export function ContactPillManager({
  contactIds,
  onContactsChange,
  allContacts,
  editable,
  className = '',
  onCreateContact,
}: ContactPillManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current contacts (memoized to prevent unnecessary recalculations)
  const currentContacts = useMemo(() => {
    return contactIds
      .map(id => allContacts.find(c => c.id === id))
      .filter((c): c is Contact => c !== undefined);
  }, [contactIds, allContacts]);

  // Filter contacts by search query (name or role, exclude already selected)
  const filteredContacts = useMemo(() => {
    const available = allContacts.filter(c => !contactIds.includes(c.id));

    if (!searchQuery) return available;

    const query = searchQuery.toLowerCase();
    return available.filter(contact => {
      const nameMatch = contact.name.toLowerCase().includes(query);
      const roleMatch = contact.profile?.role?.toLowerCase().includes(query);
      return nameMatch || roleMatch;
    });
  }, [searchQuery, allContacts, contactIds]);

  // Check if search query matches an existing contact (for create prompt)
  const exactMatch = useMemo(() => {
    return allContacts.some(c =>
      c.name.toLowerCase() === searchQuery.toLowerCase()
    );
  }, [searchQuery, allContacts]);

  const showCreatePrompt = searchQuery.trim().length > 0 && !exactMatch && onCreateContact;

  // Check if contact is selected
  const isSelected = useCallback((contactId: string): boolean => {
    return contactIds.includes(contactId);
  }, [contactIds]);

  // Calculate dropdown position when entering edit mode
  useEffect(() => {
    if (isEditing && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isEditing) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // Handle contact toggle (add or remove)
  const handleToggleContact = useCallback((contact: Contact) => {
    if (isSelected(contact.id)) {
      // Remove contact
      onContactsChange(contactIds.filter(id => id !== contact.id));
    } else {
      // Add contact
      onContactsChange([...contactIds, contact.id]);
    }
  }, [contactIds, onContactsChange, isSelected]);

  // Handle contact removal (from pill)
  const handleRemoveContact = useCallback((e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    onContactsChange(contactIds.filter(id => id !== contactId));
  }, [contactIds, onContactsChange]);

  // Handle create new contact
  const handleCreateContact = useCallback(async () => {
    if (!onCreateContact || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newContact = await onCreateContact(searchQuery.trim());
      // Add the new contact to selection
      onContactsChange([...contactIds, newContact.id]);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to create contact:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsCreating(false);
    }
  }, [onCreateContact, searchQuery, isCreating, contactIds, onContactsChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && showCreatePrompt && !isCreating) {
      e.preventDefault();
      handleCreateContact();
    }
  }, [showCreatePrompt, isCreating, handleCreateContact]);

  // Format contact display name with role
  const formatContactName = (contact: Contact): string => {
    if (contact.profile?.role) {
      return `${contact.name} (${contact.profile.role})`;
    }
    return contact.name;
  };

  // Format contact dropdown display with role and company
  const formatContactDropdown = (contact: Contact): React.ReactElement => {
    return (
      <div className="flex flex-col">
        <span className="font-medium">{contact.name}</span>
        {contact.profile?.role && (
          <span className="text-xs text-gray-500">
            {contact.profile.role}
          </span>
        )}
      </div>
    );
  };

  // Render contact pills
  const renderContactPills = () => {
    if (currentContacts.length === 0) {
      // Empty state
      return (
        <button
          onClick={() => editable && setIsEditing(true)}
          disabled={!editable}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5
            bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-purple-400
            ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-purple-700 font-medium
            ${TRANSITIONS.fast}
            ${editable ? 'cursor-pointer' : 'cursor-default'}
            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1
          `}
          aria-label="Add contacts"
        >
          <Plus size={12} />
          <span>Add contacts</span>
        </button>
      );
    }

    // Render selected contacts as pills
    return (
      <div className="inline-flex flex-wrap gap-1.5">
        {currentContacts.map(contact => (
          <div
            key={contact.id}
            className={`
              group
              inline-flex items-center gap-1.5 px-3 py-1.5
              bg-gradient-to-r from-purple-100/80 to-violet-100/80 border border-purple-300/60
              ${getRadiusClass('pill')} text-xs font-semibold text-purple-800
              ${TRANSITIONS.fast}
              ${editable ? 'hover:from-purple-200/90 hover:to-violet-200/90 cursor-pointer' : ''}
            `}
            onClick={() => editable && setIsEditing(true)}
            role="button"
            tabIndex={editable ? 0 : -1}
            aria-label={`Contact: ${formatContactName(contact)}. ${editable ? 'Click to edit.' : ''}`}
          >
            <User size={12} className="opacity-70" />
            <span>{formatContactName(contact)}</span>
            {editable && (
              <button
                onClick={(e) => handleRemoveContact(e, contact.id)}
                className="opacity-0 group-hover:opacity-100 hover:bg-purple-900/10 rounded-full p-0.5 transition-opacity"
                aria-label={`Remove ${contact.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {editable && (
          <button
            onClick={() => setIsEditing(true)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5
              bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-purple-400
              ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-purple-700 font-medium
              ${TRANSITIONS.fast}
              cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1
            `}
            aria-label="Add more contacts"
          >
            <Plus size={12} />
            <ChevronDown size={12} className="opacity-60" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`relative inline-block overflow-visible ${className}`} ref={triggerRef}>
      {/* Contact Pills */}
      {renderContactPills()}

      {/* Dropdown (when editing) - Rendered via Portal */}
      {isEditing && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: `${Math.max(dropdownPosition.width, 288)}px`,
            zIndex: 9999,
          }}
          className={`
            max-h-96 overflow-y-auto
            bg-white border border-gray-200 shadow-lg ${getRadiusClass('field')}
          `}
          role="listbox"
          aria-label="Select contacts"
          aria-multiselectable="true"
        >
          {/* Search input */}
          <div className="sticky top-0 bg-white p-2 border-b border-gray-100 z-10">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create contact..."
              className={`
                w-full px-3 py-2 text-sm border border-gray-200 ${getRadiusClass('element')}
                focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400
              `}
              aria-label="Search contacts"
            />
          </div>

          {/* Create new contact prompt */}
          {showCreatePrompt && (
            <div className="p-2 border-b border-gray-100 bg-purple-50/50">
              <button
                onClick={handleCreateContact}
                disabled={isCreating}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                  bg-gradient-to-r from-purple-500 to-violet-500 text-white
                  ${getRadiusClass('element')}
                  hover:from-purple-600 hover:to-violet-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${TRANSITIONS.fast}
                `}
                aria-label={`Create new contact: ${searchQuery}`}
              >
                <Plus size={14} />
                <span>{isCreating ? 'Creating...' : `Create "${searchQuery}"`}</span>
              </button>
            </div>
          )}

          {/* Selected contacts section */}
          {currentContacts.length > 0 && (
            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
              <div className="text-xs font-semibold text-gray-600 mb-2 px-1">
                Selected ({currentContacts.length})
              </div>
              {currentContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleToggleContact(contact)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left text-sm
                    bg-purple-100 text-purple-900 font-semibold
                    ${getRadiusClass('element')} mb-1
                    hover:bg-purple-200
                    ${TRANSITIONS.fast}
                  `}
                  role="option"
                  aria-selected={true}
                >
                  <span className="flex items-center gap-2">
                    <User size={14} />
                    {formatContactName(contact)}
                    {contact.noteCount > 0 && (
                      <span className="text-xs text-purple-700">
                        ({contact.noteCount} notes)
                      </span>
                    )}
                  </span>
                  <X size={14} />
                </button>
              ))}
            </div>
          )}

          {/* Available contacts list */}
          <div className="py-1">
            {filteredContacts.length === 0 && !showCreatePrompt ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? 'No contacts found' : 'All contacts selected'}
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleToggleContact(contact)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left text-sm
                    hover:bg-purple-50
                    ${TRANSITIONS.fast}
                  `}
                  role="option"
                  aria-selected={false}
                >
                  <span className="flex-1 min-w-0">
                    {formatContactDropdown(contact)}
                    {contact.noteCount > 0 && (
                      <span className="text-xs text-gray-400 mt-0.5 block">
                        {contact.noteCount} {contact.noteCount === 1 ? 'note' : 'notes'}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <User size={14} className="text-purple-400" />
                    <Plus size={14} className="text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ContactPillManager;
