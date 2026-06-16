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
  timelimit: number,
  locked: boolean, // Remove?
  sectionname: string,
  startTs?: number,
  groups: boolean,
  groupA: Group,
  groupB: Group,
}

export type Margin = {
  side: string | null,
  size: number | null,
}

export type EditorExamConfig = {
  spellchecklang?: string,
  suggestions?: boolean,
  cmargin?: Margin,
  linespacing?: string | number,
  languagetool?: boolean,
  languagetoolhost?: string | null,
  languagetoolport?: string | null,
  fontfamily?: string,
  fontsize?: string,
  audioRepeat?: string | number,
  editorTemplate?: Record<string, unknown>,
}

export type Group = {
  users: number[],
  examInstructionFiles: File[],
  allowedUrls: Url[],
  examConfig: ExamConfig,
}

export type ExamConfig = {
  activeSheets: ActiveSheetsConfig,
  editor: EditorExamConfig,
  eduvidual: EduvidualConfig,
  forms: Record<string, unknown>,
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
  sebConfigFile?: string | null,
  sebConfigPassword?: string | null,
  sebConfigBek?: string | null,
  sebConfig?: string | null,
  sebConfigHash?: string | null,
  sebBekHash?: string | null,
}

export type RdpConfig = {
  domain?: string,
  protocol?: string,
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
