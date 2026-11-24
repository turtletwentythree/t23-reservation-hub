/**
 * Guest privacy notice shown on the booking page. DRAFT: the wording must be reviewed by
 * legal before go-live. Bump PRIVACY_NOTICE_VERSION whenever the text changes; the version
 * is stored with every consent record so older bookings keep pointing at what the guest saw.
 */
export const PRIVACY_NOTICE_VERSION = "1.0-draft";

type Section = { h: string; body: string | string[] };
type Notice = { title: string; meta: string; sections: Section[] };

const en: Notice = {
  title: "Privacy Notice for restaurant guests",
  meta: `Version ${PRIVACY_NOTICE_VERSION}. Draft pending legal review.`,
  sections: [
    { h: "Who we are", body: "Turtle 23 Company Limited and the T23 restaurants it operates (the data controller). Registered address: to be added." },
    { h: "Data we collect", body: ["Name, phone number and email", "Booking date, time, party size, course, purpose of visit and requests", "Dietary and allergy information, only if you give it and consent", "Payment status. We never see or store your card number; our payment provider (Omise) processes it"] },
    { h: "Why we use it and the legal basis", body: ["Making, confirming, reminding and serving your booking: performance of a contract (PDPA s.24(3))", "Accounting and tax records: legal obligation (s.24(6))", "Preparing your meal around allergies: your explicit consent (s.26)", "News, promotions and offers: your consent (s.19), only if you opt in"] },
    { h: "If you don't provide it", body: "Without your name and contact details we can't take the booking. Allergy and marketing information is optional." },
    { h: "How long we keep it", body: "Booking records for the period approved by our legal team (draft: 2 years after your visit); accounting records as the law requires. Dietary and allergy details stay on your guest profile until you withdraw consent or the retention period ends, then they are deleted or anonymised." },
    { h: "Who receives it", body: ["The T23 restaurant you booked", "Our payment provider (Omise)", "IT and cloud providers that process data on our behalf"] },
    { h: "International transfer", body: "Our cloud providers may store data outside Thailand, with safeguards under PDPA s.28–29." },
    { h: "Your rights", body: ["Access and receive a copy of your data", "Correct it", "Have it deleted or anonymised", "Data portability", "Object to or restrict processing", "Withdraw consent at any time; this does not affect your booking", "Complain to the Personal Data Protection Committee"] },
    { h: "Contact", body: "Contact the restaurant you booked, or our privacy contact (address to be added)." },
  ],
};

const th: Notice = {
  title: "ประกาศความเป็นส่วนตัวสำหรับลูกค้าร้านอาหาร",
  meta: `เวอร์ชัน ${PRIVACY_NOTICE_VERSION} ฉบับร่าง รอฝ่ายกฎหมายตรวจ`,
  sections: [
    { h: "เราคือใคร", body: "Turtle 23 Company Limited และร้านในเครือ T23 ในฐานะผู้ควบคุมข้อมูลส่วนบุคคล ที่อยู่: รอระบุ" },
    { h: "ข้อมูลที่เก็บ", body: ["ชื่อ เบอร์โทรศัพท์ และอีเมล", "วัน เวลา จำนวนแขก คอร์ส วัตถุประสงค์การมา และคำขอพิเศษ", "ข้อมูลอาหารที่ไม่ทานและการแพ้อาหาร เฉพาะเมื่อคุณให้ข้อมูลและให้ความยินยอม", "สถานะการชำระเงิน เราไม่เห็นและไม่เก็บเลขบัตร ผู้ให้บริการชำระเงิน (Omise) เป็นผู้ประมวลผล"] },
    { h: "วัตถุประสงค์และฐานทางกฎหมาย", body: ["ดำเนินการจอง ยืนยัน แจ้งเตือน และให้บริการ: ฐานสัญญา (ม.24(3))", "บัญชีและภาษี: ฐานหน้าที่ตามกฎหมาย (ม.24(6))", "เตรียมอาหารตามข้อมูลการแพ้อาหาร: ความยินยอมโดยชัดแจ้ง (ม.26)", "ข่าวสาร โปรโมชั่น และข้อเสนอ: ความยินยอม (ม.19) เฉพาะเมื่อคุณเลือก"] },
    { h: "ผลของการไม่ให้ข้อมูล", body: "หากไม่ให้ชื่อและช่องทางติดต่อ เราไม่สามารถรับจองได้ ข้อมูลการแพ้อาหารและการตลาดไม่บังคับ" },
    { h: "ระยะเวลาเก็บ", body: "ข้อมูลการจองเก็บตามระยะที่ฝ่ายกฎหมายอนุมัติ (ร่าง: 2 ปีหลังวันใช้บริการ) ข้อมูลบัญชีตามที่กฎหมายกำหนด ข้อมูลอาหารและการแพ้อาหารเก็บในประวัติลูกค้าจนกว่าคุณจะถอนความยินยอมหรือครบระยะเวลาเก็บ แล้วจึงลบหรือทำให้ไม่ระบุตัวตน" },
    { h: "ผู้รับข้อมูล", body: ["ร้านในเครือ T23 ที่คุณจอง", "ผู้ให้บริการชำระเงิน (Omise)", "ผู้ให้บริการระบบและคลาวด์ที่ประมวลผลแทนเรา"] },
    { h: "การส่งข้อมูลไปต่างประเทศ", body: "ผู้ให้บริการคลาวด์อาจจัดเก็บข้อมูลนอกประเทศไทย โดยมีมาตรการคุ้มครองตาม ม.28–29" },
    { h: "สิทธิของคุณ", body: ["ขอเข้าถึงและรับสำเนาข้อมูล", "ขอแก้ไขข้อมูล", "ขอลบหรือทำให้ไม่ระบุตัวตน", "ขอโอนย้ายข้อมูล", "คัดค้านหรือขอระงับการใช้ข้อมูล", "ถอนความยินยอมได้ทุกเมื่อ โดยไม่กระทบการจอง", "ร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล"] },
    { h: "ติดต่อ", body: "ติดต่อร้านที่คุณจอง หรือผู้ประสานงานด้านความเป็นส่วนตัวของเรา (รอระบุช่องทาง)" },
  ],
};

export function privacyNotice(locale: string): Notice {
  return locale === "th" ? th : en;
}
