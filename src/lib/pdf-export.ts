import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { jsPDF } from "jspdf";

export async function savePdfDocument(doc: jsPDF, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1];
  if (!base64) throw new Error("Não foi possível gerar o PDF.");

  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  const { value } = await Share.canShare();
  if (!value) throw new Error("Compartilhamento de arquivo indisponível.");

  await Share.share({
    title: "Relatório Combinado Família",
    text: "Relatório gerado pelo Combinado Família.",
    files: [written.uri],
    dialogTitle: "Salvar ou compartilhar PDF",
  });
}
