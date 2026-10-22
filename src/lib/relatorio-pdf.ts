import { jsPDF } from "jspdf";
import { savePdfDocument } from "@/lib/pdf-export";

export type RelatorioPdfRegistro = {
  data: string;
  resultado: "Fez" | "Não fez";
  detalhe?: string | undefined;
};

export type RelatorioPdfTarefa = {
  nome: string;
  registros: RelatorioPdfRegistro[];
};

export type RelatorioPdfFilho = {
  nome: string;
  cor?: string | null;
  avatar?: "menino" | "menina" | null;
  resumo?: string | undefined;
  mesada?: {
    valor: string;
    descontos: string;
    saldo: string;
  } | undefined;
  tarefas: RelatorioPdfTarefa[];
};

export type RelatorioPdfVigencia = {
  periodo: string;
  status: string;
  resumoConsequencias: string;
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

function corAvatarPdf(valor?: string | null): [number, number, number] {
  const cor = valor?.trim() ?? "";
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(cor);
  if (curto) return curto.slice(1).map((p) => parseInt(p + p, 16)) as [number, number, number];
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
  if (hex) return hex.slice(1).map((p) => parseInt(p, 16)) as [number, number, number];
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(cor);
  if (rgb) return rgb.slice(1).map(Number).map((n) => Math.max(0, Math.min(255, n))) as [number, number, number];
  return [12, 92, 60];
}

function iniciaisPdf(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0] + partes[partes.length - 1]![0]).toUpperCase();
}

