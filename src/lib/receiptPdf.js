import { jsPDF } from "jspdf";

function formatKES(n) {
  return "KES " + (Number(n) || 0).toLocaleString();
}

export function generatePaymentReceiptPdf(payment) {
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
  doc.text("Property Management", margin, 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PAYMENT RECEIPT", W - margin, 40, { align: "right" });

  let y = 100;
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Receipt No: ${(payment.id || "—").slice(0, 12)}`, margin, y);
  doc.text(`Issued: ${new Date().toLocaleDateString()}`, W - margin, y, { align: "right" });
  y += 14;

  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, W - margin, y);
  y += 22;

  const rows = [
    ["Received From", payment.tenant_name || "—"],
    ["Unit", payment.unit_number || "—"],
    ["Property", payment.property_name || "—"],
    ["Payment For", payment.month_for || "—"],
    ["Date Paid", payment.payment_date || "—"],
    ["Method", payment.payment_method || "—"],
    ["Reference", payment.reference || "—"],
  ];

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

  y += 6;
  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, W - margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(130, 130, 130);
  doc.text("Amount Received", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(25, 95, 60);
  doc.text(formatKES(payment.amount), W - margin, y, { align: "right" });

  y += 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text("This receipt confirms receipt of the above payment.", margin, y);
  y += 14;
  doc.text("Thank you for your payment.", margin, y);

  doc.save(`receipt-${(payment.id || "payment").slice(0, 8)}.pdf`);
  return doc;
}