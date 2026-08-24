import { jsPDF } from 'jspdf';
import { Student } from '../data/mockData';

const loadLocalImage = async (url: string): Promise<string> => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error('Failed to load image', url, err);
        return '';
    }
};

const loadFontAsBase64 = async (url: string): Promise<string> => {
    try {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    } catch (err) {
        console.error('Failed to load font', url, err);
        return '';
    }
};

export const generateBonafidePDF = async (student: Student, refNoStr: string = "AUTO"): Promise<Blob> => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Load Google Sans font for certificate body
    let bodyFont = 'helvetica';
    try {
        const fontBase64 = await loadFontAsBase64('/fonts/GoogleSans.ttf');
        const boldFontBase64 = await loadFontAsBase64('/fonts/GoogleSans-Bold.ttf');
        if (fontBase64) {
            doc.addFileToVFS('GoogleSans.ttf', fontBase64);
            doc.addFont('GoogleSans.ttf', 'GoogleSans', 'normal');
        }
        if (boldFontBase64) {
            doc.addFileToVFS('GoogleSans-Bold.ttf', boldFontBase64);
            doc.addFont('GoogleSans-Bold.ttf', 'GoogleSans', 'bold');
        } else if (fontBase64) {
            doc.addFont('GoogleSans.ttf', 'GoogleSans', 'bold');
        }
        if (fontBase64 || boldFontBase64) {
            bodyFont = 'GoogleSans';
        }
    } catch (e) {
        console.warn('Could not register Google Sans font, falling back to default', e);
    }

    const pageWidth = doc.internal.pageSize.getWidth();

    // Load logo
    const logoData = await loadLocalImage('/logo.png');

    // ── WATERMARK: logo centred on page, very light ──────────────────────────
    const pageHeight = doc.internal.pageSize.getHeight();
    if (logoData) {
        // Save graphics state is not in jsPDF core; we simulate low opacity by
        // drawing the image with a white overlay trick — instead we use
        // jsPDF's GState if available, otherwise just place it small & subtle.
        // jsPDF supports setGState in recent versions:
        try {
            const gState = (doc as any).setGState(new (doc as any).GState({ opacity: 0.03 }));
            void gState;
        } catch (_) { /* ignore if not supported */ }
        const wmSize = 147;
        doc.addImage(logoData, 'PNG', (pageWidth - wmSize) / 2, (pageHeight - wmSize) / 2, wmSize, wmSize);
        // Reset opacity
        try {
            (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
        } catch (_) { /* ignore */ }
    }

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Small logo top-left (clear of the blue college name)
    if (logoData) {
        doc.addImage(logoData, 'PNG', 4, 12, 26, 26);
    }

    // Reg No — top right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Reg. No. F-17655/Beed', pageWidth - 12, 14, { align: 'right' });

    // Row 1 — Trust name  (y = 16)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Joshaba Pratishthan', pageWidth / 2, 16, { align: 'center' });

    // Row 2 — College name in blue  (y = 22)
    doc.setFontSize(13);
    doc.setTextColor(0, 102, 204);
    doc.text('Vikramshila College Of Fashion Design, Chhatrapati Sambhajinagar', pageWidth / 2, 22, { align: 'center' });

    // Row 3 — Affiliation  (y = 27)
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text("(Affiliated to S.N.D.T. Women's University, Mumbai.)", pageWidth / 2, 27, { align: 'center' });

    // Row 4 — Address  (y = 31)
    doc.setFontSize(8);
    doc.text('Address: Janak Tower, Beside Surya Lawns, Deolai Chowk, Beed By Pass Road, Chh. Sambhajinagar', pageWidth / 2, 31, { align: 'center' });

    // Row 5 — Email & Code  (y = 35)
    doc.text('Email ID: 537vikramshilafashion@gmail.com / 9310666638     College Code:- 537', pageWidth / 2, 35, { align: 'center' });

    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(10, 39, pageWidth - 10, 39);

    // Reference Section
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(10);
    doc.text('Ref. No.: ', 15, 48);

    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    doc.setFont(bodyFont, 'bold');
    doc.text(`Date: ${dateStr}`, pageWidth - 15, 48, { align: 'right' });

    // Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('TO WHOMSOEVER IT MAY CONCERN', pageWidth / 2, 62, { align: 'center' });

    // Student Photograph
    let photoY = 72;
    let photoHeight = 45;
    let photoWidth = 35;
    let photoX = (pageWidth - photoWidth) / 2;

    if (student.photoUrl) {
        try {
            const studentPhoto = await loadLocalImage(student.photoUrl);
            if (studentPhoto) {
                doc.addImage(studentPhoto, 'JPEG', photoX, photoY, photoWidth, photoHeight);
            } else {
                doc.rect(photoX, photoY, photoWidth, photoHeight);
            }
        } catch (e) {
            doc.rect(photoX, photoY, photoWidth, photoHeight);
        }
    } else {
        // Blank placeholder box
        doc.setLineWidth(0.3);
        doc.rect(photoX, photoY, photoWidth, photoHeight);
    }

    // Certificate Body (only body uses Alkatra font)
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(12);

    const dobStr = student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : "_____";
    const name = student.name || "____________________";
    const fatherName = student.fatherName || "____________________";
    const prnNo = student.prnNo || student.rollNo || "_________";
    const courseStr = student.course || "_________";
    const semesterStr = student.semester ? student.semester.toString() : "___";

    const writeRichText = (
        doc: jsPDF,
        parts: { text: string; bold?: boolean }[],
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number
    ) => {
        let currentX = x;
        let currentY = y;
        parts.forEach((part) => {
            doc.setFont(bodyFont, part.bold ? "bold" : "normal");
            const words = part.text.split(/(\s+)/);
            words.forEach((word) => {
                if (!word) return;
                const wordWidth = doc.getTextWidth(word);
                if (word.trim() === "") {
                    if (currentX > x) {
                        currentX += wordWidth;
                    }
                } else {
                    if (currentX + wordWidth > x + maxWidth) {
                        currentX = x;
                        currentY += lineHeight;
                    }
                    doc.text(word, currentX, currentY);
                    currentX += wordWidth;
                }
            });
        });
    };

    const bodyParts = [
        { text: "This is to certify that Mr./Ms. " },
        { text: name, bold: true },
        { text: ", son/daughter of Mr. " },
        { text: fatherName, bold: true },
        { text: ", bearing PRN No. " },
        { text: prnNo, bold: true },
        { text: " and Date of Birth " },
        { text: dobStr, bold: true },
        { text: ", is a bonafide student of " },
        { text: "Vikramshila College of Fashion Design, Chhatrapati Sambhajinagar", bold: true },
        { text: ", enrolled in the " },
        { text: courseStr, bold: true },
        { text: " program. Currently, he/she is studying in Semester " },
        { text: semesterStr, bold: true },
        { text: "." }
    ];

    writeRichText(doc, bodyParts, 15, photoY + photoHeight + 15, pageWidth - 30, 7);

    // Official College Stamp  (pushed well below the body text)
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(11);
    doc.text('Official College Stamp', 15, photoY + photoHeight + 80);

    return doc.output('blob');
};
