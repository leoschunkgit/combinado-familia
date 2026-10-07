import { jsPDF } from "jspdf";
import { savePdfDocument } from "@/lib/pdf-export";

export type RelatorioPdfRegistro = {
  data: string;
  resultado: "Fez" | "Não fez";
  detalhe?: string;
  penalidadeAtingida?: boolean;
};

export type RelatorioPdfTarefa = {
  nome: string;
  registros: RelatorioPdfRegistro[];
};

export type RelatorioPdfFilho = {
  nome: string;
  resumo: string;
  tarefas: RelatorioPdfTarefa[];
};

export type RelatorioPdfVigencia = {
  periodo: string;
  status: string;
  penalidade: string;
  limite: string;
  descontoMesada: string;
  filhos: RelatorioPdfFilho[];
};

export type RelatorioPdfDados = {
  geradoEm: string;
  filtros: {
    vigencia: string;
    filho: string;
    tarefa: string;
  };
  vigencias: RelatorioPdfVigencia[];
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 290;

export async function gerarRelatorioPdf(dados: RelatorioPdfDados) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  const novaPagina = () => {
    doc.addPage();
    y = 14;
  };

  const garantirEspaco = (altura: number) => {
    if (y + altura > 278) novaPagina();
  };

  const escrever = (
    texto: string,
    x: number,
    largura: number,
    tamanho = 9,
    opcoes?: { negrito?: boolean; cor?: [number, number, number] },
  ) => {
    doc.setFont("helvetica", opcoes?.negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(...(opcoes?.cor ?? [35, 45, 40]));
    const linhas = doc.splitTextToSize(texto, largura) as string[];
    const alturaLinha = Math.max(3.8, tamanho * 0.42);
    garantirEspaco(linhas.length * alturaLinha + 1.5);
    doc.text(linhas, x, y);
    y += linhas.length * alturaLinha + 1.5;
  };

  const caixa = (
    titulo: string,
    valor: string,
    x: number,
    largura: number,
    destaque: "neutro" | "verde" | "ambar" = "neutro",
  ) => {
    const fundos = {
      neutro: [247, 248, 247],
      verde: [241, 248, 244],
      ambar: [252, 248, 238],
    } as const;
    const bordas = {
      neutro: [220, 224, 221],
      verde: [181, 215, 194],
      ambar: [226, 205, 157],
    } as const;

    const linhas = doc.splitTextToSize(valor, largura - 8) as string[];
    const altura = Math.max(16, 9 + linhas.length * 3.8);
    garantirEspaco(altura + 2);
    doc.setFillColor(...fundos[destaque]);
    doc.setDrawColor(...bordas[destaque]);
    doc.roundedRect(x, y, largura, altura, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 70, 65);
    doc.text(titulo, x + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(35, 45, 40);
    doc.text(linhas, x + 4, y + 10);
    y += altura + 2;
  };

  doc.setFillColor(242, 247, 244);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 25, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(35, 70, 55);
  doc.text("Relatório / Histórico", MARGIN + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 95);
  doc.text(`Gerado em ${dados.geradoEm}`, MARGIN + 6, y + 16);
  y += 31;

  escrever("Filtros aplicados", MARGIN, CONTENT_WIDTH, 10, { negrito: true });
  const filtroTexto = `Vigência: ${dados.filtros.vigencia}   •   Filho: ${dados.filtros.filho}   •   Tarefa: ${dados.filtros.tarefa}`;
  caixa("Consulta", filtroTexto, MARGIN, CONTENT_WIDTH);
  y += 3;

  for (const vigencia of dados.vigencias) {
    garantirEspaco(30);
    doc.setFillColor(236, 244, 239);
    doc.setDrawColor(188, 205, 195);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(35, 70, 55);
    doc.text(vigencia.periodo, MARGIN + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(75, 90, 82);
    doc.text(`Status: ${vigencia.status}`, MARGIN + 5, y + 13);
    y += 22;

    const boxGap = 4;
    const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
    const yInicial = y;
    caixa("Penalidade / limite", `${vigencia.penalidade} · ${vigencia.limite}`, MARGIN, boxWidth, "ambar");
    const yEsquerda = y;
    y = yInicial;
    caixa("Desconto da mesada", vigencia.descontoMesada, MARGIN + boxWidth + boxGap, boxWidth, "verde");
    const yDireita = y;
    y = Math.max(yEsquerda, yDireita) + 2;

    for (const filho of vigencia.filhos) {
      garantirEspaco(20);
      doc.setFillColor(248, 249, 248);
      doc.setDrawColor(224, 227, 225);
      doc.roundedRect(MARGIN + 2, y, CONTENT_WIDTH - 4, 11, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(35, 45, 40);
      doc.text(filho.nome, MARGIN + 6, y + 7);
      y += 15;
      escrever(filho.resumo, MARGIN + 6, CONTENT_WIDTH - 12, 8.5);

      for (const tarefa of filho.tarefas) {
        garantirEspaco(16);
        escrever(tarefa.nome, MARGIN + 8, CONTENT_WIDTH - 16, 9, { negrito: true });

        if (!tarefa.registros.length) {
          escrever("Nenhum resultado registrado.", MARGIN + 12, CONTENT_WIDTH - 24, 8, { cor: [105, 110, 108] });
          y += 1;
          continue;
        }

        const xData = MARGIN + 10;
        const xResultado = MARGIN + 43;
        const xDetalhe = MARGIN + 78;
        garantirEspaco(9);
        doc.setFillColor(246, 247, 246);
        doc.rect(MARGIN + 8, y - 1, CONTENT_WIDTH - 16, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(95, 100, 98);
        doc.text("Data", xData, y + 3.5);
        doc.text("Resultado", xResultado, y + 3.5);
        doc.text("Detalhe", xDetalhe, y + 3.5);
        y += 8;

        for (const registro of tarefa.registros) {
          const detalhe = [registro.detalhe, registro.penalidadeAtingida ? "Penalidade atingida" : ""]
            .filter(Boolean)
            .join(" · ") || "—";
          const linhasDetalhe = doc.splitTextToSize(detalhe, CONTENT_WIDTH - 84) as string[];
          const altura = Math.max(7, linhasDetalhe.length * 3.6 + 3);
          garantirEspaco(altura);

          doc.setDrawColor(232, 234, 233);
          doc.line(MARGIN + 8, y + altura - 1, MARGIN + CONTENT_WIDTH - 8, y + altura - 1);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(55, 60, 58);
          doc.text(registro.data, xData, y + 4);
          doc.setFont("helvetica", "bold");
          if (registro.resultado === "Fez") doc.setTextColor(55, 125, 80);
          else doc.setTextColor(175, 65, 65);
          doc.text(registro.resultado, xResultado, y + 4);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 60, 58);
          doc.text(linhasDetalhe, xDetalhe, y + 4);
          y += altura;
        }
        y += 2;
      }
      y += 3;
    }
    y += 4;
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 228, 226);
    doc.line(MARGIN, 284, PAGE_WIDTH - MARGIN, 284);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 115, 112);
    doc.text("Combinado Família", MARGIN, FOOTER_Y);
    doc.text(`Página ${i} de ${totalPaginas}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
  }

  await savePdfDocument(doc, `relatorio-combinado-${new Date().toISOString().slice(0, 10)}.pdf`);
}
