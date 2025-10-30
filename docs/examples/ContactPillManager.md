# ContactPillManager Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the ContactPillManager component, a multi-select contact picker with search, dropdown, and visual pill display. Contacts are displayed with a purple gradient and person emoji (👤).

## Use Case

Use ContactPillManager when you need to:
- Associate multiple contacts with tasks or notes
- Display selected contacts as visual pills with name and role
- Provide a searchable dropdown for contact selection
- Allow users to add/remove contact associations
- Support both editable and read-only modes
- Show contact metadata (role, note count)
- Search by both name and role

## Example Code

```typescript
/**
 * ContactPillManager Usage Examples
 *
 * This file demonstrates various usage patterns for the ContactPillManager component.
 * It is not part of the main application - it's for documentation and testing.
 *
 * @module components/ContactPillManager.example
 */

import React, { useState } from 'react';
import { ContactPillManager } from './ContactPillManager';
import type { Contact } from '../types';

/**
 * Example 1: Basic Usage - Editable with multiple contacts
 */
export function BasicExample() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(['contact-1', 'contact-3']);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 12,
      profile: {
        role: 'CEO',
        companyId: 'company-1',
        email: 'john@example.com',
      },
    },
    {
      id: 'contact-2',
      name: 'Jane Doe',
      createdAt: '2025-01-02T00:00:00Z',
      lastUpdated: '2025-01-02T00:00:00Z',
      noteCount: 8,
      profile: {
        role: 'CTO',
        companyId: 'company-1',
        email: 'jane@example.com',
      },
    },
    {
      id: 'contact-3',
      name: 'Bob Johnson',
      createdAt: '2025-01-03T00:00:00Z',
      lastUpdated: '2025-01-03T00:00:00Z',
      noteCount: 5,
      profile: {
        role: 'Engineer',
        companyId: 'company-2',
      },
    },
    {
      id: 'contact-4',
      name: 'Alice Williams',
      createdAt: '2025-01-04T00:00:00Z',
      lastUpdated: '2025-01-04T00:00:00Z',
      noteCount: 0,
      // No profile (edge case)
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Basic Usage - Editable</h2>
      <div className="mb-4">
        <ContactPillManager
          contactIds={selectedContactIds}
          onContactsChange={setSelectedContactIds}
          allContacts={mockContacts}
          editable={true}
        />
      </div>
      <div className="text-sm text-gray-600">
        <p>Selected IDs: {selectedContactIds.join(', ') || 'None'}</p>
      </div>
    </div>
  );
}

/**
 * Example 2: Empty State - No contacts selected
 */
export function EmptyStateExample() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 12,
      profile: { role: 'CEO' },
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Empty State - Editable</h2>
      <ContactPillManager
        contactIds={selectedContactIds}
        onContactsChange={setSelectedContactIds}
        allContacts={mockContacts}
        editable={true}
      />
    </div>
  );
}

/**
 * Example 3: Read-Only Mode - Cannot edit
 */
export function ReadOnlyExample() {
  const [selectedContactIds] = useState<string[]>(['contact-1', 'contact-2']);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 12,
      profile: { role: 'CEO' },
    },
    {
      id: 'contact-2',
      name: 'Jane Doe',
      createdAt: '2025-01-02T00:00:00Z',
      lastUpdated: '2025-01-02T00:00:00Z',
      noteCount: 8,
      profile: { role: 'CTO' },
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Read-Only Mode</h2>
      <ContactPillManager
        contactIds={selectedContactIds}
        onContactsChange={() => {}}
        allContacts={mockContacts}
        editable={false}
      />
      <p className="text-sm text-gray-600 mt-2">
        Pills are not editable. No hover effects or remove buttons.
      </p>
    </div>
  );
}

/**
 * Example 4: Many Contacts - Tests wrapping and scroll behavior
 */
export function ManyContactsExample() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([
    'contact-1',
    'contact-2',
    'contact-3',
    'contact-4',
    'contact-5',
  ]);

  const mockContacts: Contact[] = Array.from({ length: 20 }, (_, i) => ({
    id: `contact-${i + 1}`,
    name: `Contact ${i + 1}`,
    createdAt: '2025-01-01T00:00:00Z',
    lastUpdated: '2025-01-01T00:00:00Z',
    noteCount: i,
    profile: {
      role: i % 2 === 0 ? 'Engineer' : 'Manager',
      companyId: `company-${Math.floor(i / 5) + 1}`,
    },
  }));

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Many Contacts - Tests Wrapping</h2>
      <div className="mb-4 max-w-2xl">
        <ContactPillManager
          contactIds={selectedContactIds}
          onContactsChange={setSelectedContactIds}
          allContacts={mockContacts}
          editable={true}
        />
      </div>
      <div className="text-sm text-gray-600">
        <p>Selected: {selectedContactIds.length} contacts</p>
        <p>Available: {mockContacts.length} contacts</p>
      </div>
    </div>
  );
}

/**
 * Example 5: Contacts Without Roles - Tests fallback behavior
 */
export function ContactsWithoutRolesExample() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(['contact-1']);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 5,
      // No profile at all
    },
    {
      id: 'contact-2',
      name: 'Jane Doe',
      createdAt: '2025-01-02T00:00:00Z',
      lastUpdated: '2025-01-02T00:00:00Z',
      noteCount: 3,
      profile: {
        // Profile exists but no role
        email: 'jane@example.com',
      },
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Contacts Without Roles</h2>
      <ContactPillManager
        contactIds={selectedContactIds}
        onContactsChange={setSelectedContactIds}
        allContacts={mockContacts}
        editable={true}
      />
      <p className="text-sm text-gray-600 mt-2">
        Contacts without roles display name only (no parentheses).
      </p>
    </div>
  );
}

/**
 * Example 6: Search/Filter - Tests autocomplete behavior
 */
export function SearchExample() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 12,
      profile: { role: 'CEO', companyId: 'company-1' },
    },
    {
      id: 'contact-2',
      name: 'Jane Doe',
      createdAt: '2025-01-02T00:00:00Z',
      lastUpdated: '2025-01-02T00:00:00Z',
      noteCount: 8,
      profile: { role: 'CTO', companyId: 'company-1' },
    },
    {
      id: 'contact-3',
      name: 'Bob Johnson',
      createdAt: '2025-01-03T00:00:00Z',
      lastUpdated: '2025-01-03T00:00:00Z',
      noteCount: 5,
      profile: { role: 'Senior Engineer', companyId: 'company-2' },
    },
    {
      id: 'contact-4',
      name: 'Alice CEO Williams',
      createdAt: '2025-01-04T00:00:00Z',
      lastUpdated: '2025-01-04T00:00:00Z',
      noteCount: 3,
      profile: { role: 'Product Manager' },
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Search/Filter Test</h2>
      <ContactPillManager
        contactIds={selectedContactIds}
        onContactsChange={setSelectedContactIds}
        allContacts={mockContacts}
        editable={true}
      />
      <div className="text-sm text-gray-600 mt-4">
        <p className="font-semibold">Test Cases:</p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Search "CEO" - should find John Smith (role) and Alice CEO Williams (name)</li>
          <li>Search "engineer" - should find Bob Johnson</li>
          <li>Search "jane" - should find Jane Doe</li>
          <li>Search "xyz" - should show "No contacts found"</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 7: Integration with Task/Note - Realistic usage
 */
export function IntegrationExample() {
  const [taskContactIds, setTaskContactIds] = useState<string[]>(['contact-1']);
  const [noteContactIds, setNoteContactIds] = useState<string[]>([]);

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      name: 'John Smith',
      createdAt: '2025-01-01T00:00:00Z',
      lastUpdated: '2025-01-01T00:00:00Z',
      noteCount: 12,
      profile: { role: 'CEO' },
    },
    {
      id: 'contact-2',
      name: 'Jane Doe',
      createdAt: '2025-01-02T00:00:00Z',
      lastUpdated: '2025-01-02T00:00:00Z',
      noteCount: 8,
      profile: { role: 'CTO' },
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Integration Example - Task & Note</h2>

      {/* Task card mockup */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow border border-gray-200">
        <h3 className="text-sm font-semibold mb-2">Task: Fix authentication bug</h3>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Contacts:</span>
          <ContactPillManager
            contactIds={taskContactIds}
            onContactsChange={setTaskContactIds}
            allContacts={mockContacts}
            editable={true}
          />
        </div>
      </div>

      {/* Note card mockup */}
      <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
        <h3 className="text-sm font-semibold mb-2">Note: Meeting with stakeholders</h3>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Attendees:</span>
          <ContactPillManager
            contactIds={noteContactIds}
            onContactsChange={setNoteContactIds}
            allContacts={mockContacts}
            editable={true}
          />
        </div>
      </div>
    </div>
  );
}
```

