const express = require('express');
const ExcelJS = require('exceljs');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { createPdfDoc, drawKopSurat, drawTitle, drawTable, drawFooter, addPageNumbers } = require('../utils/pdf-template');

const router = express.Router();

// GET /api/export/excel
router.get('/excel', requireAuth, async (req, res) => {
    try {
        const { blok, status } = req.query;

        let sql = `
            SELECT
                r.blok as "Blok",
                r.nomor_rumah as "No Rumah",
                kk.nomor_kk as "No KK",
                kk.nama_kepala as "Nama Kepala Keluarga",
                w.nik as "NIK",
                w.nama_lengkap as "Nama Lengkap",
                w.jenis_kelamin as "L/P",
                w.tempat_lahir as "Tempat Lahir",
                w.tanggal_lahir as "Tanggal Lahir",
                w.agama as "Agama",
                w.status_perkawinan as "Status Kawin",
                w.pendidikan_terakhir as "Pendidikan",
                w.pekerjaan as "Pekerjaan",
                w.no_hp as "No HP",
                w.hubungan_keluarga as "Hub. Keluarga",
                w.status_tinggal as "Status Tinggal",
                w.status as "Status"
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
        `;

        const params = [];
        const conditions = [];

        if (blok) {
            params.push(blok.toUpperCase());
            conditions.push(`UPPER(r.blok) = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`w.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ` ORDER BY r.blok,
            CASE WHEN r.nomor_rumah ~ '^[0-9]+$' THEN CAST(r.nomor_rumah AS INTEGER) ELSE 999999 END,
            r.nomor_rumah, kk.nama_kepala,
            CASE w.hubungan_keluarga
                WHEN 'Kepala Keluarga' THEN 1
                WHEN 'Istri' THEN 2
                WHEN 'Anak' THEN 3
                ELSE 4
            END`;

        const { rows } = await query(sql, params);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIM-RT.02';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data Warga RT.02');

        // Title row
        const titleFilter = blok ? ` - Blok ${blok}` : '';
        const titleStatus = status ? ` (${status})` : '';
        sheet.mergeCells('A1:Q1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = `DATA WARGA RT.02${titleFilter}${titleStatus}`;
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 30;

        // Date row
        sheet.mergeCells('A2:Q2');
        const dateCell = sheet.getCell('A2');
        dateCell.value = `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        dateCell.font = { italic: true, size: 10 };
        dateCell.alignment = { horizontal: 'center' };

        // Headers
        const headers = [
            'No', 'Blok', 'No Rumah', 'No KK', 'Nama KK', 'NIK', 'Nama Lengkap',
            'L/P', 'Tempat Lahir', 'Tgl Lahir', 'Agama', 'Status Kawin',
            'Pendidikan', 'Pekerjaan', 'No HP', 'Hub. Keluarga', 'Status'
        ];

        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });
        headerRow.height = 25;

        // Data rows
        rows.forEach((row, idx) => {
            const dataRow = sheet.addRow([
                idx + 1,
                row['Blok'],
                row['No Rumah'],
                row['No KK'],
                row['Nama Kepala Keluarga'],
                row['NIK'],
                row['Nama Lengkap'],
                row['L/P'],
                row['Tempat Lahir'],
                row['Tanggal Lahir'],
                row['Agama'],
                row['Status Kawin'],
                row['Pendidikan'],
                row['Pekerjaan'],
                row['No HP'],
                row['Hub. Keluarga'],
                row['Status']
            ]);

            dataRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
                cell.font = { size: 10 };
            });

            // Alternate row color
            if (idx % 2 === 0) {
                dataRow.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
                });
            }
        });

        // Auto-fit column widths
        const colWidths = [5, 8, 8, 18, 20, 18, 22, 5, 14, 12, 10, 14, 12, 16, 15, 16, 10];
        colWidths.forEach((w, i) => {
            sheet.getColumn(i + 1).width = w;
        });

        // Summary row
        sheet.addRow([]);
        const summaryRow = sheet.addRow([`Total: ${rows.length} warga`]);
        summaryRow.getCell(1).font = { bold: true, size: 11 };

        // Set response headers
        const filename = `data_warga_rt02${blok ? '_' + blok : ''}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Export Excel error:', err);
        res.status(500).json({ error: 'Gagal export Excel.' });
    }
});

// GET /api/export/pdf
router.get('/pdf', requireAuth, async (req, res) => {
    try {
        const { blok, status } = req.query;

        let sql = `
            SELECT r.blok, r.nomor_rumah, kk.nomor_kk, kk.nama_kepala,
                   w.nik, w.nama_lengkap, w.jenis_kelamin, w.pekerjaan,
                   w.no_hp, w.hubungan_keluarga, w.status
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
        `;

        const params = [];
        const conditions = [];

        if (blok) {
            params.push(blok.toUpperCase());
            conditions.push(`UPPER(r.blok) = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`w.status = $${params.length}`);
        } else {
            conditions.push("w.status = 'AKTIF'");
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ` ORDER BY r.blok,
            CASE WHEN r.nomor_rumah ~ '^[0-9]+$' THEN CAST(r.nomor_rumah AS INTEGER) ELSE 999999 END,
            r.nomor_rumah, kk.nama_kepala,
            CASE w.hubungan_keluarga
                WHEN 'Kepala Keluarga' THEN 1
                WHEN 'Istri' THEN 2
                WHEN 'Anak' THEN 3
                ELSE 4
            END`;

        const { rows } = await query(sql, params);

        const filterText = blok ? ` Blok ${blok}` : '';
        const filename = `rekap_warga_rt02${blok ? '_' + blok : ''}_${new Date().toISOString().split('T')[0]}.pdf`;
        const doc = createPdfDoc(res, filename);

        drawKopSurat(doc);
        drawTitle(doc, `REKAPITULASI DATA WARGA${filterText}`);

        // Summary
        doc.fontSize(10).font('Helvetica')
            .text(`Total Warga: ${rows.length} jiwa`, { align: 'left' });
        doc.moveDown(0.5);

        const headers = ['No', 'Blok', 'No', 'Nama', 'L/P', 'NIK', 'Pekerjaan', 'No HP', 'Hub.'];
        const colWidths = [25, 35, 25, 95, 25, 80, 70, 70, 70];

        const tableRows = rows.map((r, i) => [
            i + 1,
            r.blok,
            r.nomor_rumah,
            r.nama_lengkap,
            r.jenis_kelamin,
            r.nik || '-',
            r.pekerjaan || '-',
            r.no_hp || '-',
            r.hubungan_keluarga || '-'
        ]);

        drawTable(doc, headers, tableRows, colWidths);
        drawFooter(doc);
        addPageNumbers(doc);

        doc.end();

    } catch (err) {
        console.error('Export PDF error:', err);
        res.status(500).json({ error: 'Gagal export PDF.' });
    }
});

module.exports = router;
