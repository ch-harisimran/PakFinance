CREATE SCHEMA "market";
--> statement-breakpoint
CREATE TYPE "market"."action_kind" AS ENUM('BONUS', 'SPLIT', 'RIGHT', 'DIVIDEND');--> statement-breakpoint
CREATE TYPE "market"."security_kind" AS ENUM('EQUITY', 'ETF', 'REIT', 'PREF', 'DEBT');--> statement-breakpoint
CREATE TABLE "market"."corporate_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"kind" "market"."action_kind" NOT NULL,
	"ex_date" date NOT NULL,
	"ratio_from" numeric(10, 4),
	"ratio_to" numeric(10, 4),
	"amount" numeric(14, 4)
);
--> statement-breakpoint
CREATE TABLE "market"."fund_navs" (
	"fund_id" uuid NOT NULL,
	"nav" numeric(14, 4) NOT NULL,
	"session_date" date NOT NULL,
	CONSTRAINT "fund_navs_fund_id_session_date_pk" PRIMARY KEY("fund_id","session_date")
);
--> statement-breakpoint
CREATE TABLE "market"."funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amc" text NOT NULL,
	"category" text NOT NULL,
	"is_islamic" boolean DEFAULT false NOT NULL,
	"mufap_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "funds_mufap_code_unique" UNIQUE("mufap_code")
);
--> statement-breakpoint
CREATE TABLE "market"."market_holidays" (
	"holiday_date" date PRIMARY KEY NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."price_latest" (
	"symbol" text PRIMARY KEY NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"ldcp" numeric(14, 4),
	"day_high" numeric(14, 4),
	"day_low" numeric(14, 4),
	"volume" bigint,
	"change_pct" numeric(8, 4),
	"as_of" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."prices" (
	"symbol" text NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"volume" bigint,
	"as_of" timestamp with time zone NOT NULL,
	CONSTRAINT "prices_symbol_as_of_pk" PRIMARY KEY("symbol","as_of")
);
--> statement-breakpoint
CREATE TABLE "market"."prices_daily" (
	"symbol" text NOT NULL,
	"session_date" date NOT NULL,
	"open" numeric(14, 4),
	"high" numeric(14, 4),
	"low" numeric(14, 4),
	"close" numeric(14, 4) NOT NULL,
	"volume" bigint,
	CONSTRAINT "prices_daily_symbol_session_date_pk" PRIMARY KEY("symbol","session_date")
);
--> statement-breakpoint
CREATE TABLE "market"."securities" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "market"."security_kind" NOT NULL,
	"sector" text,
	"board" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."sessions" (
	"weekday" smallint NOT NULL,
	"seq" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"label" text,
	CONSTRAINT "sessions_weekday_seq_pk" PRIMARY KEY("weekday","seq")
);
--> statement-breakpoint
CREATE TABLE "market"."sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"rows_written" bigint,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "market"."corporate_actions" ADD CONSTRAINT "corporate_actions_symbol_securities_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "market"."securities"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."fund_navs" ADD CONSTRAINT "fund_navs_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "market"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."price_latest" ADD CONSTRAINT "price_latest_symbol_securities_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "market"."securities"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."prices" ADD CONSTRAINT "prices_symbol_securities_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "market"."securities"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."prices_daily" ADD CONSTRAINT "prices_daily_symbol_securities_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "market"."securities"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corp_actions_symbol_idx" ON "market"."corporate_actions" USING btree ("symbol","ex_date");--> statement-breakpoint
CREATE INDEX "prices_as_of_idx" ON "market"."prices" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "securities_active_idx" ON "market"."securities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sync_runs_job_idx" ON "market"."sync_runs" USING btree ("job","started_at");