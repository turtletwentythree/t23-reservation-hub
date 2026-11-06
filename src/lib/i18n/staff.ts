// Staff-screen translations. Keys are the English text, so any string without a
// translation simply shows in English.
export type StaffLocale = "en" | "th" | "fr";
export const STAFF_LOCALES: StaffLocale[] = ["en", "th", "fr"];
export const STAFF_LOCALE_COOKIE = "t23_lang";
export const STAFF_LOCALE_LABELS: Record<StaffLocale, string> = { en: "EN", th: "ไทย", fr: "FR" };
export const STAFF_DATE_LOCALES: Record<StaffLocale, string> = { en: "en-GB", th: "th-TH", fr: "fr-FR" };

export function toStaffLocale(v: string | null | undefined): StaffLocale {
  return v === "th" || v === "fr" ? v : "en";
}

type Entry = { th: string; fr: string };

const T: Record<string, Entry> = {
  // Navigation
  Dashboard: { th: "แดชบอร์ด", fr: "Tableau de bord" },
  Reservations: { th: "การจอง", fr: "Réservations" },
  Calendar: { th: "ปฏิทิน", fr: "Calendrier" },
  "Floor Plan": { th: "ผังโต๊ะ", fr: "Plan de salle" },
  Waitlist: { th: "คิวรอ", fr: "Liste d'attente" },
  Customers: { th: "ลูกค้า", fr: "Clients" },
  Notifications: { th: "การแจ้งเตือน", fr: "Notifications" },
  Reports: { th: "รายงาน", fr: "Rapports" },
  Restaurants: { th: "ร้านอาหาร", fr: "Restaurants" },
  Integrations: { th: "การเชื่อมต่อ", fr: "Intégrations" },
  "User Management": { th: "จัดการผู้ใช้", fr: "Utilisateurs" },
  Settings: { th: "ตั้งค่า", fr: "Paramètres" },
  "Audit Logs": { th: "บันทึกการแก้ไข", fr: "Journal d'audit" },

  // Shell
  Branch: { th: "สาขา", fr: "Établissement" },
  "All branches": { th: "ทุกสาขา", fr: "Tous les établissements" },
  disabled: { th: "ปิดใช้งาน", fr: "désactivé" },
  "Sign out": { th: "ออกจากระบบ", fr: "Se déconnecter" },
  Language: { th: "ภาษา", fr: "Langue" },
  "Open menu": { th: "เปิดเมนู", fr: "Ouvrir le menu" },
  "Close menu": { th: "ปิดเมนู", fr: "Fermer le menu" },
  Admin: { th: "Admin", fr: "Admin" },
  Store: { th: "หน้าร้าน", fr: "Accueil" },
  View: { th: "ดูอย่างเดียว", fr: "Lecture seule" },

  // Login
  "Staff sign in": { th: "เข้าสู่ระบบพนักงาน", fr: "Connexion du personnel" },
  "Sign in with Microsoft 365": { th: "เข้าสู่ระบบด้วย Microsoft 365", fr: "Se connecter avec Microsoft 365" },
  or: { th: "หรือ", fr: "ou" },
  Email: { th: "อีเมล", fr: "E-mail" },
  Password: { th: "รหัสผ่าน", fr: "Mot de passe" },
  "Sign in": { th: "เข้าสู่ระบบ", fr: "Se connecter" },
  "Signing in…": { th: "กำลังเข้าสู่ระบบ…", fr: "Connexion…" },
  "Accounts are created by a T23 administrator.": { th: "บัญชีผู้ใช้สร้างโดยผู้ดูแลระบบ T23", fr: "Les comptes sont créés par un administrateur T23." },
  "This Microsoft account does not have access. Ask an Admin to add your email in Users.": {
    th: "บัญชี Microsoft นี้ยังไม่มีสิทธิ์ใช้งาน กรุณาให้ Admin เพิ่มอีเมลของคุณในหน้า Users",
    fr: "Ce compte Microsoft n'a pas accès. Demandez à un Admin d'ajouter votre e-mail dans Utilisateurs.",
  },
  "Microsoft sign-in did not complete. Please try again.": { th: "เข้าสู่ระบบด้วย Microsoft ไม่สำเร็จ กรุณาลองใหม่", fr: "La connexion Microsoft a échoué. Veuillez réessayer." },
  "Microsoft sign-in is not set up yet. Please use email and password.": { th: "ยังไม่ได้ตั้งค่า Microsoft กรุณาใช้อีเมลและรหัสผ่าน", fr: "La connexion Microsoft n'est pas encore configurée. Utilisez e-mail et mot de passe." },
  "Too many attempts. Please wait a few minutes.": { th: "ลองหลายครั้งเกินไป กรุณารอสักครู่", fr: "Trop de tentatives. Patientez quelques minutes." },
  "Enter a valid email and password.": { th: "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง", fr: "Saisissez un e-mail et un mot de passe valides." },
  "Invalid email or password.": { th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", fr: "E-mail ou mot de passe incorrect." },
  "Sign-in failed.": { th: "เข้าสู่ระบบไม่สำเร็จ", fr: "Échec de la connexion." },

  // Statuses
  Pending: { th: "รอยืนยัน", fr: "En attente" },
  Confirmed: { th: "ยืนยันแล้ว", fr: "Confirmée" },
  Arrived: { th: "มาถึงแล้ว", fr: "Arrivé" },
  Seated: { th: "นั่งโต๊ะแล้ว", fr: "Installé" },
  Completed: { th: "เสร็จสิ้น", fr: "Terminée" },
  Cancelled: { th: "ยกเลิก", fr: "Annulée" },
  "No-show": { th: "ไม่มาตามนัด", fr: "Absent" },

  // Dashboard
  Date: { th: "วันที่", fr: "Date" },
  "Booking source": { th: "ช่องทางจอง", fr: "Source" },
  "All sources": { th: "ทุกช่องทาง", fr: "Toutes les sources" },
  Status: { th: "สถานะ", fr: "Statut" },
  "All statuses": { th: "ทุกสถานะ", fr: "Tous les statuts" },
  Apply: { th: "ใช้ตัวกรอง", fr: "Appliquer" },
  "excl. cancelled & no-show": { th: "ไม่รวมยกเลิกและไม่มา", fr: "hors annulées et absents" },
  "Total covers": { th: "จำนวนแขกทั้งหมด", fr: "Couverts" },
  "Pending confirmation": { th: "รอยืนยัน", fr: "À confirmer" },
  "No-shows": { th: "ไม่มาตามนัด", fr: "Absents" },
  "Available tables now": { th: "โต๊ะว่างตอนนี้", fr: "Tables libres" },
  "Walk-in queue": { th: "คิว Walk-in", fr: "File sans réservation" },
  "Branch comparison": { th: "เปรียบเทียบสาขา", fr: "Comparaison des établissements" },
  Upcoming: { th: "กำลังจะมาถึง", fr: "À venir" },
  "View all": { th: "ดูทั้งหมด", fr: "Tout voir" },
  "No upcoming reservations.": { th: "ไม่มีการจองที่กำลังจะมาถึง", fr: "Aucune réservation à venir." },
  unassigned: { th: "ยังไม่ระบุโต๊ะ", fr: "sans table" },
  allergy: { th: "แพ้อาหาร", fr: "allergie" },
  covers: { th: "แขก", fr: "couverts" },

  // Page headers
  "User management": { th: "จัดการผู้ใช้", fr: "Gestion des utilisateurs" },
  "Roles control what staff can do; branch access controls where.": { th: "สิทธิ์กำหนดว่าพนักงานทำอะไรได้ ส่วนสาขากำหนดว่าทำได้ที่ร้านไหน", fr: "Le rôle définit ce que chacun peut faire, l'accès aux établissements définit où." },
  "Seat a walk-in": { th: "รับลูกค้า Walk-in", fr: "Installer un client sans réservation" },
  "New reservation": { th: "สร้างการจองใหม่", fr: "Nouvelle réservation" },
  "Availability updates as you change date and party size.": { th: "ที่ว่างจะอัปเดตตามวันที่และจำนวนคน", fr: "Les disponibilités se mettent à jour selon la date et le nombre de personnes." },
  reservations: { th: "การจอง", fr: "réservations" },
  "Audit logs": { th: "บันทึกการแก้ไข", fr: "Journal d'audit" },
  "Every create, update and delete on key records — written by database triggers, not the app.": { th: "ทุกการสร้าง แก้ไข และลบข้อมูลสำคัญ บันทึกโดยฐานข้อมูลโดยตรง", fr: "Chaque création, modification et suppression, enregistrée par la base de données." },
  "Floor plan": { th: "ผังโต๊ะ", fr: "Plan de salle" },
  "Live table status. Click a table to seat, check in or change its status.": { th: "สถานะโต๊ะแบบสด คลิกที่โต๊ะเพื่อพาลูกค้านั่ง เช็คอิน หรือเปลี่ยนสถานะ", fr: "Statut des tables en direct. Cliquez sur une table pour installer, enregistrer ou changer son statut." },
  "Possible duplicate guests": { th: "ลูกค้าที่อาจซ้ำกัน", fr: "Doublons possibles" },
  "Matched by phone, email or very similar name.": { th: "จับคู่จากเบอร์โทร อีเมล หรือชื่อที่คล้ายกัน", fr: "Repérés par téléphone, e-mail ou nom très proche." },
  "Back to guests": { th: "กลับไปหน้าลูกค้า", fr: "Retour aux clients" },
  Guests: { th: "ลูกค้า", fr: "Clients" },
  "guest profiles shared across all branches": { th: "โปรไฟล์ลูกค้า ใช้ร่วมกันทุกสาขา", fr: "fiches clients partagées entre les établissements" },
  "Walk-in & waitlist": { th: "Walk-in และคิวรอ", fr: "Sans réservation et attente" },
  waiting: { th: "รออยู่", fr: "en attente" },
  "tables free now": { th: "โต๊ะว่างตอนนี้", fr: "tables libres" },
  "Notification center": { th: "ศูนย์การแจ้งเตือน", fr: "Centre de notifications" },
  "Every message attempt is logged with its real delivery status.": { th: "ทุกข้อความที่ส่งถูกบันทึกพร้อมสถานะการส่งจริง", fr: "Chaque envoi est enregistré avec son statut de livraison réel." },
  "default time zone": { th: "เขตเวลาเริ่มต้น", fr: "fuseau horaire par défaut" },
  "Providers are adapters; credentials live only in server environment variables. Nothing reports success unless the provider actually confirms it.": {
    th: "ข้อมูลรับรองเก็บไว้ที่เซิร์ฟเวอร์เท่านั้น ระบบจะแสดงว่าสำเร็จก็ต่อเมื่อผู้ให้บริการยืนยันจริง",
    fr: "Les identifiants restent sur le serveur. Rien n'est indiqué comme réussi sans confirmation du fournisseur.",
  },
  "Active branch": { th: "สาขาที่เปิดใช้งาน", fr: "Établissement actif" },
  "Disabled branch": { th: "สาขาที่ปิดใช้งาน", fr: "Établissement désactivé" },
  "Branches, booking rules, opening hours and booking links.": { th: "สาขา กฎการจอง เวลาเปิดปิด และลิงก์จอง", fr: "Établissements, règles de réservation, horaires et liens de réservation." },
  "Reports & analytics": { th: "รายงานและสถิติ", fr: "Rapports et analyses" },
  "all branches": { th: "ทุกสาขา", fr: "tous les établissements" },
  "calculated from": { th: "คำนวณจาก", fr: "calculé à partir de" },
  "reservation records": { th: "รายการจอง", fr: "réservations" },
};

export type Translate = (text: string) => string;

export function makeT(locale: StaffLocale): Translate {
  if (locale === "en") return (s) => s;
  return (s) => T[s]?.[locale] ?? s;
}
