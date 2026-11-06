import { Plus } from "lucide-react";
import { getStaffT } from "@/lib/i18n/staff-server";
import { requireStaff } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { UserForm } from "./user-form";

export const metadata = { title: "User management" };

export default async function UsersPage() {
  const { t } = await getStaffT();
  const ctx = await requireStaff("user.manage");
  const supabase = await createClient();
  const [{ data: users }, { data: roles }, { data: access }] = await Promise.all([
    supabase.from("users").select("*").order("email"),
    supabase.from("user_roles").select("user_id, role").eq("organization_id", ctx.organizationId),
    supabase.from("restaurant_user_access").select("user_id, restaurant_id"),
  ]);
  const roleOf = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
  const names = new Map(ctx.restaurants.map((r) => [r.id, r.name]));
  const restaurants = ctx.restaurants.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <PageHeader
        title={t("User management")}
        description={t("Roles control what staff can do; branch access controls where.")}
        actions={
          <Dialog>
            <DialogTrigger asChild><Button><Plus /> Add user</Button></DialogTrigger>
            <DialogContent title="Add staff user"><UserForm restaurants={restaurants} /></DialogContent>
          </Dialog>
        }
      />
      <DataTable>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Branches</Th><Th>Status</Th><Th></Th></tr></thead>
        <tbody>
          {(users ?? []).filter((u) => roleOf.has(u.id)).map((u) => {
            const branchIds = (access ?? []).filter((a) => a.user_id === u.id).map((a) => a.restaurant_id);
            const role = roleOf.get(u.id)!;
            return (
              <tr key={u.id}>
                <Td className="font-medium">{u.full_name}</Td>
                <Td className="text-xs">{u.email}</Td>
                <Td>{ROLE_LABELS[role]}</Td>
                <Td className="text-xs">{role === "super_admin" ? "All" : branchIds.map((b) => names.get(b)).join(", ") || <span className="text-amber-700">None</span>}</Td>
                <Td>{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</Td>
                <Td>
                  <Dialog>
                    <DialogTrigger asChild><button className="text-xs font-medium text-brand-700 hover:underline">Edit</button></DialogTrigger>
                    <DialogContent title="Edit user"><UserForm restaurants={restaurants} user={{ ...u, role, restaurant_ids: branchIds }} /></DialogContent>
                  </Dialog>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}
