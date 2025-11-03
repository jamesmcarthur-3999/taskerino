/**
 * NoteEnrichmentSuggestions
 *
 * Inline UI component that displays AI enrichment suggestions for a note.
 * Users can selectively apply suggestions or accept all at once.
 *
 * Features:
 * - Inline suggestions display (no modal)
 * - Individual apply buttons for each suggestion
 * - "Accept All" for bulk application
 * - Shows suggested relationships to existing entities
 * - Shows NEW entities to create
 * - Aligned with design system (glass morphism, proper spacing, animations)
 */

import { useState } from 'react';
import { Check, X, Plus, Link, Sparkles, CheckCheck } from 'lucide-react';
import type { Note, Topic, Company, Contact } from '../../types';
import type { NoteEnrichmentResult } from '../../services/noteEnrichmentService';
import {
  getGlassClasses,
  getRadiusClass,
  SHADOWS,
  TRANSITIONS,
  SCALE,
  GLASS_STYLES,
  BORDER_STYLES,
} from '../../design-system/theme';

interface NoteEnrichmentSuggestionsProps {
  note: Note;
  enrichment: NoteEnrichmentResult;
  existingTopics: Topic[];
  existingCompanies: Company[];
  existingContacts: Contact[];
  onApplySuggestion: (type: SuggestionType, value: any) => void;
  onDismiss: () => void;
}

export type SuggestionType =
  | 'title'
  | 'tags'
  | 'summary'
  | 'relatedNote'
  | 'linkCompany'
  | 'linkContact'
  | 'linkTopic'
  | 'createCompany'
  | 'createContact'
  | 'createTopic';

