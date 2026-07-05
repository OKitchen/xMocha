import Link from "next/link";

export const metadata = {
  title: "Privacy | xMocha",
  description:
    "How xMocha handles decision simulation inputs, contact details, analytics, and deletion requests.",
};

const pageStyle = {
  minHeight: "100vh",
  background: "#08111f",
  color: "#e6eefc",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  lineHeight: 1.6,
  padding: "48px 20px",
} as const;

const contentStyle = {
  width: "min(900px, 100%)",
  margin: "0 auto",
  padding: "28px",
  border: "1px solid #314265",
  borderRadius: 12,
  background: "#0d1729",
} as const;

const mutedStyle = { color: "#9fb1d1" } as const;

export default function PrivacyPage() {
  return (
    <main style={pageStyle}>
      <article style={contentStyle}>
        <Link href="/" style={{ color: "#5eead4", fontWeight: 800 }}>
          Back to xMocha
        </Link>
        <h1 style={{ marginBottom: 8 }}>Privacy and Safety</h1>
        <p style={mutedStyle}>Last updated: 2026-06-29</p>

        <h2>What xMocha is</h2>
        <p>
          xMocha is a decision-simulation tool. You enter a dilemma,
          compare possible futures, choose one path, and see how the
          consequences may unfold. xMocha is for reflection and scenario
          simulation. It does not provide medical, legal, financial, or
          mental-health advice.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Dilemma text, supplemental context, uploaded text, and choices.</li>
          <li>
            Contact details when you join beta, partner, invest, or offer
            resources.
          </li>
          <li>
            Product analytics such as session started, completed, shared, and
            feedback submitted.
          </li>
          <li>Basic operational logs used to debug reliability and model failures.</li>
        </ul>

        <h2>What not to enter</h2>
        <p>
          Do not enter passwords, identity documents, full financial records,
          detailed health records, or anything you would not want processed by
          an AI model.
        </p>

        <h2>AI model processing</h2>
        <p>
          Your input may be sent to configured model providers to generate the
          simulation. xMocha can run through local or cloud model providers
          depending on deployment configuration.
        </p>

        <h2>Storage and sharing</h2>
        <p>
          xMocha stores structured session data, analytics events, and contact
          submissions. Private World uploads are not stored as raw source text by
          default. We do not sell personal information. We share data only with
          providers needed to run the service or when legally required.
        </p>

        <h2>Deletion requests</h2>
        <p>
          Deletion and correction requests are handled manually during the
          early-stage seed cohort. A dedicated privacy contact will be added
          before broader public data collection.
        </p>

        <h2>Feedback quotes</h2>
        <p>
          Feedback is used to improve xMocha. We only use a user quote in public
          or investor materials when the user explicitly gives permission, and we
          keep quotes anonymous unless the user separately agrees otherwise.
        </p>
      </article>
    </main>
  );
}
