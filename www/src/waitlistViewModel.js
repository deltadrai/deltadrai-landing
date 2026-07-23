/**
 * waitlistViewModel — ViewModel for the coming-soon waitlist form.
 * Registered with Alpine as `x-data`. Submits the visitor's email to
 * Formspree via the injected client, alongside a fixed staff-facing lead
 * notice that the visitor never sees or edits.
 *
 * @param {object} deps
 * @param {import('./formspreeClient.js').FormspreeClient} deps.client
 * @param {string} deps.staffMessage
 */
export function createWaitlistViewModel({ client, staffMessage }) {
  return {
    email: '',
    status: 'idle', // idle | submitting | success | error

    /** Alpine @submit.prevent: send the email to Formspree. */
    async submit() {
      if (this.status === 'submitting' || this.status === 'success') return;
      this.status = 'submitting';
      try {
        const ok = await client.submit({ email: this.email, message: staffMessage });
        this.status = ok ? 'success' : 'error';
      } catch {
        this.status = 'error';
      }
    },
  };
}
