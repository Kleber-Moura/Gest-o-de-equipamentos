// Exporta um elemento do DOM como PDF, abrindo o diálogo nativo "Salvar como"
// quando o navegador suporta a File System Access API (Chrome/Edge); nos demais
// (Firefox/Safari) cai para o download comum, já que esses navegadores não
// expõem showSaveFilePicker.
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{ description: string; accept: Record<string, string[]> }>
}

interface FileSystemWritable {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritable>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>
  }
}

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0b1220',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const blob = pdf.output('blob')

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
