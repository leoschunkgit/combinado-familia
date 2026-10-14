import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { uiTypography } from "@/lib/ui-typography";

function AdministracaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração"
        subtitle="Área administrativa do Combinado Família."
        icon={<ShieldCheck className="h-6 w-6" />}
      />

      <section className="max-w-2xl rounded-xl border bg-card p-5 shadow-sm">
        <h2 className={uiTypography.secondaryTitle}>Acesso administrativo ativo</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sua conta está cadastrada como administradora. Nesta primeira etapa, a área administrativa não acessa nem altera dados de outras famílias.
        </p>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/administracao")({
  beforeLoad: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw redirect({ to: "/" });

    const { data: admin, error } = await supabase
      .from("t_admin")
      .select("id")
      .eq("ativo", true)
      .maybeSingle();

    if (error || !admin) throw redirect({ to: "/inicio" });
  },
  head: () => ({
    meta: [
      { title: "Administração — Combinado Família" },
      { name: "description", content: "Área administrativa do Combinado Família." },
    ],
  }),
  component: AdministracaoPage,
});
