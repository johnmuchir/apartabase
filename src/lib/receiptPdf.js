import { jsPDF } from "jspdf";

function formatKES(n) {
  return "KES " + (Number(n) || 0).toLocaleString();
}

export function generatePaymentReceiptPdf(payment, invoice, receiptNumber) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(25, 95, 60);
  doc.rect(0, 0, W, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ApartaBase", margin, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Property Management Receipt", margin, 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PAYMENT RECEIPT", W - margin, 40, { align: "right" });

  let y = 100;
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Receipt No: ${receiptNumber || (payment.id || "—").slice(0, 12)}`, margin, y);
  doc.text(`Issued Date: ${new Date(payment.payment_date || new Date()).toLocaleDateString()}`, W - margin, y, { align: "right" });
  y += 14;

  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, W - margin, y);
  y += 22;

  const rows = [
    ["Tenant Name", payment.tenant_name || "—"],
    ["Unit Code", payment.unit_number || "—"],
    ["Property", payment.property_name || "—"],
    ["Payment For", payment.month_for || "—"],
    ["Date Paid", payment.payment_date || "—"],
    ["Payment Method", payment.payment_method || "—"],
    ["Transaction Ref", payment.reference || "—"],
  ];

  if (payment.invoice_number) {
    rows.push(["Invoice Number", payment.invoice_number]);
  }

  doc.setFontSize(10);
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(String(v), W - margin, y, { align: "right" });
    y += 18;
  });

  // Calculate balances if invoice details are available
  if (invoice) {
    y += 6;
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, W - margin, y);
    y += 18;

    const summaryRows = [
      ["Invoice Total Due", formatKES(invoice.total)],
      ["Amount Paid Here", formatKES(payment.amount)],
      ["Remaining Balance", formatKES(Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0)))],
    ];

    summaryRows.forEach(([k, v]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text(k, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(String(v), W - margin, y, { align: "right" });
      y += 18;
    });
  }

  y += 6;
  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, W - margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(130, 130, 130);
  doc.text("Amount Received", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(25, 95, 60);
  doc.text(formatKES(payment.amount), W - margin, y, { align: "right" });

  y += 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text("This receipt confirms verification and acceptance of the above payment.", margin, y);
  y += 14;
  doc.text("Thank you for your payment.", margin, y);

  doc.save(`receipt-${(payment.id || "payment").slice(0, 8)}.pdf`);
  return doc;
}