CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `batch_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`input_markdown` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_jobs` integer DEFAULT 0 NOT NULL,
	`completed_jobs` integer DEFAULT 0 NOT NULL,
	`failed_jobs` integer DEFAULT 0 NOT NULL,
	`fit_threshold` integer DEFAULT 70 NOT NULL,
	`summary_table` text,
	`warnings` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `company_research` (
	`id` text PRIMARY KEY NOT NULL,
	`job_application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`company_size` text,
	`funding_stage` text,
	`revenue` text,
	`founded_year` text,
	`headquarters` text,
	`industry` text,
	`recent_news` text,
	`tech_stack` text,
	`culture_signals` text,
	`key_people` text,
	`mission_and_values` text,
	`sources` text,
	`companies_house_number` text,
	`companies_house_data` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`job_application_id`) REFERENCES `job_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `consistency_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`example_id` text,
	`company` text NOT NULL,
	`topic` text NOT NULL,
	`claim` text NOT NULL,
	`interview_date` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`example_id`) REFERENCES `examples`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `example_tags` (
	`example_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`example_id`) REFERENCES `examples`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `examples` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transcript_id` text,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`source_position` text,
	`quality_rating` text,
	`star_situation` text,
	`star_task` text,
	`star_action` text,
	`star_result` text,
	`star_reflection` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcripts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `fit_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`job_application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`archetype` text NOT NULL,
	`archetype_rationale` text,
	`dim_domain_industry` text,
	`dim_seniority` text,
	`dim_scope` text,
	`dim_technical` text,
	`dim_mission` text,
	`dim_location` text,
	`dim_compensation` text,
	`dim_culture` text,
	`overall_score` integer,
	`weights` text,
	`red_flags` text,
	`green_flags` text,
	`example_ids_used` text,
	`dismissed_red_flags` text,
	`dimension_annotations` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`job_application_id`) REFERENCES `job_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `generated_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`job_application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`example_ids_used` text,
	`prompt_hash` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`job_application_id`) REFERENCES `job_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_title` text NOT NULL,
	`company_name` text NOT NULL,
	`job_url` text,
	`job_description` text NOT NULL,
	`salary` text,
	`location` text,
	`researched_at` text,
	`assessed_at` text,
	`materials_at` text,
	`fit_score_overall` integer,
	`fit_archetype` text,
	`status` text DEFAULT 'researching' NOT NULL,
	`notes` text,
	`batch_id` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`is_system` integer DEFAULT false,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`raw_text` text NOT NULL,
	`company` text,
	`interviewer_name` text,
	`interviewer_role` text,
	`interview_date` text,
	`interview_round` text,
	`extracted_at` text,
	`enriched_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
