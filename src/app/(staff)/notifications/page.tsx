import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam } from "@/lib/data/common";
import { PROVIDERS } from "@/lib/integrations/notifications/registry";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { RetryNotificationButton } from "./retry-button";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff("notification.view");
  const sp = await searchParams;
  const status = pickParam(sp.status) ?? "";
  const supabase = await createClient();
  let q = supabase
    .from("notification_logs")
    .select("id, event, channel, recipient, status, error, attempts, provider, created_at, sent_at, reservation_id, restaurant_id")
    .in("restaurant_id", ctx.branchIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status as "sent");
  const [{ data: logs }, { data: templates }] = await Promise.all([
    q,
    supabase.from("notification_templates").select("*").order("event").order("channel").order("locale"),
  ]);
  const canEdit = roleCan(ctx.role, "notification.templates");

  return (
    <div className="space-y-6">
      <PageHeader title="Notification center" description="Every message attempt is logged with its real delivery status." />
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.values(PROVIDERS).map((p) => (
          <Card key={p.channel} className="p-3">
            <p className="text-xs uppercase text-muted">{p.channel}</p>
            <p className="font-medium">{p.name}</p>
            <Badge tone={p.isConfigured() ? "green" : "slate"} className="mt-1">{p.isConfigured() ? "Configured" : "Not configured"}</Badge>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery log</CardTitle>
          <form className="flex gap-2">
            <Select name="status" defaultValue={status} className="h-8 w-40">
              <option value="">All statuses</option>
              {["queued", "sending", "sent", "failed", "not_configured"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </Select>
            <Button size="sm" variant="outline">Filter</Button>
          </form>
        </CardHeader>
        <CardContent>
          <DataTable>
            <thead><tr><Th>Time</Th><Th>Event</Th><Th>Channel</Th><Th>Recipient</Th><Th>Status</Th><Th>Attempts</Th><Th></Th></tr></thead>
            <tbody>
              {(logs ?? []).map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</Td>
                  <Td>{l.event.replace(/_/g, " ")}</Td>
                  <Td>{l.channel}</Td>
                  <Td className="text-xs">{l.recipient}</Td>
                  <Td>
                    <Badge tone={l.status === "sent" ? "green" : l.status === "not_configured" ? "slate" : l.status === "failed" ? "red" : "yellow"}>{l.status.replace("_", " ")}</Badge>
                    {l.error ? <p className="mt-1 max-w-xs text-xs text-muted">{l.error}</p> : null}
                  </Td>
                  <Td className="tabular-nums">{l.attempts}</Td>
                  <Td>{l.status === "failed" || l.status === "not_configured" ? <RetryNotificationButton id={l.id} /> : null}</Td>
                </tr>
              ))}
              {(logs ?? []).length === 0 ? <tr><Td colSpan={7} className="py-8 text-center text-muted">No notifications yet.</Td></tr> : null}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          {canEdit ? (
            <Dialog>
              <DialogTrigger asChild><Button size="sm">New template</Button></DialogTrigger>
              <DialogContent title="New template"><TemplateEditor /></DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable>
            <thead><tr><Th>Event</Th><Th>Channel</Th><Th>Lang</Th><Th>Scope</Th><Th>Preview</Th><Th></Th></tr></thead>
            <tbody>
              {(templates ?? []).map((t) => (
                <tr key={t.id}>
                  <Td>{t.event.replace(/_/g, " ")} {t.is_active ? null : <Badge>inactive</Badge>}</Td>
                  <Td>{t.channel}</Td>
                  <Td>{t.locale}</Td>
                  <Td className="text-xs">{t.restaurant_id ? "Restaurant" : "Group default"}</Td>
                  <Td className="max-w-md truncate text-xs text-muted">{t.subject ?? t.body.slice(0, 90)}</Td>
                  <Td>
                    {canEdit ? (
                      <Dialog>
                        <DialogTrigger asChild><button className="text-xs font-medium text-brand-700 hover:underline">Edit</button></DialogTrigger>
                        <DialogContent title="Edit template"><TemplateEditor template={t} /></DialogContent>
                      </Dialog>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
