import type { Metadata } from "next";
import { LegalTitle, Section, Bullets, Callout } from "@/components/legal/Prose";

export const metadata: Metadata = {
  title: "Privacy — PakFinance",
  description: "What PakFinance stores, why, and what it never asks for.",
};

/**
 * Privacy policy.
 *
 * Written to describe what the software actually does, checked against the
 * schema rather than adapted from a template. Where a practice is not yet
 * settled — retention periods, a named processor — it says so instead of
 * claiming a policy that is not enforced anywhere in the code.
 */
export default function PrivacyPage() {
  return (
    <>
      <LegalTitle title="Privacy" updated="16 August 2026" />

      <Callout>
        PakFinance never asks for your bank, brokerage or CDC login. There is no
        field for one anywhere in the product, and no integration that could use
        one. Every balance and holding is there because you typed it in.
      </Callout>

      <div className="mt-9">
        <Section heading="What we store">
          <p>Only what the product needs to show you your own position:</p>
          <Bullets
            items={[
              "Your email address, and your name and phone number if you choose to enter them.",
              "A profile photo, if you upload one.",
              "The financial records you create: accounts and balances, transactions, loans and payments, goals and contributions, PSX trades and mutual fund orders.",
              "A daily snapshot of your total assets and liabilities, so the net-worth chart has history.",
              "Technical records needed to run the service, such as when you last signed in.",
            ]}
          />
          <p>
            We do not store card numbers, full bank account numbers, or any
            credential to a third-party financial institution. Account numbers are
            kept as the last four digits only, and only if you enter them.
          </p>
        </Section>

        <Section heading="Who can see it">
          <p>
            You. Access is enforced in the database itself through row-level
            security, not only in the application — every query for your records
            carries your identity, and rows belonging to another user are not
            returned even if the application asks for them.
          </p>
          <p>
            We do not sell your data, and we do not share it with advertisers or
            data brokers.
          </p>
        </Section>

        <Section heading="Who processes it on our behalf">
          <p>
            Running the service means using a small number of providers, each of
            which handles a specific part:
          </p>
          <Bullets
            items={[
              "Supabase — database, authentication and file storage.",
              "Vercel — hosting and delivery of the application.",
              "Brevo — sending sign-in codes and the loan reminders you ask for.",
            ]}
          />
          <p>
            These providers process data to deliver those functions and for no
            other purpose.
          </p>
        </Section>

        <Section heading="Market data">
          <p>
            Share prices and fund NAVs come from public market sources. They
            describe the market, not you, and are stored separately from your
            records. Your holdings are never sent anywhere to be priced — the
            calculation happens on our own server against prices we already hold.
          </p>
        </Section>

        <Section heading="Email we send">
          <p>
            Sign-in and verification codes, and password resets. Beyond that, we
            email you only about things you have explicitly switched on — today
            that means a repayment reminder on a specific loan. There is no
            marketing mail, and turning a reminder off in the app stops it.
          </p>
        </Section>

        <Section heading="Keeping and deleting">
          <p>
            Your records stay until you delete them. Deleting a record removes it;
            deleting your account removes everything, including your profile, your
            photo and every financial record, and cannot be undone.
          </p>
          <p>
            You can export everything at any time from Settings, as CSV, JSON or a
            PDF report. We suggest doing that before deleting anything you might
            want later.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            You can see, correct, export and delete your data from within the
            product, without asking us. Every record type can be edited or removed
            on the screen that owns it.
          </p>
        </Section>

        <Section heading="Security">
          <p>
            Traffic is encrypted in transit. Your session can be locked behind a
            PIN, which is stored only on your own device and never sent to us.
            Passwords are held by our authentication provider as salted hashes and
            are never visible to us.
          </p>
          <p>
            No service can promise it will never be breached. What we can say is
            that a breach would not expose bank credentials, because we have never
            held any.
          </p>
        </Section>

        <Section heading="Changes and contact">
          <p>
            If this policy changes in a way that affects you, we will say so in the
            app rather than quietly updating this page.
          </p>
          <p>
            Questions about your data:{" "}
            <a
              href="mailto:support@pakfinance.app"
              className="underline underline-offset-4"
              style={{ color: "var(--brass-text)" }}
            >
              support@pakfinance.app
            </a>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
