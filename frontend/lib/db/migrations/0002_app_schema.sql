CREATE TYPE "public"."account_kind" AS ENUM('CURRENT', 'SAVINGS', 'CASH', 'WALLET');--> statement-breakpoint
CREATE TYPE "public"."fund_order_type" AS ENUM('BUY', 'REDEEM', 'DIVIDEND');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('ACTIVE', 'ACHIEVED', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."loan_direction" AS ENUM('BORROWED', 'LENT');--> statement-breakpoint
CREATE TYPE "public"."loan_kind" AS ENUM('PERSONAL', 'CAR', 'HOME', 'CREDIT_CARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."trade_type" AS ENUM('BUY', 'SELL', 'DIVIDEND', 'BONUS', 'RIGHT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" DEFAULT 'CURRENT' NOT NULL,
	"masked_number" text,
	"balance_paisa" bigint DEFAULT 0 NOT NULL,
	"as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"type" "fund_order_type" NOT NULL,
	"units" numeric(18, 4) NOT NULL,
	"nav_paisa" bigint NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"traded_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"occurred_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"target_paisa" bigint NOT NULL,
	"target_date" date,
	"status" "goal_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"principal_paisa" bigint,
	"markup_paisa" bigint,
	"late_fee_paisa" bigint,
	"paid_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lender" text,
	"kind" "loan_kind" DEFAULT 'PERSONAL' NOT NULL,
	"direction" "loan_direction" DEFAULT 'BORROWED' NOT NULL,
	"principal_paisa" bigint NOT NULL,
	"markup_rate" numeric(6, 3),
	"tenure_months" smallint,
	"installment_paisa" bigint,
	"start_date" date NOT NULL,
	"due_day" smallint,
	"is_settled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "net_worth_daily" (
	"user_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"assets_paisa" bigint NOT NULL,
	"liabilities_paisa" bigint NOT NULL,
	CONSTRAINT "net_worth_daily_user_id_session_date_pk" PRIMARY KEY("user_id","session_date")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"phone" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"notation" text DEFAULT 'international' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"type" "trade_type" NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"price_paisa" bigint NOT NULL,
	"commission_paisa" bigint DEFAULT 0 NOT NULL,
	"other_charges_paisa" bigint DEFAULT 0 NOT NULL,
	"traded_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"label" text NOT NULL,
	"category" text,
	"note" text,
	"amount_paisa" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fund_transactions" ADD CONSTRAINT "fund_transactions_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "market"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_symbol_securities_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "market"."securities"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fund_txn_user_idx" ON "fund_transactions" USING btree ("user_id","fund_id");--> statement-breakpoint
CREATE INDEX "goal_contributions_goal_idx" ON "goal_contributions" USING btree ("goal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "goal_contributions_user_idx" ON "goal_contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loan_payments_loan_idx" ON "loan_payments" USING btree ("loan_id","paid_at");--> statement-breakpoint
CREATE INDEX "loan_payments_user_idx" ON "loan_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_txn_user_idx" ON "stock_transactions" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");