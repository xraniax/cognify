import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * MaterialExportService
 * High-fidelity, isolated rendering system for multi-page PDF generation.
 */

const sanitizeClone = (clone) => {
    const selectorsToRemove = [
        'button',
        '.btn-download-pdf',
        '.no-export',
        '.lucide',
        '.lucide-icon',
        'svg',
        '.back-link',
        '.stats-bar'
    ];
    
    selectorsToRemove.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    return clone;
};

const finalizePDF = (canvas, fileName) => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeightOnPDF = (canvas.height * pageWidth) / canvas.width;
    
    let heightLeft = imgHeightOnPDF;
    let position = 0;

    // First Page
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightOnPDF, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Subsequent Pages
    while (heightLeft > 0) {
        position = heightLeft - imgHeightOnPDF;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeightOnPDF, undefined, 'FAST');
        heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    return fileName;
};

const renderWithIframeIsolation = async (element, fileName, surgicalStyles, scale, bgColor) => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { 
        position: 'absolute', 
        top: '0', 
        left: '0', 
        width: '1000px', 
        height: '0', 
        visibility: 'hidden' 
    });
    document.body.appendChild(iframe);

    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(`
        <html>
        <head><style>${surgicalStyles}</style></head>
        <body></body>
        </html>
    `);
    idoc.close();

    const clone = sanitizeClone(element.cloneNode(true));
    idoc.body.appendChild(clone);

    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(idoc.body, {
        scale: scale,
        width: 1000,
        backgroundColor: bgColor,
        useCORS: true,
        logging: false
    });

    document.body.removeChild(iframe);
    return finalizePDF(canvas, fileName);
};

const renderDirect = async (element, fileName, scale, bgColor) => {
    const canvas = await html2canvas(element, {
        scale: scale,
        backgroundColor: bgColor,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => {
            return el.tagName === 'BUTTON' || el.classList.contains('no-export');
        }
    });

    return finalizePDF(canvas, fileName);
};

export const ExportService = {
    /**
     * exportToPDF - Main entry point for hardened PDF generation.
     */
    exportToPDF: async (element, fileName = 'cognify-report.pdf', options = {}) => {
        const {
            surgicalStyles = '',
            scale = 2,
            backgroundColor = '#ffffff'
        } = options;

        if (!element) throw new Error('[ExportService] No element provided for export.');

        try {
            return await renderWithIframeIsolation(element, fileName, surgicalStyles, scale, backgroundColor);
        } catch (error) {
            console.warn('[ExportService] Isolated render failed. Attempting direct fallback...', error);
            return await renderDirect(element, fileName, scale, backgroundColor);
        }
    }
};

export default ExportService;
