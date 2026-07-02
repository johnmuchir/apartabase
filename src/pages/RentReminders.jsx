import React, { useState, useEffect } from "react";
import { entities, integrations } from "@/api/supabaseClient";
import { Bell, Send, Mail, Phone } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

function formatKES(n) {
  return "KES " + (n || 0).toLocaleString();
}

function daysUntil(dateStr) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

export default function RentReminders() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [result, setResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, ten] = await Promise.all([
        entities.Invoice.list(),
        entities.Tenant.list(),
      ]);
      setInvoices(inv);
      setTenants(ten);
    } catch (e) {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const due = invoices
    .filter(
      (i) =>
        i.status === "Unpaid" &&
        i.due_date &&
        !i.reminder_sent &&
        daysUntil(i.due_date) <= 3
    )
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const tenantById = (id) => tenants.find((t) => t.id === id);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    let sent = 0;
    const noEmail = [];
    try {
      for (const inv of due) {
        const tenant = tenantById(inv.tenant_id);
        if (tenant?.email) {
          try {
            const body = `Hello ${tenant.full_name},\n\nThis is a friendly reminder that your rent of ${formatKES(
              inv.total
            )} for ${inv.month_for} (Unit ${inv.unit_number}) is due on ${inv.due_date}.\n\nPlease make your payment via M-Pesa before the due date to avoid late fees.\n\nThank you,\nApartaBase`;
            await integrations.Core.SendEmail({
              to: tenant.email,
              from_name: "ApartaBase",
              subject: `Rent Due Reminder — ${inv.month_for}`,
              body,
            });
            await entities.Invoice.update(inv.id, { reminder_sent: true });
            sent++;
          } catch (e) {
            /* skip failed send */
          }
        } else {
          noEmail.push({ invoice: inv, tenant });
        }
      }
      setResult({ sent, noEmail });
      toast({
        title: `${sent} reminder${sent === 1 ? "" : "s"} sent`,
      });
      loadData();
    } catch (e) {
      toast({ title: "Error sending reminders", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Rent Reminders" subtitle="Notify tenants 3 days before rent is due" />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : due.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="No tenants are due within the next 3 days."
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {due.length} tenant{due.length === 1 ? "" : "s"} due within 3 days
              </p>
              <Button size="sm" onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4 mr-1" />
                {sending ? "Sending..." : "Send Reminders"}
              </Button>
            </div>

            <div className="space-y-2">
              {due.map((inv) => {
                const tenant = tenantById(inv.tenant_id);
                const d = daysUntil(inv.due_date);
                const overdue = d < 0;
                return (
                  <div
                    key={inv.id}
                    className="bg-card rounded-xl p-3 border border-border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {tenant?.full_name || inv.tenant_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Unit {inv.unit_number} · {inv.month_for}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatKES(inv.total)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          overdue
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {overdue ? `Overdue ${Math.abs(d)}d` : `Due in ${d}d`}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1">{inv.due_date}</p>
                      {tenant?.email ? (
                        <p className="text-[11px] flex items-center gap-1 justify-end text-muted-foreground">
                          <Mail className="w-3 h-3" /> Email
                        </p>
                      ) : (
                        <p className="text-[11px] flex items-center gap-1 justify-end text-muted-foreground">
                          <Phone className="w-3 h-3" /> No email
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {result && result.noEmail.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  No email — send a text manually
                </p>
                {result.noEmail.map(({ tenant, invoice }) => (
                  <p key={invoice.id} className="text-xs text-amber-700">
                    {tenant?.full_name}: {tenant?.phone}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}