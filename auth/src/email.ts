/**
 * Transactional email delivery through SendLiberty.
 *
 * SendLiberty's REST API sends from the connected Gmail/Workspace account.
 * The From header always carries the product display name so recipients see
 * "Mobigate Group", not the relay address.
 */
type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

const DEFAULT_FROM_NAME = 'Mobigate Group'
const DEFAULT_BASE_URL = 'https://sendliberty.com'
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Sends one transactional email. Provider response bodies are deliberately
 * not surfaced or logged because they can contain recipient metadata.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.SENDLIBERTY_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('SENDLIBERTY_API_KEY is not configured')
  }

  const response = await fetch(
    `${(process.env.SENDLIBERTY_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')}/api/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromHeader(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(process.env.SENDLIBERTY_REPLY_TO?.trim()
          ? { replyTo: process.env.SENDLIBERTY_REPLY_TO.trim() }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )

  if (!response.ok) {
    throw new Error(`SendLiberty rejected the email with status ${response.status}`)
  }
}

function fromHeader(): string {
  const configured = process.env.SENDLIBERTY_FROM?.trim()
  if (!configured) {
    throw new Error('SENDLIBERTY_FROM is not configured')
  }
  if (configured.includes('<')) return configured

  const name = (process.env.SENDLIBERTY_FROM_NAME?.trim() || DEFAULT_FROM_NAME)
    .replace(/["\\]/g, '')
    .trim()
  return `"${name || DEFAULT_FROM_NAME}" <${configured}>`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
