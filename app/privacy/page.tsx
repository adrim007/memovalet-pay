import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata = {
  title: "MemoValet Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mk-dark relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] mk-grid-fade" />
      <MarketingNav active="/privacy" />

      <main className="relative px-6 pt-20 pb-24 md:pt-24">
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide brand-gradient-text mb-3">
            Legal
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-light tracking-tighter mb-4">
            Privacy Policy
          </h1>
          <p className="text-white/45 text-sm mb-12">
            Last updated October 10, 2026
          </p>

          <div className="space-y-10 text-white/70 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">1. Who we are</h2>
              <p>
                MemoValet (&quot;we&quot;, &quot;us&quot;) helps you organise tasks, projects, notes,
                files, appointments and shared work. It also supports video calls, captions,
                translations and meeting summaries. This policy explains what information we collect, how we use it, who
                handles it, and the choices you have. If you have questions, contact us at{" "}
                <a href="mailto:adrian.kulatunga@gmail.com" className="text-white underline">
                  adrian.kulatunga@gmail.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">2. Information we collect</h2>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  <span className="text-white/90">Account information:</span> your name and email address. If you sign up
                  with email, a password, which our authentication provider stores in hashed form
                  (we never see it). If you sign in with Google or Microsoft, the name and email on
                  that account. If you turn on two step verification, the secret your authenticator app
                  uses.
                </li>
                <li>
                  <span className="text-white/90">Your work and meeting content:</span> transcripts you paste or record; recordings
                  (video or sound) you make in MemoValet or add from your device; and the notes,
                  projects, tasks, and files you create or upload.
                </li>
                <li>
                  <span className="text-white/90">Google Calendar, only if you connect it:</span> we read
                  upcoming event titles, times, participants and meeting links to show your schedule.
                  Where direct calendar sync is available and you enable it, we also read your calendar
                  list so you can select a calendar you can edit. We create, update and remove linked
                  events for the categories of your own work that you select. These events contain the
                  work title, date, time where provided and identifiers linking the event to your work.
                  Changes to linked event titles and dates can update the corresponding work in MemoValet.
                  Direct sync does not import unrelated Google events into your tasks or modify them.
                </li>
                <li>
                  <span className="text-white/90">Other Google services, only if you connect them:</span> from
                  Gmail, we look at messages from the last 14 days that contain a Google Meet
                  link, reading their subject and preview, to find meetings you&apos;ve been invited
                  to; and we send email from your Gmail only when you choose to email a meeting to
                  its attendees. In Google Drive, we create a Google Doc when you export a meeting,
                  and can only access files MemoValet created.
                </li>
                <li>
                  <span className="text-white/90">Connection records:</span> we store the Google authorisation
                  tokens needed to maintain the access you grant. For direct calendar sync, we also store
                  your selected calendar, chosen work categories, time zone, linked event identifiers,
                  titles, dates and sync status so we can apply changes and identify conflicting edits.
                  We do not receive your Google password.
                </li>
                <li>
                  <span className="text-white/90">Other tools, only if you connect them:</span> for Slack, the channel you
                  choose; for Notion, the page you share with MemoValet; for Trello, the list you
                  choose.
                </li>
                <li>
                  <span className="text-white/90">Location for the weather on your home page:</span> by
                  default, the rough location of your internet connection, which isn&apos;t stored. If
                  you choose a place instead, or use your current location, we save that place,
                  rounded to about a kilometre, with your account until you change it.
                </li>
                <li>
                  <span className="text-white/90">Technical logs:</span> our hosting providers record technical information
                  such as errors, request times, and IP addresses so we can keep the service running
                  and secure. We don&apos;t use advertising trackers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                3. How we use your information
              </h2>
              <p className="mb-2">We use your information to:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  Generate summaries, decisions, action items, emails following meetings, translations, and
                  answers to your questions from your meeting content, using Google&apos;s Gemini
                  API.
                </li>
                <li>
                  Write down what is said in live calls, for captions and the meeting transcript.
                  Your browser&apos;s speech recognition does this where it can (in Chrome,
                  that service is run by Google). Where it can&apos;t, short pieces of your own
                  microphone&apos;s sound are sent to Google&apos;s Gemini API to be written down.
                  MemoValet keeps only the words, never that sound.
                </li>
                <li>
                  Find your upcoming meetings from Google Calendar and Gmail, if you connect Google.
                  To pick out meeting details from Gmail messages, we send their subject and preview
                  to Google&apos;s Gemini API.
                </li>
                <li>
                  Keep selected tasks, project deadlines and scheduled calls in sync with the Google
                  Calendar you choose, when you enable direct sync. If both versions have changed,
                  we show the conflict for you to resolve. Completing or removing linked work in
                  MemoValet can remove its Google event. Deleting a linked event in Google clears
                  its schedule in MemoValet while keeping the underlying work record.
                </li>
                <li>
                  Send your meeting to the people you choose, and to your own connected tools
                  (Google Docs, Slack, Notion, Trello) only when you turn that on.
                </li>
                <li>
                  Send you account emails, such as confirming your address and resetting your
                  password, and notifications you can turn off in Settings (including the daily
                  email about overdue action items).
                </li>
                <li>
                  Operate, maintain, and improve MemoValet, including troubleshooting and
                  security.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                4. Who we share information with
              </h2>
              <p className="mb-2">
                We don&apos;t sell your data. We share information only with the service providers
                needed to run MemoValet, and only for that purpose:
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  <span className="text-white/90">Google (Gemini API)</span>: processes meeting text, short pieces of call
                  sound when your browser can&apos;t write down speech itself, and Gmail subjects and
                  previews if you connect Google, to generate captions, summaries, translations, and answers.
                </li>
                <li>
                  <span className="text-white/90">MET Norway</span>: receives a location rounded to about a kilometre,
                  and nothing that identifies you, to provide the weather forecast.
                </li>
                <li>
                  <span className="text-white/90">Tenor (Google)</span>: receives the words you type when you search for a
                  GIF in a meeting chat, asked for by MemoValet&apos;s servers rather than your browser, so Tenor is not
                  told who you are or where you are. Results are limited to Tenor&apos;s family friendly setting.
                </li>
                <li>
                  <span className="text-white/90">Geoapify</span>: receives what you type when searching for an address or
                  a town, and your rounded location if you use your current location for the weather.
                </li>
                <li>
                  <span className="text-white/90">Supabase</span>: hosts our database, account authentication and private file storage,
                  including recordings and uploaded files.
                </li>
                <li>
                  <span className="text-white/90">Vercel</span>: hosts the MemoValet application.
                </li>
                <li>
                  <span className="text-white/90">Resend</span>: delivers MemoValet&apos;s emails, including meeting packs
                  you send, which contain that meeting&apos;s content.
                </li>
                <li>
                  <span className="text-white/90">LiveKit</span>: carries audio and video between participants in live
                  sessions.
                </li>
                <li>
                  <span className="text-white/90">Google and Microsoft</span>: sign you in and, for Google, provide the
                  Calendar, Gmail, and Drive access you choose to grant.
                </li>
                <li>
                  <span className="text-white/90">Your own connected tools</span> (Google Docs, Slack, Notion, Trello): only
                  the meeting you export, and only when you turn that on.
                </li>
                <li>
                  <span className="text-white/90">People you share with</span>: when you send a meeting or create a share
                  link, the people you send it to, and anyone who has the share link, can see that
                  meeting.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                5. Where your information is processed
              </h2>
              <p>
                Our database, file storage, and application servers are in Japan (Tokyo). Some of
                the providers above, including Google, Resend, and LiveKit, may process
                information in other countries, including the United States. By using MemoValet,
                you understand that your information may be stored and processed outside
                Australia.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">6. Google user data</h2>
              <p>
                MemoValet&apos;s use and transfer to any other app of information received from
                Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  className="text-white underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We don&apos;t use Google user data to
                develop or train AI models, and we don&apos;t sell it or use it for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                7. Data retention and deletion
              </h2>
              <p>
                We keep your meetings for as long as your account is active, so you can search and
                revisit your history. You can ask us to delete individual meetings or your entire
                account at any time by contacting us; deleted data is removed from our active
                systems within 30 days. A share link keeps working until the meeting is deleted,
                so contact us if you need one turned off.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">8. Security</h2>
              <p>
                We use standard industry measures, including encryption in transit, access controls,
                private storage for recordings, and scoped credentials for connected tools, to
                protect your information. You can add two step verification to your account. No
                method of transmission or storage is completely secure, but we work to protect your
                data appropriately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">9. Your choices and rights</h2>
              <p className="mb-3">
                You can pause direct Google Calendar sync from Calendar, then Sync calendar. Pausing
                stops updates and keeps existing events. Removing a work category from sync also keeps
                its existing events and stops further updates for that category. Pausing does not revoke
                Google access or erase the connection records. You can revoke access through your Google
                account and contact us to request deletion of stored connection records.
              </p>
              <p>
                You can remove MemoValet&apos;s access to your Google account at any time from your{" "}
                <a href="https://myaccount.google.com/permissions" className="text-white underline">
                  Google Account permissions
                </a>
                . Slack, Notion, and Trello can be disconnected in Settings, where you can also turn
                off email notifications. You can ask us for a copy of your information, to correct
                it, or to delete it by emailing us. If you&apos;re not satisfied with how we handle
                a privacy concern, you can contact the{" "}
                <a href="https://www.oaic.gov.au" className="text-white underline">
                  Office of the Australian Information Commissioner
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">10. Children&apos;s privacy</h2>
              <p>
                MemoValet is not directed at anyone under 16, and we do not knowingly collect
                information from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">11. Changes to this policy</h2>
              <p>
                If we make material changes to this policy, we&apos;ll update the date at the top of
                this page and, where appropriate, notify you directly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
              <p>
                Questions about this policy or your data can be sent to{" "}
                <a href="mailto:adrian.kulatunga@gmail.com" className="text-white underline">
                  adrian.kulatunga@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
