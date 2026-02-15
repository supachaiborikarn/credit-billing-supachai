import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get('format') || 'excel'; // 'excel' or 'csv'

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                owner: true,
                transactions: {
                    orderBy: { date: 'asc' },
                }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        if (format === 'csv') {
            return generateCSV(invoice);
        } else {
            return generateExcel(invoice);
        }

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to export invoice' }, { status: 500 });
    }
}

function generateCSV(invoice: any) {
    // BOM for Thai characters support in Excel when opening CSV
    const BOM = '\uFEFF';
    let csvContent = BOM;

    // Header Info
    csvContent += `ใบวางบิลเลขที่,${invoice.invoiceNumber}\n`;
    csvContent += `ลูกค้า,${invoice.owner.name}\n`;
    csvContent += `วันที่,${new Date(invoice.createdAt).toLocaleDateString('th-TH')}\n\n`;

    // Table Header
    csvContent += `ลำดับ,วันที่,ทะเบียนรถ,จำนวน (ลิตร),ราคา/ลิตร,รวมเงิน (บาท)\n`;

    // Rows
    invoice.transactions.forEach((t: any, index: number) => {
        const date = new Date(t.date).toLocaleDateString('th-TH');
        csvContent += `${index + 1},${date},${t.licensePlate},${t.liters},${t.pricePerLiter},${t.amount}\n`;
    });

    // Total
    const totalLiters = invoice.transactions.reduce((sum: number, t: any) => sum + Number(t.liters), 0);
    const totalAmount = invoice.totalAmount;

    csvContent += `,,รวมทั้งสิ้น,${totalLiters.toFixed(2)},,${Number(totalAmount).toFixed(2)}\n`;

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.csv"`,
        },
    });
}

async function generateExcel(invoice: any) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice');

    // --- Header Section ---
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'หจก.วัชรเกียรติออยล์ (WATCHARAKIAT OIL LIMITED PARTNERSHIP)';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = '657 ถ.เจริญสุข ต.ในเมือง อ.เมือง จ.กำแพงเพชร โทร. 055-773003';
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:F3');
    worksheet.getCell('A3').value = 'เลขประจำตัวผู้เสียภาษี: 0623539000911';
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A5:F5');
    worksheet.getCell('A5').value = `ใบวางบิล / INVOICE : ${invoice.invoiceNumber}`;
    worksheet.getCell('A5').font = { size: 14, bold: true };
    worksheet.getCell('A5').alignment = { horizontal: 'right' };

    // --- Customer Info ---
    worksheet.getCell('A7').value = 'ลูกค้า / Customer:';
    worksheet.getCell('B7').value = invoice.owner.name;
    worksheet.getCell('B7').font = { bold: true };

    worksheet.getCell('A8').value = 'รหัสลูกค้า:';
    worksheet.getCell('B8').value = invoice.owner.code || '-';

    worksheet.getCell('D7').value = 'วันที่ / Date:';
    worksheet.getCell('E7').value = new Date(invoice.createdAt).toLocaleDateString('th-TH');

    // --- Table Header ---
    const headerRow = worksheet.getRow(10);
    headerRow.values = ['ลำดับ', 'วันที่', 'ทะเบียนรถ', 'จำนวน (ลิตร)', 'ราคา/ลิตร', 'รวมเงิน (บาท)'];
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    // Border for Header
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        worksheet.getCell(`${col}10`).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // --- Data Rows ---
    let currentRow = 11;
    let totalLiters = 0;

    invoice.transactions.forEach((t: any, index: number) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = new Date(t.date).toLocaleDateString('th-TH');
        row.getCell(3).value = t.licensePlate;
        row.getCell(4).value = Number(t.liters);
        row.getCell(5).value = Number(t.pricePerLiter);
        row.getCell(6).value = Number(t.amount);

        totalLiters += Number(t.liters);

        // Formatting
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';

        // Borders
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
            worksheet.getCell(`${col}${currentRow}`).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        currentRow++;
    });

    // --- Totals ---
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = 'รวมทั้งสิ้น';
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right' };

    worksheet.getCell(`D${currentRow}`).value = totalLiters;
    worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00';
    worksheet.getCell(`D${currentRow}`).font = { bold: true };

    worksheet.getCell(`F${currentRow}`).value = Number(invoice.totalAmount);
    worksheet.getCell(`F${currentRow}`).numFmt = '#,##0.00';
    worksheet.getCell(`F${currentRow}`).font = { bold: true };

    // Borders for Total
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        worksheet.getCell(`${col}${currentRow}`).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'double' },
            right: { style: 'thin' }
        };
    });

    // Adjust Column Widths
    worksheet.getColumn(1).width = 10;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 20;

    // Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.xlsx"`,
        },
    });
}
