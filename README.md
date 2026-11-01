# MemoValet Pay

MemoValet Pay turns what was agreed in a meeting into a PayPal invoice. An AI assistant works out which tool to use, proposes the invoice agreed in the meeting, and then stops. Nothing goes out until a person approves the exact amount and payer. The invoice is then sent through the PayPal sandbox, and its status is read back from PayPal.

Built for the PayPal AI Hackathon. It uses the PayPal sandbox only, so all the money here is test money. The sample meeting, people and businesses are fictional.

## The problem

Freelancers and small studios agree on paid work in a meeting ("I'll send the deposit invoice today"). Then the invoice goes out late or not at all, and nobody tracks whether it was paid.

## How it works

1. You ask the assistant to bill what was agreed in the sample meeting.
2. The assistant calls `propose_invoice`, which returns the payment stored with the fictional sample meeting. This is a draft, and it creates nothing in PayPal.
3. A card shows the payer, amount, due date and the line of the meeting it came from.
4. You tap **Approve and send**. That tap creates a signed approval for this exact invoice, which lasts 15 minutes.
5. The assistant calls `send_invoice`. MemoValet creates the invoice with PayPal's Invoicing API and sends it.
6. `invoice_status` reads the status back from PayPal.
7. If it is unpaid after its due date, `draft_payment_reminder` writes a polite reminder. It stays a draft.

The AI can propose, but it has no tool that approves money going out. The model is never shown the approval token, and the server refuses `send_invoice` without a valid one. One run of the flow can only make one invoice: each run has its own invoice number, and PayPal refuses a number it has seen, so a retry or a second tap finds the first invoice instead of billing again.

If the AI is too busy to answer, the screen says so and calls the tools itself for that step, so you can still finish.

## Limits of this demo

* It works from one fictional sample meeting. The payment details are stored with that meeting, so the AI chooses the tools and explains the result, but it does not work out the amount.
* It has no sign in, because it runs on your own computer with sample data. The AI can't reach the approve route, but another program on the same computer could call it directly. A real product would tie each approval to a signed in owner.
* Overdue reminders have only been tested against a pretend PayPal.

## Run it

You need:

* Node.js 20.9 or newer.
* A free PayPal developer account at [developer.paypal.com](https://developer.paypal.com/), with one sandbox app. Find it under Apps & Credentials, Sandbox.
* A sandbox personal (buyer) account, so a test invoice can be paid. Find it under Testing Tools, Sandbox Accounts.
* A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Without one, the screen still works, but it calls the tools itself and says so.

You do not need Supabase, Google sign in or a MemoValet account.

```bash
git clone https://github.com/adrim007/memovalet-pay.git
cd memovalet-pay
npm ci
cp .env.example .env.local
```

Open `.env.local` and fill it in:

| Setting | What goes there |
|---|---|
| `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` | The keys of your sandbox app |
| `PAYPAL_SANDBOX_BUYER_EMAIL` | The email of your sandbox personal account |
| `MEMOVALET_APPROVAL_SECRET` | Any long random text. `openssl rand -hex 32` makes one |
| `GEMINI_API_KEY` | Your Gemini key |

Leave `PAYPAL_ENV` and `PAYPAL_API_BASE` as they are. The app refuses to call PayPal if either one points anywhere but the sandbox.

```bash
npm run dev
```

Then open http://localhost:3000/preview/pay and try this:

1. Press **Ask** to send the suggested request.
2. Check the invoice card, then press **Approve and send**.
3. Press **Open the invoice as the buyer sees it**, and pay it while signed in to your sandbox personal account.
4. Press **Check if it's paid** to read the latest status from PayPal.
5. Press **Start again** for a fresh run.

## Use the MCP server directly

The MCP server runs at http://localhost:3000/api/paypal/mcp over Streamable HTTP. It follows the 25 November 2025 MCP specification, in stateless mode with JSON responses. Any MCP client on the same computer can connect to it.

```json
{"mcpServers":{"memovalet-pay":{"type":"http","url":"http://localhost:3000/api/paypal/mcp"}}}
```

Or a quick check from a terminal while the app is running:

```bash
curl -s http://localhost:3000/api/paypal/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Its four tools:

* `propose_invoice` reads the sample meeting and returns a proposed invoice. It changes nothing.
* `send_invoice` is the only tool that changes anything. It needs the approval token from the person's tap, and only for exactly what they approved.
* `invoice_status` reads an invoice's status from PayPal.
* `draft_payment_reminder` writes a reminder for an overdue invoice and sends nothing.

## Where the code is

* `lib/paypal/client.ts` is the PayPal client: sandbox token, create draft invoice, send, read status.
* `lib/paypal/sandbox.ts` refuses anything but the sandbox.
* `lib/paypal/approval.ts` is the approval gate: a signed token for one payer, currency, total, item list and due date, and the invoice number for each run.
* `lib/paypal/mcp-server.ts` is the MCP server, built with the official MCP TypeScript SDK.
* `lib/paypal/assistant.ts` is the assistant: an MCP client that gives the tools to the model through function calling. It uses Gemini by default, or Claude if `ANTHROPIC_API_KEY` is set instead.
* `lib/paypal/invoice-flow.ts` holds the fictional sample meeting, the proposal and the reminder.
* `app/preview/pay/page.tsx` is the screen. `app/api/paypal` holds its routes.

## Tests

```bash
node --test tests/paypal.test.cjs tests/paypal_assistant.test.cjs
```

These run against a pretend PayPal, so they need no keys. They cover the sandbox only rule, the main ways the approval gate refuses, one run making one invoice, recovery after a failed send, and the model never seeing the token.

## What is new since 1 October 2026

MemoValet existed before this hackathon as a meeting assistant. Everything PayPal is new: the PayPal client, the sandbox only check, the signed approval gate, the four MCP tools, the assistant that uses them, the screen and their tests.

## The rest of this repository

The rest is the MemoValet app these pieces were added to: meeting summaries, decisions, action items, search across past meetings, and exports. It needs a Supabase project and Google sign in, and MemoValet Pay does not use any of that. The earlier sample screens under `app/preview` are from that work.

To run the full app, run every file in `supabase/migrations/` in order, then add your Supabase, Google OAuth and AI keys to `.env.local`.

## Tools used

* PayPal Invoicing API v2 in the PayPal sandbox.
* Gemini through function calling, with Claude as the other option.
* The Model Context Protocol TypeScript SDK.
* Next.js.
* Claude helped write this code. Adrian Kulatunga chose the idea and directed the work.

## Licence

MIT. See [LICENSE](LICENSE).
