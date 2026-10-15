import {
  BedDouble,
  BookOpen,
  Clock3,
  Droplets,
  Dumbbell,
  Heart,
  House,
  ListTodo,
  Package,
  PawPrint,
  Shirt,
  ShowerHead,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function normalizarNomeTarefa(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const regras: Array<{ termos: string[]; icone: LucideIcon }> = [
  { termos: ["cama", "dormir", "dormitorio"], icone: BedDouble },
  { termos: ["licao", "dever", "estudar", "estudo", "escola", "leitura", "ler", "livro"], icone: BookOpen },
  { termos: ["cachorro", "cao", "gato", "pet", "animal", "racao", "passear com"], icone: PawPrint },
  { termos: ["louca", "prato", "talher", "cozinha", "mesa", "refeicao"], icone: UtensilsCrossed },
  { termos: ["lixo", "reciclar", "reciclagem"], icone: Trash2 },
  { termos: ["roupa", "uniforme", "vestir"], icone: Shirt },
  { termos: ["exercicio", "treino", "academia", "esporte", "atividade fisica"], icone: Dumbbell },
  { termos: ["banho", "chuveiro", "higiene", "escovar", "dente", "dentes"], icone: ShowerHead },
  { termos: ["regar", "planta", "jardim", "agua"], icone: Droplets },
  { termos: ["limpar", "limpeza", "varrer", "organizar", "arrumar", "faxina"], icone: Sparkles },
  { termos: ["guardar", "brinquedo", "mochila", "material"], icone: Package },
  { termos: ["ajudar", "cuidar", "familia"], icone: Heart },
  { termos: ["casa", "quarto", "sala"], icone: House },
  { termos: ["acordar", "horario", "hora", "pontual"], icone: Clock3 },
];

export function iconeDaTarefa(nome: string): LucideIcon {
  const normalizado = normalizarNomeTarefa(nome);

  for (const regra of regras) {
    if (regra.termos.some((termo) => normalizado.includes(termo))) {
      return regra.icone;
    }
  }

  return ListTodo;
}

export function TarefaIcone({
  nome,
  className,
}: {
  nome: string;
  className?: string;
}) {
  const Icone = iconeDaTarefa(nome);

  return (
    <Icone
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)}
    />
  );
}
