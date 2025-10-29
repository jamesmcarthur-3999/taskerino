/**
 * Relationships Components Barrel Export
 *
 * Centralizes exports for all relationship-related components.
 *
 * @module components/relationships
 */

// Main components
export { RelationshipModal } from './RelationshipModal';
export type { RelationshipModalProps } from './RelationshipModal';

export { RelationshipPills } from './RelationshipPills';
export type { RelationshipPillsProps } from './RelationshipPills';

export { RelatedContentSection } from './RelatedContentSection';
export type { RelatedContentSectionProps } from './RelatedContentSection';

// Supporting components
export { RelationshipListItem } from './RelationshipListItem';
export { AvailableEntityItem } from './AvailableEntityItem';
export { default as RelationshipPillVariants } from './RelationshipPillVariants';

// Relationship Cards (Phase 2 - Rich Cards)
export { TaskRelationshipCard } from './TaskRelationshipCard';
export type { TaskRelationshipCardProps } from './TaskRelationshipCard';

export { NoteRelationshipCard } from './NoteRelationshipCard';
export type { NoteRelationshipCardProps } from './NoteRelationshipCard';

export { SessionRelationshipCard } from './SessionRelationshipCard';
export type { SessionRelationshipCardProps } from './SessionRelationshipCard';

export { RelationshipCardSection } from './RelationshipCardSection';
export type { RelationshipCardSectionProps } from './RelationshipCardSection';
