export type Exam = {
  lastUpdate: number,
  bip: boolean,
  id: number, // Unique ID in BiP.
  nextexamVersion: string,
  examName: string, // Name of the exam as displayed to the client.
  examPassword: string,
  encryptionPassword: string,
  examDate: string, // Scheduled start of the exam.
  examDurationMinutes: number, // Duration of the exam in minutes.
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
  teacherID: number, // BiP ID of the teacher.
  teacherIP: string | null, // Automatically set when the teacher starts an exam in BiP.
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
  microsoft365: Microsoft365Config,
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

export type Microsoft365Config = {
  template?: Microsoft365Template,
}

export type Microsoft365Template = {
  filename?: string,
  filecontent?: string,
  mimetype?: string,
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