function desenharAvatarPdf(doc: jsPDF, filho: RelatorioPdfFilho, x: number, y: number) {
  const [r, g, b] = corAvatarPdf(filho.cor);
  doc.setFillColor(r, g, b);
  doc.circle(x, y, 3.2, "F");
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);

  if (filho.avatar === "menino" || filho.avatar === "menina") {
    if (filho.avatar === "menina") {
      doc.circle(x - 1.4, y - 1.2, 0.65, "F");
      doc.circle(x + 1.4, y - 1.2, 0.65, "F");
    }
    doc.circle(x, y - 0.7, 1.25, "F");
    doc.ellipse(x, y + 1.45, 1.8, 1.15, "F");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(iniciaisPdf(filho.nome), x, y + 0.7, { align: "center" });
  }
}

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
    { const [r, g, b] = fundos[destaque]; doc.setFillColor(r, g, b); }
    { const [r, g, b] = bordas[destaque]; doc.setDrawColor(r, g, b); }
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
  doc.text("Relatório da vigência", MARGIN + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 95);
  doc.text(`Gerado em ${dados.geradoEm}`, MARGIN + 6, y + 16);
  y += 31;

  escrever("Filtros aplicados", MARGIN, CONTENT_WIDTH, 10, { negrito: true });
  const filtroTexto = `Vigência: ${dados.filtros.vigencia}   •   Filho: ${dados.filtros.filho}   •   Tarefa: ${dados.filtros.tarefa}`;
  const linhasFiltro = doc.splitTextToSize(filtroTexto, CONTENT_WIDTH - 8) as string[];
  const alturaFiltro = Math.max(11, linhasFiltro.length * 4 + 5);
  garantirEspaco(alturaFiltro + 2);
  doc.setFillColor(247, 248, 247);
  doc.setDrawColor(220, 224, 221);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, alturaFiltro, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 45, 40);
  doc.text(linhasFiltro, MARGIN + 4, y + 6);
  y += alturaFiltro + 5;

  for (const [indiceVigencia, vigencia] of dados.vigencias.entries()) {
    garantirEspaco(30);
    doc.setFillColor(236, 244, 239);
    doc.setDrawColor(188, 205, 195);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(35, 70, 55);
    doc.text(`Vigência ${indiceVigencia + 1} — ${vigencia.status}`, MARGIN + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(75, 90, 82);
    doc.text(vigencia.periodo, MARGIN + 5, y + 13);
    y += 22;

    caixa(
      "Consequências do “Não fez”",
      vigencia.resumoConsequencias,
      MARGIN,
      CONTENT_WIDTH,
      "neutro",
    );
    y += 2;

    for (const filho of vigencia.filhos) {
      garantirEspaco(20);
      doc.setFillColor(248, 249, 248);
      doc.setDrawColor(224, 227, 225);
      doc.roundedRect(MARGIN + 2, y, CONTENT_WIDTH - 4, 11, 2, 2, "FD");
      desenharAvatarPdf(doc, filho, MARGIN + 7, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(35, 45, 40);
      doc.text(filho.nome, MARGIN + 12, y + 7);
      y += 15;

      if (filho.mesada) {
        const resumoGap = 3;
        const resumoWidth = (CONTENT_WIDTH - 12 - resumoGap * 2) / 3;
        const resumoX = MARGIN + 6;
        const yResumo = y;

        caixa("Mesada", filho.mesada.valor, resumoX, resumoWidth, "neutro");
        const yMesada = y;
        y = yResumo;
        caixa("Descontos", `-${filho.mesada.descontos}`, resumoX + resumoWidth + resumoGap, resumoWidth, "ambar");
        const yDescontos = y;
        y = yResumo;
        caixa("Saldo atual", filho.mesada.saldo, resumoX + (resumoWidth + resumoGap) * 2, resumoWidth, "verde");
        const ySaldo = y;
        y = Math.max(yMesada, yDescontos, ySaldo) + 1;
      }

      for (const tarefa of filho.tarefas) {
        const xTabela = MARGIN + 6;
        const larguraTabela = CONTENT_WIDTH - 12;
        const xData = xTabela + 4;
        const xResultado = xTabela + 38;
        const xDetalhe = xTabela + 74;
        const larguraDetalhe = larguraTabela - 78;

        const desenharCabecalhoTarefa = () => {
          const linhasNome = doc.splitTextToSize(tarefa.nome, larguraTabela - 38) as string[];
          const alturaCabecalho = Math.max(15, 10 + linhasNome.length * 4);
          garantirEspaco(alturaCabecalho + 9);

          doc.setFillColor(243, 248, 245);
          doc.setDrawColor(202, 219, 209);
          doc.roundedRect(xTabela, y, larguraTabela, alturaCabecalho, 2.5, 2.5, "FD");

          doc.setFillColor(12, 92, 60);
          doc.roundedRect(xTabela, y, 1.8, alturaCabecalho, 0.9, 0.9, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.8);
          doc.setTextColor(72, 105, 88);
          doc.text("TAREFA", xTabela + 5, y + 4.8);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.2);
          doc.setTextColor(35, 45, 40);
          doc.text(linhasNome, xTabela + 5, y + 9.5);

          const totalRegistros = tarefa.registros.length;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(92, 102, 97);
          doc.text(
            `${totalRegistros} ${totalRegistros === 1 ? "registro" : "registros"}`,
            xTabela + larguraTabela - 4,
            y + 5.2,
            { align: "right" },
          );

          y += alturaCabecalho + 2;
        };

        const desenharCabecalhoRegistros = () => {
          garantirEspaco(8);
          doc.setFillColor(246, 247, 246);
          doc.setDrawColor(226, 230, 227);
          doc.roundedRect(xTabela, y, larguraTabela, 7, 1.2, 1.2, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);
          doc.setTextColor(92, 100, 96);
          doc.text("Data", xData, y + 4.5);
          doc.text("Resultado", xResultado, y + 4.5);
          doc.text("Detalhe", xDetalhe, y + 4.5);

          y += 8;
        };

        desenharCabecalhoTarefa();

        if (!tarefa.registros.length) {
          garantirEspaco(10);
          doc.setFillColor(250, 250, 250);
          doc.setDrawColor(232, 234, 233);
          doc.roundedRect(xTabela, y, larguraTabela, 9, 1.5, 1.5, "FD");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(105, 110, 108);
          doc.text("Nenhum resultado registrado.", xTabela + 4, y + 5.5);
          y += 12;
          continue;
        }

        desenharCabecalhoRegistros();

        for (const [indiceRegistro, registro] of tarefa.registros.entries()) {
          const detalhe = registro.detalhe || "—";
          const linhasDetalhe = doc.splitTextToSize(detalhe, larguraDetalhe) as string[];
          const altura = Math.max(8, linhasDetalhe.length * 3.6 + 3.5);

          if (y + altura > 278) {
            novaPagina();
            desenharCabecalhoTarefa();
            desenharCabecalhoRegistros();
          }

          if (indiceRegistro % 2 === 0) {
            doc.setFillColor(252, 252, 252);
            doc.rect(xTabela, y, larguraTabela, altura, "F");
          }

          doc.setDrawColor(232, 234, 233);
          doc.line(xTabela, y + altura, xTabela + larguraTabela, y + altura);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(55, 60, 58);
          doc.text(registro.data, xData, y + 4.8);

          const corResultado: [number, number, number] =
            registro.resultado === "Fez" ? [55, 125, 80] : [175, 65, 65];
          doc.setFillColor(
            registro.resultado === "Fez" ? 239 : 252,
            registro.resultado === "Fez" ? 248 : 241,
            registro.resultado === "Fez" ? 242 : 241,
          );
          doc.roundedRect(xResultado - 1.5, y + 1.4, 24, 5.2, 2.6, 2.6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...corResultado);
          doc.text(registro.resultado, xResultado + 10.5, y + 4.9, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(55, 60, 58);
          doc.text(linhasDetalhe, xDetalhe, y + 4.8);

          y += altura;
        }

        y += 4;
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