export function NoteEnrichmentSuggestions({
  note,
  enrichment,
  existingTopics,
  existingCompanies,
  existingContacts,
  onApplySuggestion,
  onDismiss,
}: NoteEnrichmentSuggestionsProps) {
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const handleApply = (type: SuggestionType, value: any, key: string) => {
    setAppliedSuggestions((prev) => new Set(prev).add(key));
    onApplySuggestion(type, value);
  };

  const handleAcceptAll = () => {
    // Apply all suggestions at once
    if (enrichment.suggestedTitle) {
      handleApply('title', enrichment.suggestedTitle, 'title');
    }
    if (enrichment.suggestedTags && enrichment.suggestedTags.length > 0) {
      handleApply('tags', enrichment.suggestedTags, 'tags');
    }
    if (enrichment.suggestedSummary) {
      handleApply('summary', enrichment.suggestedSummary, 'summary');
    }

    // Use new relationships format
    enrichment.relationships?.filter(r => r.to.type === 'company' && r.to.id).forEach((rel) => {
      handleApply('linkCompany', rel.to.id, `company-${rel.to.id}`);
    });
    enrichment.relationships?.filter(r => r.to.type === 'contact' && r.to.id).forEach((rel) => {
      handleApply('linkContact', rel.to.id, `contact-${rel.to.id}`);
    });
    enrichment.relationships?.filter(r => r.to.type === 'topic' && r.to.id).forEach((rel) => {
      handleApply('linkTopic', rel.to.id, `topic-${rel.to.id}`);
    });

    // Use new newEntities format
    enrichment.newEntities?.companies?.forEach((company, idx) => {
      handleApply('createCompany', company, `new-company-${idx}`);
    });
    enrichment.newEntities?.contacts?.forEach((contact, idx) => {
      handleApply('createContact', contact, `new-contact-${idx}`);
    });
    enrichment.newEntities?.topics?.forEach((topic, idx) => {
      handleApply('createTopic', topic, `new-topic-${idx}`);
    });
  };

  const isApplied = (key: string) => appliedSuggestions.has(key);

  // Get entity name by ID
  const getTopicName = (id: string) => existingTopics.find((t) => t.id === id)?.name || id;
  const getCompanyName = (id: string) => existingCompanies.find((c) => c.id === id)?.name || id;
  const getContactName = (id: string) => existingContacts.find((c) => c.id === id)?.name || id;

  const hasAnySuggestions =
    enrichment.suggestedTitle ||
    (enrichment.suggestedTags && enrichment.suggestedTags.length > 0) ||
    enrichment.suggestedSummary ||
    (enrichment.relatedNoteIds && enrichment.relatedNoteIds.length > 0) ||
    (enrichment.relationships && enrichment.relationships.length > 0) ||
    (enrichment.newEntities?.companies && enrichment.newEntities.companies.length > 0) ||
    (enrichment.newEntities?.contacts && enrichment.newEntities.contacts.length > 0) ||
    (enrichment.newEntities?.topics && enrichment.newEntities.topics.length > 0);

  if (!hasAnySuggestions) {
    return null;
  }

  return (
    <div
      className={`
        ${GLASS_STYLES.panel}
        ${BORDER_STYLES.control}
        ${getRadiusClass('card')}
        ${SHADOWS.elevated}
        p-6
        ${TRANSITIONS.standard}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">AI Enrichment Suggestions</h3>
            <p className="text-sm text-gray-600">Review and apply suggestions to enhance your note</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Accept All Button */}
          <button
            onClick={handleAcceptAll}
            className={`
              flex items-center gap-2 px-4 py-2
              bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium
              ${getRadiusClass('field')}
              ${SHADOWS.button}
              ${SCALE.buttonHover} ${SCALE.buttonActive}
              ${TRANSITIONS.fast}
              hover:shadow-lg hover:shadow-cyan-200/50
            `}
          >
            <CheckCheck className="w-4 h-4" />
            <span className="text-sm">Accept All</span>
          </button>

          {/* Dismiss Button */}
          <button
            onClick={onDismiss}
            className={`
              p-2
              ${getGlassClasses('subtle')}
              ${getRadiusClass('element')}
              text-gray-600 hover:text-gray-800 hover:bg-white/60
              ${SCALE.iconButtonHover} ${SCALE.iconButtonActive}
              ${TRANSITIONS.fast}
            `}
            aria-label="Dismiss suggestions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="space-y-6">
        {/* Metadata Suggestions Section */}
        {(enrichment.suggestedTitle || (enrichment.suggestedTags && enrichment.suggestedTags.length > 0) || enrichment.suggestedSummary) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Metadata
            </h4>
            <div className="space-y-2">
              {enrichment.suggestedTitle && (
                <SuggestionRow
                  label="Title"
                  value={enrichment.suggestedTitle}
                  current={note.summary || 'Untitled Note'}
                  applied={isApplied('title')}
                  onApply={() => handleApply('title', enrichment.suggestedTitle, 'title')}
                />
              )}

              {enrichment.suggestedTags && enrichment.suggestedTags.length > 0 && (
                <SuggestionRow
                  label="Tags"
                  value={enrichment.suggestedTags.join(', ')}
                  current={note.tags.length > 0 ? note.tags.join(', ') : 'None'}
                  applied={isApplied('tags')}
                  onApply={() => handleApply('tags', enrichment.suggestedTags, 'tags')}
                />
              )}

              {enrichment.suggestedSummary && (
                <SuggestionRow
                  label="Summary"
                  value={enrichment.suggestedSummary}
                  current={note.summary}
                  applied={isApplied('summary')}
                  onApply={() => handleApply('summary', enrichment.suggestedSummary, 'summary')}
                  multiline
                />
              )}
            </div>
          </div>
        )}

        {/* Link to Existing Entities Section */}
        {enrichment.relationships && enrichment.relationships.some(r => r.to.id) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Link className="w-3.5 h-3.5" />
              Link to Existing
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {enrichment.relationships?.filter(r => r.to.type === 'company' && r.to.id).map((rel) => (
                <EntitySuggestionRow
                  key={rel.to.id!}
                  name={getCompanyName(rel.to.id!)}
                  type="Company"
                  applied={isApplied(`company-${rel.to.id}`)}
                  onApply={() => handleApply('linkCompany', rel.to.id, `company-${rel.to.id}`)}
                />
              ))}
              {enrichment.relationships?.filter(r => r.to.type === 'contact' && r.to.id).map((rel) => (
                <EntitySuggestionRow
                  key={rel.to.id!}
                  name={getContactName(rel.to.id!)}
                  type="Contact"
                  applied={isApplied(`contact-${rel.to.id}`)}
                  onApply={() => handleApply('linkContact', rel.to.id, `contact-${rel.to.id}`)}
                />
              ))}
              {enrichment.relationships?.filter(r => r.to.type === 'topic' && r.to.id).map((rel) => (
                <EntitySuggestionRow
                  key={rel.to.id!}
                  name={getTopicName(rel.to.id!)}
                  type="Topic"
                  applied={isApplied(`topic-${rel.to.id}`)}
                  onApply={() => handleApply('linkTopic', rel.to.id, `topic-${rel.to.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Create New Entities Section */}
        {enrichment.newEntities && (
          (enrichment.newEntities.companies && enrichment.newEntities.companies.length > 0) ||
          (enrichment.newEntities.contacts && enrichment.newEntities.contacts.length > 0) ||
          (enrichment.newEntities.topics && enrichment.newEntities.topics.length > 0)
        ) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" />
              Create New
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {enrichment.newEntities?.companies?.map((company, idx) => (
                <EntitySuggestionRow
                  key={`new-company-${idx}`}
                  name={company.name}
                  type="Company"
                  applied={isApplied(`new-company-${idx}`)}
                  onApply={() => handleApply('createCompany', company, `new-company-${idx}`)}
                  isNew
                />
              ))}
              {enrichment.newEntities?.contacts?.map((contact, idx) => (
                <EntitySuggestionRow
                  key={`new-contact-${idx}`}
                  name={contact.name}
                  type="Contact"
                  applied={isApplied(`new-contact-${idx}`)}
                  onApply={() => handleApply('createContact', contact, `new-contact-${idx}`)}
                  isNew
                />
              ))}
              {enrichment.newEntities?.topics?.map((topic, idx) => (
                <EntitySuggestionRow
                  key={`new-topic-${idx}`}
                  name={topic.name}
                  type="Topic"
                  applied={isApplied(`new-topic-${idx}`)}
                  onApply={() => handleApply('createTopic', topic, `new-topic-${idx}`)}
                  isNew
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for metadata suggestions (title, tags, summary)
function SuggestionRow({
  label,
  value,
  current,
  applied,
  onApply,
  multiline = false,
}: {
  label: string;
  value: string;
  current: string;
  applied: boolean;
  onApply: () => void;
  multiline?: boolean;
}) {
  return (
    <div
      className={`
        ${getGlassClasses('subtle')}
        ${getRadiusClass('field')}
        p-4
        ${TRANSITIONS.fast}
        hover:shadow-md
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{label}</p>
          <div className="space-y-2">
            <p className={`text-sm text-gray-900 font-medium ${multiline ? '' : 'truncate'}`}>
              {value}
            </p>
            {current && current !== value && (
              <p className={`text-xs text-gray-500 ${multiline ? '' : 'truncate'}`}>
                Current: {current}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onApply}
          disabled={applied}
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            ${TRANSITIONS.fast}
            ${
              applied
                ? 'bg-green-100 text-green-600 cursor-default'
                : `bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${SCALE.iconButtonHover} ${SCALE.iconButtonActive} shadow-md hover:shadow-lg`
            }
          `}
          aria-label={`Apply ${label.toLowerCase()} suggestion`}
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Helper component for entity suggestions (companies, contacts, topics)
function EntitySuggestionRow({
  name,
  type,
  description,
  applied,
  onApply,
  isNew = false,
}: {
  name: string;
  type: string;
  description?: string;
  applied: boolean;
  onApply: () => void;
  isNew?: boolean;
}) {
  return (
    <div
      className={`
        ${getGlassClasses('subtle')}
        ${getRadiusClass('element')}
        p-3
        ${TRANSITIONS.fast}
        hover:shadow-md
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500">{type}</span>
            {isNew && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wide">
                New
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 font-medium truncate">{name}</p>
          {description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{description}</p>
          )}
        </div>
        <button
          onClick={onApply}
          disabled={applied}
          className={`
            flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
            ${TRANSITIONS.fast}
            ${
              applied
                ? 'bg-green-100 text-green-600 cursor-default'
                : isNew
                ? `bg-gradient-to-r from-purple-500 to-pink-500 text-white ${SCALE.iconButtonHover} ${SCALE.iconButtonActive} shadow-md hover:shadow-lg`
                : `bg-gradient-to-r from-cyan-500 to-blue-500 text-white ${SCALE.iconButtonHover} ${SCALE.iconButtonActive} shadow-md hover:shadow-lg`
            }
          `}
          aria-label={`${isNew ? 'Create' : 'Link'} ${name}`}
        >
          {isNew ? <Plus className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
