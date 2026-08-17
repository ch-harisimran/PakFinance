import type { Metadata } from "next";
import { LegalTitle, Section, Bullets, Callout } from "@/components/legal/Prose";

export const metadata: Metadata = {
  title: "Terms — PakFinance",
  description: "The terms on which PakFinance is provided.",
};

/**
 * Terms of use.
 *
 * The important clause is the first one. A tool that displays portfolio values
 * and derives observations about them can be mistaken for advice, and in
 * Pakistan investment advice is a licensed activity — so the disclaimer leads
 * rather than hiding in a subsection near the bottom.
 */
export default function TermsPage() {
  return (
    <>
      <LegalTitle title="Terms" updated="16 August 2026" />

      <Callout>
        PakFinance is a record-keeping tool, not a financial adviser. It is not
        licensed by the SECP or any regulator to give investment advice, and
        nothing in it — including the observations in the PDF report — is a
        recommendation to buy, sell or hold anything. Decisions about your money
        are yours.
      </Callout>

      <div className="mt-9">
        <Section heading="What the service is">
          <p>
            PakFinance lets you record what you own and owe — bank balances, PSX
            trades, mutual fund orders, loans and savings goals — and shows the
            resulting position in one place. It values your holdings using publicly
            available market prices.
          </p>
          <p>
            It does not execute trades, move money, or connect to your bank or
            brokerage. It cannot transact on your behalf, by design.
          </p>
        </Section>

        <Section heading="Accuracy of figures">
          <p>
            Every figure is derived from what you enter. If a trade is recorded
            with the wrong quantity, every number that depends on it will be wrong,
            and the software has no way to know.
          </p>
          <p>
            Market prices are provided as-is from public sources. They may be
            delayed, incomplete, or wrong. Prices are not live: they update
            periodically during market hours and freeze when the market closes. Do
            not rely on them for time-sensitive decisions.
          </p>
          <p>
            Figures shown here are not a statement of account. Your broker, your
            AMC and your bank are the authoritative record.
          </p>
        </Section>

        <Section heading="Market data and its source">
          <p>
            Prices and listings come from the Pakistan Stock Exchange&rsquo;s public
            pages, and mutual fund NAVs from MUFAP&rsquo;s published daily report.
            That data belongs to them, not to us. Your use of it here is subject to
            their own terms, conditions and disclaimers, which govern the data
            regardless of what this page says — if the two ever disagree, theirs
            wins.
          </p>
          <p>
            PakFinance is not affiliated with, endorsed by, or operated in
            partnership with the Pakistan Stock Exchange, MUFAP, any asset
            management company, or any bank. Their names appear here only to say
            where a number came from.
          </p>
          <p>
            Nothing is redistributed as a data feed: prices are fetched to value
            holdings you entered yourself, and are shown to you alone.
          </p>
        </Section>

        <Section heading="A personal project, not a business">
          <p>
            PakFinance is a personal project, built and run by one person for
            personal use. It is not a commercial product. Nothing is sold, no
            subscription is offered, no advertising is carried, and your data is
            never sold or shared for anyone&rsquo;s commercial benefit.
          </p>
          <p>
            It is not a bank, a broker, an investment adviser, or a financial
            institution of any kind, and it is not licensed or regulated as one by
            the SECP, the State Bank of Pakistan, or anybody else. Nothing in it is
            investment advice. Decisions about your money are yours, and worth
            taking to a licensed professional.
          </p>
          <p>
            Because it is a personal project run at no charge, there is no service
            agreement behind it: no guaranteed uptime, no support commitment, and
            no promise that it will still exist next year. Keep your own records
            and export your data if it matters to you.
          </p>
        </Section>

        <Section heading="Your account">
          <p>You are responsible for:</p>
          <Bullets
            items={[
              "Keeping your password and PIN to yourself.",
              "The accuracy of what you enter.",
              "Using the service lawfully, and only for your own finances.",
            ]}
          />
          <p>
            Tell us promptly if you believe someone else has accessed your account.
          </p>
        </Section>

        <Section heading="Acceptable use">
          <p>
            Do not attempt to access another user&rsquo;s data, disrupt the
            service, scrape it in bulk, or reverse-engineer it to extract the
            market data it holds. We may suspend an account doing any of these.
          </p>
        </Section>

        <Section heading="Availability">
          <p>
            The service is provided as-is, without a guarantee of uptime. Scheduled
            jobs — price syncs, the daily snapshot, reminder emails — may be
            delayed or fail. A reminder is a convenience, not a guarantee: missing
            one does not excuse a missed payment, and you remain responsible for
            your obligations to your lender.
          </p>
        </Section>

        <Section heading="Liability">
          <p>
            To the extent permitted by law, PakFinance is not liable for financial
            loss arising from decisions made using the service, from inaccurate
            market data, or from interruptions to it.
          </p>
        </Section>

        <Section heading="Ending it">
          <p>
            You can delete your account at any time from Settings, which removes
            your data permanently. Export it first if you want a copy — we cannot
            recover it afterwards.
          </p>
        </Section>

        <Section heading="Governing law and contact">
          <p>
            These terms are governed by the laws of the Islamic Republic of
            Pakistan.
          </p>
          <p>
            Questions:{" "}
            <a
              href="mailto:pakfinance.app@gmail.com"
              className="underline underline-offset-4"
              style={{ color: "var(--brass-text)" }}
            >
              pakfinance.app@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>
    </>
  );
}
