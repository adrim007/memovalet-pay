import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { billingAccount, billingReady, refreshBilling, withBillingLock } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { planAccess } from "@/lib/plan-access";

export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  try {
    const db = createServiceClient();
    const access = await planAccess(user.id);
    const seats = await db.from("billing_seats").select("user_id").eq("payer_id",user.id);
    const teams = await db.from("teams").select("id").eq("created_by",user.id);
    if (seats.error || teams.error) throw new Error();
    const members = teams.data.length ? await db.from("team_members").select("user_id").in("team_id",teams.data.map(t=>t.id)) : {data:[],error:null};
    if (members.error) throw new Error();
    const assigned = new Set(seats.data.map(s=>s.user_id));
    const ids = [...new Set([...assigned,...(members.data || []).map(m=>m.user_id)])].filter(id=>id!==user.id);
    const people = await Promise.all(ids.map(async id=>{
      const result = await db.auth.admin.getUserById(id);
      if(result.error) throw new Error();
      return {id, label:result.data.user?.email || "Group member", assigned:assigned.has(id)};
    }));
    return NextResponse.json({ access, people, canManage: access.payer_id === user.id },{headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"Your seats could not be loaded. Please retry."},{status:503}); }
}
export async function POST(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({error:"Please sign in first"},{status:401});
  if(req.headers.get("origin")!==new URL(req.url).origin) return NextResponse.json({error:"Invalid request origin"},{status:403});
  if(!billingReady()) return NextResponse.json({error:"Paid seats are not available yet."},{status:503});
  try {
    const body=await req.json();
    if(typeof body.userId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId) || typeof body.remove!=="boolean") return NextResponse.json({error:"Choose a valid group member"},{status:400});
    const result=await withBillingLock(user.id,async()=>{
      const account=await billingAccount(user.id);
      if(!account?.customer_id) throw new Error("A Business subscription is required.");
      await refreshBilling(getStripe()!,account);
      const result=await createServiceClient().rpc("assign_billing_seat",{p_owner:user.id,p_user:body.userId,p_remove:body.remove});
      if(result.error) throw new Error("The seat could not be updated.");
      return result.data;
    });
    return NextResponse.json(result,{status:result?.ok?200:409});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Your seats could not be updated."},{status:503}); }
}
