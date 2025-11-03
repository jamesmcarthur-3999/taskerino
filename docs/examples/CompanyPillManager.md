# CompanyPillManager Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the CompanyPillManager component, a multi-select company picker with search, dropdown, and visual pill display. Companies are displayed with a blue gradient and building emoji (🏢).

## Use Case

Use CompanyPillManager when you need to:
- Associate multiple companies with tasks or notes
- Display selected companies as visual pills
- Provide a searchable dropdown for company selection
- Allow users to add/remove company associations
- Support creating new companies inline
- Support both editable and read-only modes
- Show company metadata (note count)

## Example Code

```typescript
/**
 * CompanyPillManager - Usage Examples
 *
 * This file demonstrates various usage patterns for the CompanyPillManager component.
 * These examples show common scenarios in task/note management contexts.
 */

import React, { useState } from 'react';
import { CompanyPillManager } from './CompanyPillManager';
import type { Company } from '../types';

// ============================================================================
// Example 1: Basic Usage (Read-only)
// ============================================================================

export function Example1_ReadOnly() {
  const companies: Company[] = [
    {
      id: 'company-1',
      name: 'Acme Corp',
      createdAt: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T10:00:00Z',
      noteCount: 12,
    },
    {
      id: 'company-2',
      name: 'TechStart Inc',
      createdAt: '2025-01-16T10:00:00Z',
      lastUpdated: '2025-01-16T10:00:00Z',
      noteCount: 5,
    },
  ];

  const [selectedIds] = useState<string[]>(['company-1', 'company-2']);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 1: Read-only Display</h2>
      <p className="text-sm text-gray-600 mb-4">
        Non-editable view (e.g., viewing completed task)
      </p>
      <CompanyPillManager
        companyIds={selectedIds}
        onCompaniesChange={() => {}}
        allCompanies={companies}
        editable={false}
      />
    </div>
  );
}

// ============================================================================
// Example 2: Editable with Selection
// ============================================================================

export function Example2_Editable() {
  const companies: Company[] = [
    {
      id: 'company-1',
      name: 'Acme Corp',
      createdAt: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T10:00:00Z',
      noteCount: 12,
    },
    {
      id: 'company-2',
      name: 'TechStart Inc',
      createdAt: '2025-01-16T10:00:00Z',
      lastUpdated: '2025-01-16T10:00:00Z',
      noteCount: 5,
    },
    {
      id: 'company-3',
      name: 'Global Solutions Ltd',
      createdAt: '2025-01-17T10:00:00Z',
      lastUpdated: '2025-01-17T10:00:00Z',
      noteCount: 8,
    },
  ];

  const [selectedIds, setSelectedIds] = useState<string[]>(['company-1']);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 2: Editable Selection</h2>
      <p className="text-sm text-gray-600 mb-4">
        Click pills to edit, add/remove companies
      </p>
      <CompanyPillManager
        companyIds={selectedIds}
        onCompaniesChange={setSelectedIds}
        allCompanies={companies}
        editable={true}
      />
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm font-mono">
          Selected IDs: {JSON.stringify(selectedIds)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Empty State
// ============================================================================

export function Example3_EmptyState() {
  const companies: Company[] = [
    {
      id: 'company-1',
      name: 'Acme Corp',
      createdAt: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T10:00:00Z',
      noteCount: 12,
    },
    {
      id: 'company-2',
      name: 'TechStart Inc',
      createdAt: '2025-01-16T10:00:00Z',
      lastUpdated: '2025-01-16T10:00:00Z',
      noteCount: 5,
    },
  ];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 3: Empty State</h2>
      <p className="text-sm text-gray-600 mb-4">
        No companies selected yet
      </p>
      <CompanyPillManager
        companyIds={selectedIds}
        onCompaniesChange={setSelectedIds}
        allCompanies={companies}
        editable={true}
      />
    </div>
  );
}

// ============================================================================
// Example 4: With Create New Company
// ============================================================================

export function Example4_CreateNewCompany() {
  const [companies, setCompanies] = useState<Company[]>([
    {
      id: 'company-1',
      name: 'Acme Corp',
      createdAt: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T10:00:00Z',
      noteCount: 12,
    },
    {
      id: 'company-2',
      name: 'TechStart Inc',
      createdAt: '2025-01-16T10:00:00Z',
      lastUpdated: '2025-01-16T10:00:00Z',
      noteCount: 5,
    },
  ]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleCreateCompany = async (name: string): Promise<Company> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const newCompany: Company = {
      id: `company-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      noteCount: 0,
    };

    setCompanies([...companies, newCompany]);
    return newCompany;
  };

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 4: Create New Company</h2>
      <p className="text-sm text-gray-600 mb-4">
        Search for a company that doesn't exist to create it
      </p>
      <CompanyPillManager
        companyIds={selectedIds}
        onCompaniesChange={setSelectedIds}
        allCompanies={companies}
        editable={true}
        onCreateCompany={handleCreateCompany}
      />
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm font-mono">
          Total companies: {companies.length}
        </p>
        <p className="text-sm font-mono">
          Selected: {selectedIds.length}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Task Card Integration
