import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const academyUnitsTable = pgTable("academy_units", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  level: text("level").notNull(),
  description: text("description").notNull(),
  culturalNote: text("cultural_note").notNull(),
});

export const academyLessonsTable = pgTable(
  "academy_lessons",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => academyUnitsTable.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sequence: integer("sequence").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    section: text("section").notNull(),
    content: text("content").notNull(),
    transliteration: text("transliteration"),
  },
  (table) => [index("academy_lessons_unit_sequence_idx").on(table.unitId, table.sequence)],
);

export const academyActivitiesTable = pgTable(
  "academy_activities",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => academyLessonsTable.id),
    type: text("type").notNull(),
    prompt: text("prompt").notNull(),
    instructions: text("instructions").notNull(),
    arabicPrompt: text("arabic_prompt"),
    choices: jsonb("choices").$type<string[]>().notNull().default([]),
    wordBank: jsonb("word_bank").$type<string[]>().notNull().default([]),
    leftOptions: jsonb("left_options").$type<string[]>().notNull().default([]),
    rightOptions: jsonb("right_options").$type<string[]>().notNull().default([]),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull(),
  },
  (table) => [index("academy_activities_lesson_idx").on(table.lessonId)],
);

export const academyUserRolesTable = pgTable("academy_user_roles", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("student"),
  email: text("email"),
  displayName: text("display_name"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  initialAdminGrantApplied: boolean("initial_admin_grant_applied")
    .notNull()
    .default(false),
  showTransliteration: boolean("show_transliteration")
    .notNull()
    .default(true),
  showTashkeel: boolean("show_tashkeel").notNull().default(true),
  planType: text("plan_type").notNull().default("beta"),
  subscriptionStatus: text("subscription_status").notNull().default("beta"),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  accessOverride: text("access_override").notNull().default("inherit"),
  billingProvider: text("billing_provider"),
  externalCustomerId: text("external_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  accessChangedAt: timestamp("access_changed_at", { withTimezone: true }),
  accessChangedBy: text("access_changed_by"),
});

export const academyDialectExamplesTable = pgTable(
  "academy_dialect_examples",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => academyUnitsTable.id),
    dialect: text("dialect").notNull(),
    arabic: text("arabic").notNull(),
    transliteration: text("transliteration").notNull(),
    english: text("english").notNull(),
    usageNote: text("usage_note").notNull(),
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    index("academy_dialect_examples_unit_sequence_idx").on(
      table.unitId,
      table.sequence,
    ),
  ],
);

export const academyProgressTable = pgTable(
  "academy_progress",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => academyUserRolesTable.userId),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => academyLessonsTable.id),
    currentStep: text("current_step").notNull().default("learn"),
    completed: boolean("completed").notNull().default(false),
    latestScore: integer("latest_score"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("academy_progress_user_lesson_unique").on(
      table.userId,
      table.lessonId,
    ),
    index("academy_progress_user_idx").on(table.userId),
  ],
);

export const academyAttemptsTable = pgTable(
  "academy_attempts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => academyUserRolesTable.userId),
    activityId: text("activity_id")
      .notNull()
      .references(() => academyActivitiesTable.id),
    answer: text("answer").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("academy_attempts_user_activity_idx").on(table.userId, table.activityId)],
);

export const academyFlashcardsTable = pgTable(
  "academy_flashcards",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => academyUnitsTable.id),
    arabic: text("arabic").notNull(),
    transliteration: text("transliteration").notNull(),
    english: text("english").notNull(),
    example: text("example").notNull(),
  },
  (table) => [index("academy_flashcards_unit_idx").on(table.unitId)],
);

export const academyFlashcardReviewsTable = pgTable(
  "academy_flashcard_reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => academyUserRolesTable.userId),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => academyFlashcardsTable.id),
    reviewCount: integer("review_count").notNull().default(0),
    known: boolean("known").notNull().default(false),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("academy_flashcard_reviews_user_card_unique").on(
      table.userId,
      table.flashcardId,
    ),
    index("academy_flashcard_reviews_due_idx").on(
      table.userId,
      table.nextReviewAt,
    ),
  ],
);

export const academyReviewItemsTable = pgTable(
  "academy_review_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    contentType: text("content_type").notNull(),
    sourceNoteTitle: text("source_note_title").notNull(),
    sourceExcerpt: text("source_excerpt").notNull(),
    draftContent: text("draft_content").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("pending"),
    mergedIntoId: text("merged_into_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("academy_review_items_status_idx").on(table.status)],
);

export const insertAcademyUnitSchema = createInsertSchema(academyUnitsTable);
export const insertAcademyLessonSchema = createInsertSchema(academyLessonsTable);
export const insertAcademyActivitySchema = createInsertSchema(
  academyActivitiesTable,
);
export const insertAcademyFlashcardSchema = createInsertSchema(
  academyFlashcardsTable,
);
export const insertAcademyReviewItemSchema = createInsertSchema(
  academyReviewItemsTable,
);

export type InsertAcademyUnit = z.infer<typeof insertAcademyUnitSchema>;
export type InsertAcademyLesson = z.infer<typeof insertAcademyLessonSchema>;
export type InsertAcademyActivity = z.infer<typeof insertAcademyActivitySchema>;
export type InsertAcademyFlashcard = z.infer<
  typeof insertAcademyFlashcardSchema
>;
export type InsertAcademyReviewItem = z.infer<
  typeof insertAcademyReviewItemSchema
>;
