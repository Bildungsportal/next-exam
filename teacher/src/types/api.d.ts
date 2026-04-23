export type Exam = {
  lastUpdate: number,
  bip: boolean,
  id: number, // Eindeutige ID im BiP.
  nextexamVersion: string,
  examName: string, // Name der Prüfung wie sie am Client dargstellt werden soll.
  examPassword: number, // Remove?
  examDate: string, // Geplanter Beginn der Prüfung.
  examDurationMinutes: number, // Dauer der Prüfung in Minuten.
  pin: number,
  requireBiP: boolean, // Remove?
  exammode: boolean, // Remove?
  delfolderonexit: boolean, // Remove?
  screenshotinterval: number,
  backupintervalPause: number,
  screenslocked: boolean, // Remove?
  screenshotocr: boolean, // Remove?
  examStudents: Student[],
  examTeachers: Teacher[],
  examSecurityKey: string | null, // Remove?
  useExamSections: boolean,
  activeSection: number, // Remove?
  lockedSection: number, // Remove?
  examSections: Section[],
}

export type Student = {
  studentID: number,
  studentName: string,
  studentSeat: number | null,
}

export type Teacher = {
  teacherID: number, // BiP-ID der Lehrperson.
  teacherIP: string | null, // Automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet.
  manager: boolean,
}

export type Section = {
  examtype: string,
  timelimit: number, // Remove?
  locked: boolean, // Remove?
  sectionname: string,
  spellchecklang: string | null,
  suggestions: boolean | null,
  cmargin: Margin[],
  formsUrl: string | null,
  msOfficeFile: boolean | null, // Remove?
  linespacing: number | null,
  languagetool: boolean | null,
  fontfamily: string | null,
  fontsize: number | null,
  audioRepeat: number | null,
  localVMConfig: any,
  groups: boolean,
  groupA: Group,
  groupB: Group,
}

export type Margin = {
  side: string | null,
  size: number | null,
}

export type Group = {
  users: number[],
  examInstructionFiles: File[],
  allowedUrls: Url[],
  examConfig: ExamConfig,
}

export type ExamConfig = {
  activeSheets: ActiveSheetsConfig,
  editor: Record<string, unknown>,
  eduvidual: EduvidualConfig,
  gforms: Record<string, unknown>,
  website: WebsiteConfig,
  math: Record<string, unknown>,
  microsoft365: Record<string, unknown>,
  rdp: RdpConfig,
  localvm: Record<string, unknown>,
}

export type ActiveSheetsConfig = {
  filename?: string,
  filecontent?: string,
}

export type WebsiteConfig = {
  url?: string,
  blockSubdomains?: boolean,
  blockSubfolders?: boolean,
}

export type EduvidualConfig = {
  url?: string,
  moodleDomain?: string | null,
  moodleTestId?: number | null,
}

export type RdpConfig = {
  domain?: string,
}

export type File = {
  filename: string,
  filetype: string,
  filecontent: string,
  checksum: string,
}

export type Url = {
  url: string,
  blockSubdomains: boolean,
  blockSubfolders: boolean,
}