## Key Points

- **Multi-Select**: Select multiple contacts at once (unlike TopicPillManager which is single-select)
- **Purple Gradient**: Contacts use purple gradient for visual distinction
- **Person Emoji**: 👤 emoji indicates contacts
- **Name + Role Display**: Shows "Name (Role)" in pills, or just "Name" if no role
- **Searchable Dropdown**: Search by name OR role in real-time
- **Remove on Hover**: Hover over pill to show remove (×) button
- **Empty State**: "+ Add contacts" button when none selected
- **Read-Only Support**: Non-interactive display when editable={false}
- **Note Count**: Displays number of notes associated with each contact
- **Keyboard Accessible**: Full keyboard navigation support
- **Pill Wrapping**: Pills wrap to multiple lines when many are selected
- **Edge Cases**: Handles contacts without profiles or roles gracefully

## Props

```typescript
interface ContactPillManagerProps {
  contactIds: string[];               // Currently selected contact IDs
  onContactsChange: (contactIds: string[]) => void;
  allContacts: Contact[];             // All available contacts
  editable?: boolean;                 // Enable/disable editing (default: true)
}
```

## Search Behavior

The search filters contacts by:
- Contact name (case-insensitive)
- Contact role (case-insensitive)

Example: Searching "CEO" will find:
- John Smith (role: "CEO")
- Alice CEO Williams (name contains "CEO")

## Related Documentation

- Main Component: `/src/components/ContactPillManager.tsx`
- Entities Context: `/src/context/EntitiesContext.tsx`
- Single-Select Variant: `/src/components/TopicPillManager.tsx`
- Company Variant: `/src/components/CompanyPillManager.tsx`
- Contact Types: `/src/types.ts`
