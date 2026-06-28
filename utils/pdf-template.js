/**
 * PDF Template - Kop Surat RT.02
 */
const PDFDocument = require('pdfkit');

const RT_INFO = {
    nama: 'RT.02',
    rw: 'RW.XX',
    kelurahan: 'Kelurahan ...',
    kecamatan: 'Kecamatan ...',
    kota: 'Kota Bandung',
    provinsi: 'Jawa Barat',
    alamat: 'Perumahan ... Blok A-B, Kota Bandung',
};

function createPdfDoc(res, filename) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    return doc;
}

function drawKopSurat(doc) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header text
    doc.fontSize(10).font('Helvetica')
        .text(RT_INFO.kelurahan.toUpperCase() + ' ' + RT_INFO.kecamatan.toUpperCase(), { align: 'center' });

    doc.fontSize(16).font('Helvetica-Bold')
        .text(`RUKUN TETANGGA ${RT_INFO.nama}`, { align: 'center' });

    doc.fontSize(10).font('Helvetica')
        .text(`${RT_INFO.rw} ${RT_INFO.kelurahan} ${RT_INFO.kecamatan}`, { align: 'center' });

    doc.fontSize(9).font('Helvetica')
        .text(RT_INFO.alamat, { align: 'center' });

    // Garis pembatas
    doc.moveDown(0.5);
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.width - doc.page.margins.right, y)
        .lineWidth(2)
        .stroke();

    doc.moveTo(doc.page.margins.left, y + 3)
        .lineTo(doc.page.width - doc.page.margins.right, y + 3)
        .lineWidth(0.5)
        .stroke();

    doc.moveDown(1.5);
}

function drawTitle(doc, title) {
    doc.fontSize(13).font('Helvetica-Bold')
        .text(title, { align: 'center', underline: true });
    doc.moveDown(0.5);

    // Tanggal cetak
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
    doc.fontSize(9).font('Helvetica')
        .text(`Dicetak pada: ${tanggal}`, { align: 'center' });
    doc.moveDown(1);
}

function drawTable(doc, headers, rows, colWidths) {
    const startX = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Auto calculate widths if not provided
    if (!colWidths) {
        const colWidth = pageWidth / headers.length;
        colWidths = headers.map(() => colWidth);
    }

    const rowHeight = 20;
    let y = doc.y;

    // Draw header
    doc.font('Helvetica-Bold').fontSize(8);
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
        doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke('#2d3748', '#2d3748');
        doc.fillColor('#ffffff')
            .text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, align: 'left' });
        x += colWidths[i];
    }

    y += rowHeight;
    doc.font('Helvetica').fontSize(7).fillColor('#000000');

    // Draw rows
    for (let r = 0; r < rows.length; r++) {
        // Check page break
        if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
            doc.addPage();
            y = doc.page.margins.top;

            // Redraw header on new page
            doc.font('Helvetica-Bold').fontSize(8);
            x = startX;
            for (let i = 0; i < headers.length; i++) {
                doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke('#2d3748', '#2d3748');
                doc.fillColor('#ffffff')
                    .text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, align: 'left' });
                x += colWidths[i];
            }
            y += rowHeight;
            doc.font('Helvetica').fontSize(7).fillColor('#000000');
        }

        const bgColor = r % 2 === 0 ? '#ffffff' : '#f7fafc';
        x = startX;

        for (let i = 0; i < headers.length; i++) {
            doc.rect(x, y, colWidths[i], rowHeight).fillAndStroke(bgColor, '#e2e8f0');
            doc.fillColor('#000000')
                .text(String(rows[r][i] || '-'), x + 3, y + 5, { width: colWidths[i] - 6, align: 'left' });
            x += colWidths[i];
        }

        y += rowHeight;
    }

    doc.y = y + 10;
}

function drawFooter(doc) {
    doc.moveDown(2);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Tanda tangan section
    const signX = doc.page.width - doc.page.margins.right - 200;

    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    doc.fontSize(10).font('Helvetica')
        .text(`Bandung, ${tanggal}`, signX, doc.y, { width: 200, align: 'center' })
        .text(`Ketua ${RT_INFO.nama}`, signX, doc.y, { width: 200, align: 'center' });

    doc.moveDown(4);
    doc.text('(..............................)', signX, doc.y, { width: 200, align: 'center' });
}

function addPageNumbers(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica')
            .text(
                `Halaman ${i + 1} dari ${pages.count}`,
                doc.page.margins.left,
                doc.page.height - 30,
                { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
            );
    }
}

module.exports = {
    RT_INFO,
    createPdfDoc,
    drawKopSurat,
    drawTitle,
    drawTable,
    drawFooter,
    addPageNumbers
};
