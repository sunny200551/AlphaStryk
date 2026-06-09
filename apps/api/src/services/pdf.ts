import PDFDocument from 'pdfkit';

interface PDFInvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  gstin: string | null;
  cgst: number;
  sgst: number;
  igst: number;
  taxRate: number;
  amount: number;
  createdAt: Date;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  items: {
    name: string;
    sku: string;
    style: string;
    quantity: number;
    price: number;
  }[];
  shippingCost: number;
  totalAmount: number; // Subtotal
}

export const generateInvoicePdf = (data: PDFInvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header Brand
      doc
        .fillColor('#4f46e5')
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('ALPHASTRYK', 50, 50);

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('TAX INVOICE', 400, 58, { align: 'right' });

      // Divider Line
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 90)
        .lineTo(545, 90)
        .stroke();

      // Seller vs Invoice Meta Metadata
      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('SOLD BY:', 50, 110)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#1f2937')
        .text('AlphaStryk Sports Wear Pvt Ltd', 50, 122)
        .text('101, Sports Arena Hub, Bandra East', 50, 134)
        .text('Mumbai, Maharashtra - 400051', 50, 146)
        .text('GSTIN: 27AAAAA1111A1Z1', 50, 158);

      const invoiceDateStr = new Date(data.createdAt).toLocaleDateString('en-IN');
      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('INVOICE DETAILS:', 330, 110)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#1f2937')
        .text(`Invoice No: ${data.invoiceNumber}`, 330, 122)
        .text(`Date: ${invoiceDateStr}`, 330, 134)
        .text(`Order ID: #${data.orderNumber}`, 330, 146)
        .text(`Buyer GSTIN: ${data.gstin || 'N/A'}`, 330, 158);

      // Divider
      doc
        .strokeColor('#e5e7eb')
        .moveTo(50, 185)
        .lineTo(545, 185)
        .stroke();

      // Bill To details
      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('BILL TO (BUYER):', 50, 205);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#1f2937')
        .text(data.customerName, 50, 217)
        .text(data.customerEmail, 50, 229)
        .text(`${data.billingAddress.street}`, 50, 241)
        .text(`${data.billingAddress.city}, ${data.billingAddress.state} - ${data.billingAddress.postalCode}`, 50, 253)
        .text(`${data.billingAddress.country}`, 50, 265);

      // Ship To details
      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('SHIP TO:', 330, 205);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#1f2937')
        .text(data.customerName, 330, 217)
        .text(`${data.shippingAddress.street}`, 330, 229)
        .text(`${data.shippingAddress.city}, ${data.shippingAddress.state} - ${data.shippingAddress.postalCode}`, 330, 241)
        .text(`${data.shippingAddress.country}`, 330, 253);

      // Table Header Row
      const tableTop = 295;
      doc
        .rect(50, tableTop, 495, 20)
        .fill('#f3f4f6');

      doc
        .fillColor('#4b5563')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('UNIFORM DETAILS', 55, tableTop + 6)
        .text('SKU', 230, tableTop + 6)
        .text('QTY', 320, tableTop + 6)
        .text('UNIT PRICE', 360, tableTop + 6)
        .text('TOTAL', 480, tableTop + 6, { align: 'right' });

      // Table Body Items
      let y = tableTop + 20;
      doc.font('Helvetica').fontSize(8).fillColor('#1f2937');

      data.items.forEach((item) => {
        // Row border
        doc
          .strokeColor('#f3f4f6')
          .lineWidth(0.5)
          .moveTo(50, y + 18)
          .lineTo(545, y + 18)
          .stroke();

        doc
          .text(`${item.name} (${item.style})`, 55, y + 5)
          .text(item.sku, 230, y + 5)
          .text(item.quantity.toString(), 320, y + 5)
          .text(`$${item.price.toFixed(2)}`, 360, y + 5)
          .text(`$${(item.price * item.quantity).toFixed(2)}`, 480, y + 5, { align: 'right' });

        y += 18;
      });

      // Subtotals and GST math splits
      y += 10;
      const calcX = 330;

      // Subtotal line
      doc
        .fillColor('#4b5563')
        .font('Helvetica')
        .text('Subtotal:', calcX, y)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`$${data.totalAmount.toFixed(2)}`, 480, y, { align: 'right' });

      y += 12;

      // Shipping
      doc
        .font('Helvetica')
        .fillColor('#4b5563')
        .text('Shipping & Handling:', calcX, y)
        .font('Helvetica-Bold')
        .fillColor('#1f2937')
        .text(`$${data.shippingCost.toFixed(2)}`, 480, y, { align: 'right' });

      y += 12;

      // GST tax rate splits
      if (data.igst > 0) {
        doc
          .font('Helvetica')
          .fillColor('#4b5563')
          .text(`Integrated IGST (${data.taxRate}%):`, calcX, y)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text(`$${data.igst.toFixed(2)}`, 480, y, { align: 'right' });
        y += 12;
      } else {
        const halfRate = (data.taxRate / 2).toFixed(1);
        doc
          .font('Helvetica')
          .fillColor('#4b5563')
          .text(`Central CGST (${halfRate}%):`, calcX, y)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text(`$${data.cgst.toFixed(2)}`, 480, y, { align: 'right' });
        y += 12;

        doc
          .font('Helvetica')
          .fillColor('#4b5563')
          .text(`State SGST (${halfRate}%):`, calcX, y)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text(`$${data.sgst.toFixed(2)}`, 480, y, { align: 'right' });
        y += 12;
      }

      // Total border
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(330, y)
        .lineTo(545, y)
        .stroke();

      y += 6;

      // Grand Total
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Total Invoiced Amount:', calcX, y)
        .fillColor('#4f46e5')
        .text(`$${data.amount.toFixed(2)}`, 480, y - 1, { align: 'right' });

      // Footer
      doc
        .fillColor('#9ca3af')
        .font('Helvetica-Oblique')
        .fontSize(7)
        .text('This is a computer-generated tax invoice and does not require signatures.', 50, 720, { align: 'center' })
        .text('Thank you for shopping with ALPHASTRYK athletic uniform platforms.', 50, 730, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
