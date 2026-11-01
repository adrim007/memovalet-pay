import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeAccountLink, upsertStripeAccountLink } from "@/lib/database";
import { getStripe } from "@/lib/stripe";

// GET /api/stripe/connect → current status (refreshed from Stripe)
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const stripe = getStripe();
    const link = await getStripeAccountLink(user.id);
    if (!stripe || !link) {
      return NextResponse.json({
        configured: !!stripe,
        connected: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      });
    }

    const account = await stripe.accounts.retrieve(link.stripe_account_id);
    const chargesEnabled = !!account.charges_enabled;
    const detailsSubmitted = !!account.details_submitted;
    if (chargesEnabled !== link.charges_enabled || detailsSubmitted !== link.details_submitted) {
      await upsertStripeAccountLink({
        userId: user.id,
        stripeAccountId: link.stripe_account_id,
        chargesEnabled,
        detailsSubmitted,
      });
    }

    return NextResponse.json({ configured: true, connected: true, chargesEnabled, detailsSubmitted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't check Stripe status" }, { status: 500 });
  }
}

// POST /api/stripe/connect → create (or resume) Stripe onboarding, returns { url }
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Payments aren't switched on for MemoValet yet." }, { status: 503 });
    }

    const origin = new URL(req.url).origin;
    let link = await getStripeAccountLink(user.id);

    if (!link) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { memovalet_user_id: user.id },
      });
      const saved = await upsertStripeAccountLink({
        userId: user.id,
        stripeAccountId: account.id,
        chargesEnabled: !!account.charges_enabled,
        detailsSubmitted: !!account.details_submitted,
      });
      if (!saved) return NextResponse.json({ error: "Couldn't save your Stripe link" }, { status: 500 });
      link = await getStripeAccountLink(user.id);
    }

    if (!link) return NextResponse.json({ error: "Couldn't start Stripe setup" }, { status: 500 });

    const accountLink = await stripe.accountLinks.create({
      account: link.stripe_account_id,
      refresh_url: `${origin}/settings?stripe=refresh#get-paid`,
      return_url: `${origin}/settings?stripe=return#get-paid`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't start Stripe setup" }, { status: 500 });
  }
}