// ============================================================================

export function Example5_TaskCard() {
  const companies: Company[] = [
    {
      id: 'company-1',
      name: 'Acme Corp',
      createdAt: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T10:00:00Z',
      noteCount: 12,
    },
    {
      id: 'company-2',
      name: 'TechStart Inc',
      createdAt: '2025-01-16T10:00:00Z',
      lastUpdated: '2025-01-16T10:00:00Z',
      noteCount: 5,
    },
    {
      id: 'company-3',
      name: 'Global Solutions Ltd',
      createdAt: '2025-01-17T10:00:00Z',
      lastUpdated: '2025-01-17T10:00:00Z',
      noteCount: 8,
    },
  ];

  const [taskCompanyIds, setTaskCompanyIds] = useState<string[]>(['company-1', 'company-2']);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 5: Task Card Integration</h2>
      <p className="text-sm text-gray-600 mb-4">
        Typical usage in a task card
      </p>
      <div className="max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-2">Fix authentication bug</h3>
        <p className="text-sm text-gray-600 mb-4">
          Users unable to login with SSO credentials
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Companies
            </label>
            <CompanyPillManager
              companyIds={taskCompanyIds}
              onCompaniesChange={setTaskCompanyIds}
              allCompanies={companies}
              editable={true}
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500">Due: Today</span>
            <span className="text-xs font-semibold text-red-600">High Priority</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Multiple Selection Stress Test
// ============================================================================

export function Example6_ManyCompanies() {
  const companies: Company[] = Array.from({ length: 15 }, (_, i) => ({
    id: `company-${i + 1}`,
    name: `Company ${i + 1}`,
    createdAt: '2025-01-15T10:00:00Z',
    lastUpdated: '2025-01-15T10:00:00Z',
    noteCount: Math.floor(Math.random() * 20),
  }));

  const [selectedIds, setSelectedIds] = useState<string[]>([
    'company-1',
    'company-3',
    'company-5',
    'company-7',
  ]);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Example 6: Many Companies</h2>
      <p className="text-sm text-gray-600 mb-4">
        Stress test with multiple selected companies
      </p>
      <CompanyPillManager
        companyIds={selectedIds}
        onCompaniesChange={setSelectedIds}
        allCompanies={companies}
        editable={true}
      />
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm font-mono">
          {selectedIds.length} of {companies.length} companies selected
        </p>
      </div>
    </div>
  );
}
```

## Key Points

- **Multi-Select**: Select multiple companies at once (unlike TopicPillManager which is single-select)
- **Blue Gradient**: Companies use blue gradient for visual distinction
- **Building Emoji**: 🏢 emoji indicates companies
- **Searchable Dropdown**: Type to filter companies in real-time
- **Remove on Hover**: Hover over pill to show remove (×) button
- **Empty State**: "+ Add companies" button when none selected
- **Create Inline**: Optional onCreateCompany callback for creating new companies
- **Read-Only Support**: Non-interactive display when editable={false}
- **Note Count**: Displays number of notes associated with each company
- **Keyboard Accessible**: Full keyboard navigation support
- **Pill Wrapping**: Pills wrap to multiple lines when many are selected

## Props

```typescript
interface CompanyPillManagerProps {
  companyIds: string[];                // Currently selected company IDs
  onCompaniesChange: (companyIds: string[]) => void;
  allCompanies: Company[];             // All available companies
  editable?: boolean;                  // Enable/disable editing (default: true)
  onCreateCompany?: (name: string) => Promise<Company>;  // Optional create callback
}
```

## Related Documentation

- Main Component: `/src/components/CompanyPillManager.tsx`
- Entities Context: `/src/context/EntitiesContext.tsx`
- Single-Select Variant: `/src/components/TopicPillManager.tsx`
- Contact Variant: `/src/components/ContactPillManager.tsx`
- Company Types: `/src/types.ts`
