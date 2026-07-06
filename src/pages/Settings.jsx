import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { User, Phone, Mail, Shield, ArrowLeft, Loader2, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const { profile, user, refetchProfile } = useAuth();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Agent payment details
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankPaybill, setBankPaybill] = useState("");
  
  const [saving, setSaving] = useState(false);

  const isAgent = profile?.role === "agent";

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setMpesaNumber(profile.mpesa_number || "");
      setBankName(profile.bank_name || "");
      setBankAccount(profile.bank_account || "");
      setBankPaybill(profile.bank_paybill || "");
    }
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updates = {
        full_name: fullName.trim(),
        phone: phone.trim(),
      };

      if (isAgent) {
        updates.mpesa_number = mpesaNumber.trim();
        updates.bank_name = bankName.trim();
        updates.bank_account = bankAccount.trim();
        updates.bank_paybill = bankPaybill.trim();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;
      
      await refetchProfile();
      toast({ title: "Profile updated successfully!" });
    } catch (e) {
      toast({
        title: "Error saving profile",
        description: e.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Profile Settings" subtitle="Keep your profile info up to date" />
      
      <div className="max-w-lg mx-auto px-4 py-5">
        <form onSubmit={handleSave} className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <User className="w-3.5 h-3.5" /> Full Name
            </Label>
            <Input
              id="full-name"
              placeholder="e.g. Mary Wanjiku"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Phone className="w-3.5 h-3.5" /> Phone Number (M-Pesa)
            </Label>
            <Input
              id="phone"
              placeholder="e.g. 0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          {isAgent && (
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" /> Payout / Receiving Details
              </h4>
              <p className="text-[11px] text-muted-foreground">
                These payment details will be visible to landlords when making payouts to you for commissions, deposits, or repairs.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="mpesa-number" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Smartphone className="w-3.5 h-3.5" /> Receiving M-Pesa Number
                </Label>
                <Input
                  id="mpesa-number"
                  placeholder="e.g. 0712345678"
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bank-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Bank Name
                  </Label>
                  <Input
                    id="bank-name"
                    placeholder="e.g. Equity Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank-paybill" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Bank Paybill (If any)
                  </Label>
                  <Input
                    id="bank-paybill"
                    placeholder="e.g. 247247"
                    value={bankPaybill}
                    onChange={(e) => setBankPaybill(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bank-account" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bank Account Number
                </Label>
                <Input
                  id="bank-account"
                  placeholder="e.g. 1234567890123"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Mail className="w-3.5 h-3.5" /> Email Address
            </Label>
            <Input
              value={profile?.email || user?.email || ""}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Shield className="w-3.5 h-3.5" /> Access Role
            </Label>
            <Input
              value={profile?.role || "tenant"}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed capitalize"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Changes
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
