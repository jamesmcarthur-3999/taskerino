/**
 * CompanyPillManager - Multi-select company picker with inline editing
 *
 * Features:
 * - Multi-select companies (tasks/notes can have multiple companies)
 * - Inline editable pill display
 * - Dropdown with autocomplete/filter
 * - Create new company on the fly
 * - Empty state with "+ Add companies" prompt
 * - Keyboard accessible
 * - Glass morphism design
 *
 * @module components/CompanyPillManager
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Building2, ChevronDown } from 'lucide-react';
import { getRadiusClass, TRANSITIONS, ENTITY_GRADIENTS, Z_INDEX } from '../design-system/theme';
import type { Company } from '../types';

export interface CompanyPillManagerProps {
  /** Current company IDs (multi-select) */
  companyIds: string[];

  /** Callback when companies change */
  onCompaniesChange: (companyIds: string[]) => void;

  /** All available companies */
  allCompanies: Company[];

  /** Can user edit? */
  editable: boolean;

  /** Optional custom CSS classes */
  className?: string;

  /** Optional callback when a new company is created */
  onCreateCompany?: (name: string) => Promise<Company>;
}

/**
 * CompanyPillManager component
 */
export function CompanyPillManager({
  companyIds,
  onCompaniesChange,
  allCompanies,
  editable,
  className = '',
  onCreateCompany,
}: CompanyPillManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current companies
  const selectedCompanies = allCompanies.filter(c => companyIds.includes(c.id));

  // Filter companies by search query (exclude already selected)
  const filteredCompanies = searchQuery
    ? allCompanies.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !companyIds.includes(c.id)
      )
    : allCompanies.filter(c => !companyIds.includes(c.id));

  // Check if search query matches an existing company (for create prompt)
  const exactMatch = allCompanies.some(c =>
    c.name.toLowerCase() === searchQuery.toLowerCase()
  );
  const showCreatePrompt = searchQuery.trim().length > 0 && !exactMatch && onCreateCompany;

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

  // Handle company toggle (add or remove)
  const handleToggleCompany = useCallback((company: Company) => {
    if (companyIds.includes(company.id)) {
      // Remove
      onCompaniesChange(companyIds.filter(id => id !== company.id));
    } else {
      // Add
      onCompaniesChange([...companyIds, company.id]);
    }
  }, [companyIds, onCompaniesChange]);

  // Handle company removal from pill
  const handleRemoveCompany = useCallback((e: React.MouseEvent, companyId: string) => {
    e.stopPropagation();
    onCompaniesChange(companyIds.filter(id => id !== companyId));
  }, [companyIds, onCompaniesChange]);

  // Handle create new company
  const handleCreateCompany = useCallback(async () => {
    if (!onCreateCompany || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newCompany = await onCreateCompany(searchQuery.trim());
      // Add the new company to selection
      onCompaniesChange([...companyIds, newCompany.id]);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to create company:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsCreating(false);
    }
  }, [onCreateCompany, searchQuery, isCreating, companyIds, onCompaniesChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && showCreatePrompt && !isCreating) {
      e.preventDefault();
      handleCreateCompany();
    }
  }, [showCreatePrompt, isCreating, handleCreateCompany]);

  // Render company pills (selected companies)
  const renderCompanyPills = () => {
    if (selectedCompanies.length === 0) {
      // Empty state
      return (
        <button
          onClick={() => editable && setIsEditing(true)}
          disabled={!editable}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5
            bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-cyan-400
            ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-cyan-700 font-medium
            ${TRANSITIONS.fast}
            ${editable ? 'cursor-pointer' : 'cursor-default'}
            focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1
          `}
          aria-label="Add companies"
        >
          <Plus size={12} />
          <span>Add companies</span>
        </button>
      );
    }

    // Render selected companies as pills
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        {selectedCompanies.map((company) => (
          <div
            key={company.id}
            className={`
              group
              inline-flex items-center gap-1.5 px-3 py-1.5
              bg-gradient-to-r ${ENTITY_GRADIENTS.company.from} ${ENTITY_GRADIENTS.company.to}
              border ${ENTITY_GRADIENTS.company.border}
              ${getRadiusClass('pill')} text-xs font-semibold ${ENTITY_GRADIENTS.company.text}
              ${TRANSITIONS.fast}
              ${editable ? 'hover:shadow-md cursor-pointer' : ''}
            `}
            onClick={() => editable && setIsEditing(true)}
            role="button"
            tabIndex={editable ? 0 : -1}
            aria-label={`Company: ${company.name}. ${editable ? 'Click to edit.' : ''}`}
          >
            <Building2 size={12} />
            <span>{company.name}</span>
            {editable && (
              <button
                onClick={(e) => handleRemoveCompany(e, company.id)}
                className="opacity-0 group-hover:opacity-100 hover:bg-blue-900/10 rounded-full p-0.5 transition-opacity"
                aria-label={`Remove ${company.name}`}
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
              inline-flex items-center gap-1 px-2 py-1.5
              bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-cyan-400
              ${getRadiusClass('pill')} text-xs text-gray-500 hover:text-cyan-700 font-medium
              ${TRANSITIONS.fast}
              focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1
            `}
            aria-label="Add more companies"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`relative inline-block overflow-visible ${className}`} ref={triggerRef}>
      {/* Company Pills */}
      {renderCompanyPills()}

      {/* Dropdown (when editing) - Rendered via Portal */}
      {isEditing && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: `${Math.max(dropdownPosition.width, 320)}px`,
            zIndex: 9999,
          }}
          className={`
            max-h-96 overflow-y-auto
            bg-white border border-gray-200 shadow-lg ${getRadiusClass('field')}
          `}
          role="listbox"
          aria-label="Select companies"
          aria-multiselectable="true"
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create company..."
              className={`
                w-full px-3 py-2 text-sm border border-gray-200 ${getRadiusClass('element')}
                focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400
              `}
              aria-label="Search companies"
            />
          </div>

          {/* Create new company prompt */}
          {showCreatePrompt && (
            <div className="p-2 border-b border-gray-100 bg-cyan-50/50">
              <button
                onClick={handleCreateCompany}
                disabled={isCreating}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                  bg-gradient-to-r from-cyan-500 to-blue-500 text-white
                  ${getRadiusClass('element')}
                  hover:from-cyan-600 hover:to-blue-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${TRANSITIONS.fast}
                `}
                aria-label={`Create new company: ${searchQuery}`}
              >
                <Plus size={14} />
                <span>{isCreating ? 'Creating...' : `Create "${searchQuery}"`}</span>
              </button>
            </div>
          )}

          {/* Selected companies section */}
          {selectedCompanies.length > 0 && (
            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
              <div className="text-xs font-semibold text-gray-600 mb-2 px-1">
                Selected ({selectedCompanies.length})
              </div>
              {selectedCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleToggleCompany(company)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left text-sm
                    bg-cyan-100 text-cyan-900 font-semibold
                    ${getRadiusClass('element')} mb-1
                    hover:bg-cyan-200
                    ${TRANSITIONS.fast}
                  `}
                  role="option"
                  aria-selected={true}
                >
                  <span className="flex items-center gap-2">
                    <Building2 size={14} />
                    {company.name}
                    {company.noteCount > 0 && (
                      <span className="text-xs text-cyan-700">
                        ({company.noteCount} notes)
                      </span>
                    )}
                  </span>
                  <X size={14} />
                </button>
              ))}
            </div>
          )}

          {/* Available companies list */}
          <div className="py-1">
            {filteredCompanies.length === 0 && !showCreatePrompt ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? 'No companies found' : 'All companies selected'}
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleToggleCompany(company)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left text-sm
                    hover:bg-cyan-50
                    ${TRANSITIONS.fast}
                  `}
                  role="option"
                  aria-selected={false}
                >
                  <span className="flex items-center gap-2">
                    <Building2 size={14} className="text-blue-600" />
                    <span>{company.name}</span>
                    {company.noteCount > 0 && (
                      <span className="text-xs text-gray-500">
                        ({company.noteCount} notes)
                      </span>
                    )}
                  </span>
                  <Plus size={14} className="text-gray-400" />
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

export default CompanyPillManager;
